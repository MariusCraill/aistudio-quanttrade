import { CandleData, TradeSetup, StopLossType, TradeHorizon } from '../types';
import {
  calculateIndicators,
  findRecentSwingLow,
  evaluateTrendQuality,
  evaluateConfluence,
  evaluateVolatilitySurge,
} from '../utils/technicalIndicators';
import { calculateRewardToRisk } from '../utils/quantMath';

export function analyzeCandleSetup(
  symbol: string,
  name: string,
  candles: CandleData[],
  stopLossMode: StopLossType = 'ATR_2X',
  tradeHorizon: TradeHorizon = 'SWING',
  targetMultiplier = 2.5
): TradeSetup | null {
  if (candles.length < 50) return null;

  const indicators = calculateIndicators(candles);
  const lastIndex = candles.length - 1;
  const currentCandle = candles[lastIndex];
  const currentPrice = currentCandle.close;

  const sma20 = indicators.sma20[lastIndex];
  const sma50 = indicators.sma50[lastIndex];
  const sma200 = indicators.sma200[lastIndex];
  const rsi14 = indicators.rsi14[lastIndex] ?? 50;
  const atr14 = indicators.atr14[lastIndex] ?? 2.5;
  const high20 = indicators.high20[lastIndex];
  const volSma20 = indicators.volSma20[lastIndex] ?? currentCandle.volume;

  const volRatio = volSma20 > 0 ? currentCandle.volume / volSma20 : 1;

  // Trend analysis
  const trend = evaluateTrendQuality(currentPrice, sma20, sma50, sma200);

  // Trigger Detection:
  // 1. Momentum Breakout: Price breaks above 20-day high with Volume > 1.5x 20-day Average Volume
  const isMomentumBreakout =
    high20 !== null &&
    currentPrice >= high20 &&
    volRatio >= 1.5;

  // 2. Mean-Reversion Pullback: Price touches 20-day or 50-day SMA while RSI-14 drops below 40 in a structural uptrend
  const inStructuralUptrend =
    (sma200 !== null && currentPrice > sma200 * 0.98) ||
    (sma50 !== null && sma200 !== null && sma50 > sma200);

  const touches20SMA = sma20 !== null && Math.abs(currentPrice - sma20) / sma20 <= 0.015;
  const touches50SMA = sma50 !== null && Math.abs(currentPrice - sma50) / sma50 <= 0.018;
  const isMeanReversionPullback =
    inStructuralUptrend &&
    (touches20SMA || touches50SMA) &&
    rsi14 <= 42; // close to or below 40

  let setupType: 'MOMENTUM_BREAKOUT' | 'MEAN_REVERSION_PULLBACK' = 'MOMENTUM_BREAKOUT';
  let triggerDescription = '';

  if (isMomentumBreakout) {
    setupType = 'MOMENTUM_BREAKOUT';
    triggerDescription = `Momentum Breakout: Price ($${currentPrice.toFixed(2)}) cleared 20-day high ($${high20?.toFixed(2)}) on ${(volRatio).toFixed(1)}x avg volume surge.`;
  } else if (isMeanReversionPullback) {
    setupType = 'MEAN_REVERSION_PULLBACK';
    const touchedMA = touches20SMA ? '20-day SMA' : '50-day SMA';
    triggerDescription = `Mean-Reversion Pullback: Tested ${touchedMA} with RSI-14 at ${rsi14.toFixed(1)} (<40 threshold) in an established uptrend.`;
  } else {
    // Default to the closest setup for interactive modeling
    if (rsi14 < 48) {
      setupType = 'MEAN_REVERSION_PULLBACK';
      triggerDescription = `Potential Mean-Reversion: Approaching moving average support with cooling RSI (${rsi14.toFixed(1)}).`;
    } else {
      setupType = 'MOMENTUM_BREAKOUT';
      triggerDescription = `Consolidation Base: Tracking 20-day high resistance level ($${(high20 ?? currentPrice).toFixed(2)}).`;
    }
  }

  // Calculate Stop Loss
  const swingLow = findRecentSwingLow(candles, lastIndex, 12);
  let stopLossPrice = 0;

  if (stopLossMode === 'ATR_2X') {
    // Stop loss at 2x ATR below entry
    stopLossPrice = Number((currentPrice - 2 * atr14).toFixed(2));
  } else {
    // Stop loss placed just below recent swing low (e.g. 0.5% below swing low for cushion)
    stopLossPrice = Number((swingLow * 0.995).toFixed(2));
  }

  // Sanity check: stop loss must be lower than entry
  if (stopLossPrice >= currentPrice) {
    stopLossPrice = Number((currentPrice * 0.95).toFixed(2));
  }

  const riskAmount = Number((currentPrice - stopLossPrice).toFixed(2));

  // Calculate Take Profit (Target)
  // Dynamic target based on risk multiples: Target = Entry + (Multiplier * Risk)
  const targetPrice = Number((currentPrice + targetMultiplier * riskAmount).toFixed(2));
  const rewardAmount = Number((targetPrice - currentPrice).toFixed(2));
  const rewardToRisk = calculateRewardToRisk(currentPrice, stopLossPrice, targetPrice);

  // Volatility State & 20-Day ATR Moving Average Surge
  const atrPercent = Number(((atr14 / currentPrice) * 100).toFixed(2));
  let volatilityState: 'Low Compression' | 'Normal' | 'High Expansion' = 'Normal';
  if (atrPercent < 2.0) volatilityState = 'Low Compression';
  else if (atrPercent > 4.0) volatilityState = 'High Expansion';

  const isJSE = symbol.toUpperCase().endsWith('.JO');
  const exchange = isJSE ? 'JSE' : 'US';
  const currencySymbol = isJSE ? 'R' : '$';
  const volEval = evaluateVolatilitySurge(candles, symbol, name, exchange, currencySymbol);

  // Confluence Evaluation
  const confluence = evaluateConfluence({
    isBreakout: isMomentumBreakout,
    isPullback: isMeanReversionPullback,
    volRatio,
    trendScore: trend.score,
    rsi: rsi14,
    atrPercent,
  });

  // Estimated Duration
  const estimatedDuration =
    tradeHorizon === 'SWING'
      ? '3 to 15 Days (Tracking 10d - 20d MA holds)'
      : '3 Weeks to 3 Months (Holding above 50-day SMA)';

  return {
    id: `${symbol}-${currentCandle.time}`,
    symbol,
    name,
    date: currentCandle.time,
    setupType,
    horizon: tradeHorizon,
    currentPrice,
    entryPrice: currentPrice,
    stopLossPrice,
    targetPrice,
    stopLossType: stopLossMode,
    atr14,
    atrMa20: volEval.atrMa20,
    volatilitySurgeRatio: volEval.surgeRatio,
    isAtrSurgeActive: volEval.isSurgeActive,
    volatilityAlert: volEval.alert ?? undefined,
    swingLow,
    riskAmount,
    rewardAmount,
    rewardToRisk,
    trendQualityScore: trend.score,
    confluenceScore: confluence.score,
    volatilityState,
    atrPercent,
    estimatedDuration,
    triggerDescription,
    confluenceFactors: [...trend.details.slice(0, 2), ...confluence.factors],
  };
}
