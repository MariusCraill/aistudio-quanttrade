import { RiskAnalysis } from '../types';

/**
 * Calculates Reward-to-Risk Ratio:
 * R:R = (Target Price - Entry Price) / (Entry Price - Stop Loss Price)
 */
export function calculateRewardToRisk(entry: number, stopLoss: number, target: number): number {
  const risk = entry - stopLoss;
  const reward = target - entry;
  if (risk <= 0) return 0;
  return Number((reward / risk).toFixed(2));
}

/**
 * Calculates Expected Value (EV) per dollar risked:
 * EV = (W * R) - (1 - W)
 * W = Win Rate (0 - 1)
 * R = Reward-to-Risk Ratio
 */
export function calculateExpectedValue(winRate: number, rewardToRisk: number): number {
  const lossRate = 1 - winRate;
  const ev = (winRate * rewardToRisk) - lossRate;
  return Number(ev.toFixed(3));
}

/**
 * Calculates Fractional Kelly Criterion:
 * K% = W - ((1 - W) / R)
 * Returns decimal between -1 and 1
 */
export function calculateKellyCriterion(winRate: number, rewardToRisk: number): {
  fullKelly: number;
  halfKelly: number;
  quarterKelly: number;
} {
  if (rewardToRisk <= 0) {
    return { fullKelly: 0, halfKelly: 0, quarterKelly: 0 };
  }
  const lossRate = 1 - winRate;
  const k = winRate - (lossRate / rewardToRisk);
  const fullKelly = Math.max(0, Number(k.toFixed(4)));
  const halfKelly = Number((fullKelly / 2).toFixed(4));
  const quarterKelly = Number((fullKelly / 4).toFixed(4));

  return { fullKelly, halfKelly, quarterKelly };
}

/**
 * Break-even win rate needed for profitability:
 * BE% = 1 / (1 + R:R)
 */
export function calculateBreakEvenWinRate(rewardToRisk: number): number {
  if (rewardToRisk <= 0) return 1;
  return Number((1 / (1 + rewardToRisk)).toFixed(3));
}

/**
 * Complete Risk and Position Size Analysis
 */
export function computeCompleteRiskAnalysis(params: {
  accountEquity: number;
  riskPercent: number; // e.g. 1.5%
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  estimatedWinRate: number; // e.g. 0.48
}): RiskAnalysis {
  const {
    accountEquity,
    riskPercent,
    entryPrice,
    stopLossPrice,
    targetPrice,
    estimatedWinRate,
  } = params;

  const riskPerShare = Math.max(0.01, entryPrice - stopLossPrice);
  const rewardPerShare = Math.max(0, targetPrice - entryPrice);
  const rewardToRisk = calculateRewardToRisk(entryPrice, stopLossPrice, targetPrice);
  const isValidRR = rewardToRisk >= 2.0;

  const riskDollars = accountEquity * (riskPercent / 100);
  const fixedRiskShares = Math.max(1, Math.floor(riskDollars / riskPerShare));
  const fixedRiskCapital = Number((fixedRiskShares * entryPrice).toFixed(2));
  const fixedRiskPercentOfEquity = Number(((fixedRiskCapital / accountEquity) * 100).toFixed(1));

  const expectedValue = calculateExpectedValue(estimatedWinRate, rewardToRisk);
  const expectedProfitPerTrade = Number((expectedValue * riskDollars).toFixed(2));
  const breakEvenWinRate = calculateBreakEvenWinRate(rewardToRisk);

  const { fullKelly, halfKelly, quarterKelly } = calculateKellyCriterion(estimatedWinRate, rewardToRisk);

  // Kelly allocation in capital and shares
  const kellyCapital = Number((accountEquity * halfKelly).toFixed(2));
  const kellyShares = Math.max(0, Math.floor(kellyCapital / entryPrice));

  const projectedProfit = Number((rewardPerShare * fixedRiskShares).toFixed(2));
  const projectedLoss = Number((riskPerShare * fixedRiskShares).toFixed(2));

  return {
    accountEquity,
    riskPercent,
    riskDollars,
    entryPrice,
    stopLossPrice,
    targetPrice,
    rewardToRisk,
    isValidRR,
    estimatedWinRate,
    expectedValue,
    expectedProfitPerTrade,
    breakEvenWinRate,
    fullKellyPercent: fullKelly * 100,
    halfKellyPercent: halfKelly * 100,
    quarterKellyPercent: quarterKelly * 100,
    kellyShares,
    kellyCapital,
    fixedRiskShares,
    fixedRiskCapital,
    fixedRiskPercentOfEquity,
    projectedProfit,
    projectedLoss,
  };
}

/**
 * Monte Carlo simulator to project 100 sequential trades
 * based on the calculated win rate and R:R ratio
 */
export function simulateTradeEquityPath(
  startingBalance: number,
  riskPercent: number,
  winRate: number,
  rewardToRisk: number,
  numTrades = 100
): { tradeNumber: number; balance: number; outcome: 'WIN' | 'LOSS' }[] {
  const path: { tradeNumber: number; balance: number; outcome: 'WIN' | 'LOSS' }[] = [
    { tradeNumber: 0, balance: startingBalance, outcome: 'WIN' }
  ];

  let currentBalance = startingBalance;
  for (let i = 1; i <= numTrades; i++) {
    const isWin = Math.random() < winRate;
    const risked = currentBalance * (riskPercent / 100);
    if (isWin) {
      currentBalance += risked * rewardToRisk;
    } else {
      currentBalance = Math.max(1, currentBalance - risked);
    }
    path.push({
      tradeNumber: i,
      balance: Math.round(currentBalance),
      outcome: isWin ? 'WIN' : 'LOSS',
    });
  }

  return path;
}
