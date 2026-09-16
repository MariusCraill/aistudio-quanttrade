import { CandleData, BacktestSummary, BacktestTrade, SetupType, StopLossType, TradeHorizon } from '../types';
import { calculateIndicators, findRecentSwingLow } from '../utils/technicalIndicators';
import { calculateExpectedValue } from '../utils/quantMath';

export interface BacktestParams {
  candles: CandleData[];
  strategy: 'ALL' | SetupType;
  stopLossType: StopLossType;
  targetMultiplier: number; // e.g. 2.0 or 2.5
  horizon: TradeHorizon;
  startingCapital?: number;
  riskPercent?: number;
}

export function runContinuousBacktest(params: BacktestParams): BacktestSummary {
  const {
    candles,
    strategy,
    stopLossType,
    targetMultiplier = 2.5,
    horizon = 'SWING',
    startingCapital = 50000,
    riskPercent = 1.5,
  } = params;

  if (candles.length < 60) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      timeExits: 0,
      winRate: 0,
      lossRate: 0,
      averageRewardToRisk: targetMultiplier,
      expectedValue: 0,
      profitFactor: 0,
      totalPnlR: 0,
      maxDrawdownR: 0,
      sharpeRatio: 0,
      trades: [],
      equityCurve: [{ date: candles[0]?.time ?? '2026-01-01', equityR: 0, capital: startingCapital }],
    };
  }

  const indicators = calculateIndicators(candles);
  const trades: BacktestTrade[] = [];
  const maxHoldingDays = horizon === 'SWING' ? 15 : 60;

  let inTrade = false;
  let activeTrade: {
    id: string;
    entryIndex: number;
    entryDate: string;
    entryPrice: number;
    stopLoss: number;
    target: number;
    riskAmount: number;
    setupType: SetupType;
  } | null = null;

  for (let i = 50; i < candles.length; i++) {
    const current = candles[i];

    // If currently in a trade, check exit conditions
    if (inTrade && activeTrade) {
      const holdingDays = i - activeTrade.entryIndex;
      const hitStop = current.low <= activeTrade.stopLoss;
      const hitTarget = current.high >= activeTrade.target;
      const hitMaxTime = holdingDays >= maxHoldingDays;

      if (hitStop || hitTarget || hitMaxTime) {
        let outcome: 'WIN' | 'LOSS' | 'TIME_EXIT' = 'LOSS';
        let exitPrice = activeTrade.stopLoss;
        let pnlR = -1.0;
        let exitReason = 'Stop Loss Invalidation (-1.0R)';

        if (hitTarget && !hitStop) {
          outcome = 'WIN';
          exitPrice = activeTrade.target;
          pnlR = targetMultiplier;
          exitReason = `Take Profit Target Hit (+${targetMultiplier.toFixed(1)}R)`;
        } else if (hitStop && !hitTarget) {
          outcome = 'LOSS';
          exitPrice = activeTrade.stopLoss;
          pnlR = -1.0;
          exitReason = 'Stop Loss Invalidation (-1.0R)';
        } else if (hitStop && hitTarget) {
          // If both hit on same candle, assume conservative loss or half
          outcome = 'LOSS';
          exitPrice = activeTrade.stopLoss;
          pnlR = -1.0;
          exitReason = 'Volatile Intraday Stop Hit (-1.0R)';
        } else if (hitMaxTime) {
          // Time-based exit
          exitPrice = current.close;
          const diff = exitPrice - activeTrade.entryPrice;
          pnlR = Number((diff / activeTrade.riskAmount).toFixed(2));
          outcome = pnlR >= 0.5 ? 'WIN' : 'TIME_EXIT';
          exitReason = `Holding Horizon Limit Reached (${holdingDays}d)`;
        }

        const riskDollars = startingCapital * (riskPercent / 100);
        const pnlDollars = Number((pnlR * riskDollars).toFixed(2));

        trades.push({
          id: `BT-${trades.length + 1}`,
          entryDate: activeTrade.entryDate,
          exitDate: current.time,
          entryPrice: activeTrade.entryPrice,
          exitPrice: Number(exitPrice.toFixed(2)),
          stopLoss: activeTrade.stopLoss,
          target: activeTrade.target,
          setupType: activeTrade.setupType,
          outcome,
          pnlDollars,
          pnlR: Number(pnlR.toFixed(2)),
          holdingDays,
          exitReason,
        });

        inTrade = false;
        activeTrade = null;
      }
      continue;
    }

    // Evaluate Entry Triggers
    const high20 = indicators.high20[i];
    const volSma20 = indicators.volSma20[i] ?? current.volume;
    const volRatio = volSma20 > 0 ? current.volume / volSma20 : 1;
    const sma20 = indicators.sma20[i];
    const sma50 = indicators.sma50[i];
    const sma200 = indicators.sma200[i];
    const rsi14 = indicators.rsi14[i] ?? 50;
    const atr14 = indicators.atr14[i] ?? 2.0;

    // Trigger 1: Momentum Breakout
    const isBreakout =
      high20 !== null &&
      current.close > high20 &&
      volRatio >= 1.45;

    // Trigger 2: Mean-Reversion Pullback
    const inUptrend = (sma200 !== null && current.close > sma200 * 0.98) || (sma50 !== null && sma200 !== null && sma50 > sma200);
    const near20or50SMA =
      (sma20 !== null && Math.abs(current.close - sma20) / sma20 <= 0.018) ||
      (sma50 !== null && Math.abs(current.close - sma50) / sma50 <= 0.02);
    const isPullback = inUptrend && near20or50SMA && rsi14 <= 42;

    let triggeredType: SetupType | null = null;
    if (isBreakout && (strategy === 'ALL' || strategy === 'MOMENTUM_BREAKOUT')) {
      triggeredType = 'MOMENTUM_BREAKOUT';
    } else if (isPullback && (strategy === 'ALL' || strategy === 'MEAN_REVERSION_PULLBACK')) {
      triggeredType = 'MEAN_REVERSION_PULLBACK';
    }

    if (triggeredType) {
      const entryPrice = current.close;
      let stopLoss = 0;
      if (stopLossType === 'ATR_2X') {
        stopLoss = Number((entryPrice - 2 * atr14).toFixed(2));
      } else {
        const swingLow = findRecentSwingLow(candles, i, 10);
        stopLoss = Number((swingLow * 0.995).toFixed(2));
      }

      if (stopLoss >= entryPrice) {
        stopLoss = Number((entryPrice * 0.95).toFixed(2));
      }

      const riskAmount = entryPrice - stopLoss;
      const target = Number((entryPrice + targetMultiplier * riskAmount).toFixed(2));

      inTrade = true;
      activeTrade = {
        id: `T-${i}`,
        entryIndex: i,
        entryDate: current.time,
        entryPrice,
        stopLoss,
        target,
        riskAmount,
        setupType: triggeredType,
      };
    }
  }

  // Calculate backtest statistics
  const totalTrades = trades.length;
  const wins = trades.filter(t => t.pnlR > 0).length;
  const losses = trades.filter(t => t.pnlR <= 0).length;
  const timeExits = trades.filter(t => t.outcome === 'TIME_EXIT').length;
  const winRate = totalTrades > 0 ? Number((wins / totalTrades).toFixed(3)) : 0;
  const lossRate = totalTrades > 0 ? Number((1 - winRate).toFixed(3)) : 0;

  const totalGrossWinR = trades.filter(t => t.pnlR > 0).reduce((sum, t) => sum + t.pnlR, 0);
  const totalGrossLossR = Math.abs(trades.filter(t => t.pnlR < 0).reduce((sum, t) => sum + t.pnlR, 0));
  const profitFactor = totalGrossLossR > 0 ? Number((totalGrossWinR / totalGrossLossR).toFixed(2)) : totalGrossWinR > 0 ? 99 : 0;

  const totalPnlR = Number(trades.reduce((sum, t) => sum + t.pnlR, 0).toFixed(2));
  const expectedValue = calculateExpectedValue(winRate, targetMultiplier);

  // Build Equity Curve and Max Drawdown
  let runningR = 0;
  let runningCapital = startingCapital;
  let peakR = 0;
  let maxDrawdownR = 0;

  const equityCurve: { date: string; equityR: number; capital: number }[] = [
    { date: candles[0]?.time ?? 'Start', equityR: 0, capital: startingCapital }
  ];

  trades.forEach(t => {
    runningR += t.pnlR;
    const dollarRisk = runningCapital * (riskPercent / 100);
    runningCapital += t.pnlR * dollarRisk;
    if (runningR > peakR) {
      peakR = runningR;
    }
    const dd = peakR - runningR;
    if (dd > maxDrawdownR) {
      maxDrawdownR = dd;
    }
    equityCurve.push({
      date: t.exitDate,
      equityR: Number(runningR.toFixed(2)),
      capital: Math.round(runningCapital),
    });
  });

  // Approximate Sharpe Ratio on per-trade returns
  const returns = trades.map(t => t.pnlR);
  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length > 1
    ? returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1)
    : 1;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? Number(((meanReturn / stdDev) * Math.sqrt(252 / 10)).toFixed(2)) : 0;

  return {
    totalTrades,
    wins,
    losses,
    timeExits,
    winRate,
    lossRate,
    averageRewardToRisk: targetMultiplier,
    expectedValue,
    profitFactor,
    totalPnlR,
    maxDrawdownR: Number(maxDrawdownR.toFixed(2)),
    sharpeRatio,
    trades,
    equityCurve,
  };
}
