import {
  TradeSetup,
  RiskAnalysis,
  TargetDurationProjection,
  PortfolioEvaluation,
  PortfolioCheckItem,
} from '../types';

/**
 * Adds business trading days to a starting date, skipping weekends (Saturday & Sunday).
 */
export function addTradingDays(startDate: Date, businessDays: number): {
  date: Date;
  dateStr: string;
  formatted: string;
} {
  const result = new Date(startDate.getTime());
  let added = 0;

  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    // 0 is Sunday, 6 is Saturday
    if (day !== 0 && day !== 6) {
      added++;
    }
  }

  const year = result.getFullYear();
  const month = String(result.getMonth() + 1).padStart(2, '0');
  const day = String(result.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const formatted = result.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return { date: result, dateStr, formatted };
}

/**
 * Quantitatively projects trade duration until profit targets are achieved.
 * Based on price distance, Average True Range (ATR-14), and directional efficiency.
 */
export function calculateTargetDuration(setup: TradeSetup): TargetDurationProjection {
  const distance = Math.max(0.01, setup.targetPrice - setup.entryPrice);
  const riskDist = Math.max(0.01, setup.entryPrice - setup.stopLossPrice);
  const atr = Math.max(0.01, setup.atr14);
  const baseDate = new Date();

  // Directional drift factors per trading day (accounting for non-linear movement):
  // 1. Momentum / Accelerated trend: ~0.70x ATR per day
  // 2. Typical Swing Base rate: ~0.40x ATR per day (healthy 2-steps-forward, 1-step-back)
  // 3. Extended / High Resistance: ~0.22x ATR per day
  const fastDays = Math.max(2, Math.ceil(distance / (atr * 0.70)));
  const expectedDays = Math.max(3, Math.ceil(distance / (atr * 0.40)));
  const slowDays = Math.max(expectedDays + 2, Math.ceil(distance / (atr * 0.22)));

  // Milestones:
  // Milestone 1: +1.0R (Move Stop to Breakeven)
  const oneRDays = Math.max(1, Math.ceil(riskDist / (atr * 0.45)));
  const oneRDate = addTradingDays(baseDate, oneRDays);

  // Milestone 2: 50% Profit Distance
  const halfDist = distance * 0.5;
  const halfDays = Math.max(2, Math.ceil(halfDist / (atr * 0.42)));
  const halfDate = addTradingDays(baseDate, halfDays);

  // Milestone 3: Full Target Arrival (100%)
  const expectedTargetDateObj = addTradingDays(baseDate, expectedDays);
  const fastTargetDateObj = addTradingDays(baseDate, fastDays);
  const slowTargetDateObj = addTradingDays(baseDate, slowDays);

  // Max holding period (Time-decay stop): 2.2x expected days
  const maxHoldingDays = Math.ceil(expectedDays * 2.2);
  const maxHoldingDateObj = addTradingDays(baseDate, maxHoldingDays);

  const targetGainPercent = ((setup.targetPrice - setup.entryPrice) / setup.entryPrice) * 100;
  const dailyExpectedDrift = Math.round((distance / expectedDays) * 100) / 100;

  const currSym = setup.currencySymbol || (setup.exchange === 'JSE' ? 'R' : '$');

  let velocityDesc = '';
  if (setup.setupType === 'MOMENTUM_BREAKOUT') {
    velocityDesc = `High momentum breakout profile. Target is ${setup.rewardToRisk.toFixed(1)}x risk (${currSym}${distance.toFixed(2)} gain), projected in ~${expectedDays} trading sessions based on ${currSym}${atr.toFixed(2)} daily ATR.`;
  } else {
    velocityDesc = `Mean-reversion pullback profile. Anticipate steady trend resumption over ~${expectedDays} trading sessions to reclaim prior highs.`;
  }

  return {
    expectedTradingDays: expectedDays,
    expectedTargetDate: expectedTargetDateObj.formatted,
    fastTradingDays: fastDays,
    fastTargetDate: fastTargetDateObj.formatted,
    slowTradingDays: slowDays,
    slowTargetDate: slowTargetDateObj.formatted,
    dailyExpectedDrift,
    atrDollars: atr,
    atrPercent: setup.atrPercent,
    maxHoldingPeriodDays: maxHoldingDays,
    maxHoldingPeriodDate: maxHoldingDateObj.formatted,
    targetGainPercent: Math.round(targetGainPercent * 10) / 10,
    targetVelocityDescription: velocityDesc,
    milestones: [
      {
        label: '+1.0R Breakeven Trail',
        targetPrice: Math.round((setup.entryPrice + riskDist) * 100) / 100,
        tradingDays: oneRDays,
        targetDate: oneRDate.formatted,
        description: 'First checkpoint to trail stop loss to entry price and lock in risk-free status.',
      },
      {
        label: '50% Target Distance',
        targetPrice: Math.round((setup.entryPrice + halfDist) * 100) / 100,
        tradingDays: halfDays,
        targetDate: halfDate.formatted,
        description: 'Take partial scale-out (1/3 or 1/2 shares) to bank initial profits.',
      },
      {
        label: '100% Target Arrival',
        targetPrice: setup.targetPrice,
        tradingDays: expectedDays,
        targetDate: expectedTargetDateObj.formatted,
        description: 'Full strategic exit at predetermined reward objective.',
      },
    ],
  };
}

export interface PortfolioSettings {
  portfolioEquity: number;
  maxPortfolioRiskPercent: number; // e.g. 5.0%
  currentOpenRiskPercent: number; // e.g. 2.0%
  maxSectorExposurePercent: number; // e.g. 25.0%
  currentSectorExposurePercent: number; // e.g. 10.0%
}

/**
 * Evaluates whether the user should take this trade based on portfolio risk capacity,
 * confluence quality, mathematical expectancy, and session state.
 */
export function evaluatePortfolioSuitability(
  setup: TradeSetup,
  analysis: RiskAnalysis,
  settings: PortfolioSettings
): PortfolioEvaluation {
  const tradeRiskPercent = (analysis.riskDollars / settings.portfolioEquity) * 100;
  const availableRiskPercent = Math.max(0, settings.maxPortfolioRiskPercent - settings.currentOpenRiskPercent);
  const postTradeTotalRiskPercent = settings.currentOpenRiskPercent + tradeRiskPercent;

  const checks: PortfolioCheckItem[] = [];

  // Check 1: Reward-to-Risk (must be >= 2.0:1)
  const rrPassed = analysis.rewardToRisk >= 2.0;
  checks.push({
    id: 'check-rr',
    label: 'Reward-to-Risk Ratio',
    passed: rrPassed,
    actualValue: `${analysis.rewardToRisk.toFixed(2)}:1`,
    requiredCriteria: '≥ 2.00:1 minimum',
    status: rrPassed ? 'PASS' : 'FAIL',
  });

  // Check 2: Mathematical Expected Value (EV > 0)
  const evPassed = analysis.expectedValue >= 0.20;
  checks.push({
    id: 'check-ev',
    label: 'Mathematical Expected Value (EV)',
    passed: evPassed,
    actualValue: `${analysis.expectedValue > 0 ? '+' : ''}${analysis.expectedValue.toFixed(2)} per $ risked`,
    requiredCriteria: '≥ +0.20 positive expectancy',
    status: evPassed ? 'PASS' : analysis.expectedValue > 0 ? 'WARN' : 'FAIL',
  });

  // Check 3: Portfolio Risk Heat & Capacity
  const riskCapPassed = postTradeTotalRiskPercent <= settings.maxPortfolioRiskPercent;
  checks.push({
    id: 'check-portfolio-capacity',
    label: 'Portfolio Total Risk Heat',
    passed: riskCapPassed,
    actualValue: `${postTradeTotalRiskPercent.toFixed(1)}% (Trade adds ${tradeRiskPercent.toFixed(1)}%)`,
    requiredCriteria: `≤ ${settings.maxPortfolioRiskPercent.toFixed(1)}% portfolio cap`,
    status: riskCapPassed ? 'PASS' : 'FAIL',
  });

  // Check 4: Setup Confluence Score (>= 60)
  const confPassed = setup.confluenceScore >= 60;
  checks.push({
    id: 'check-confluence',
    label: 'Setup Confluence & Trend',
    passed: confPassed,
    actualValue: `${setup.confluenceScore} pts (${setup.confluenceFactors.length} factors)`,
    requiredCriteria: '≥ 60 confluence points',
    status: confPassed ? 'PASS' : 'WARN',
  });

  // Check 5: Volatility & Liquidity regime
  const volPassed = setup.atrPercent < 7.0 && setup.volatilityState !== 'High Expansion';
  checks.push({
    id: 'check-volatility',
    label: 'Volatility Compression Regime',
    passed: volPassed,
    actualValue: `${setup.atrPercent.toFixed(1)}% ATR (${setup.volatilityState})`,
    requiredCriteria: '< 7.0% ATR & non-blowoff',
    status: volPassed ? 'PASS' : 'WARN',
  });

  // Check 6: Market Session Alignment
  const isMarketOpen = setup.marketStatus === 'OPEN';
  checks.push({
    id: 'check-market-session',
    label: 'Market Session Timing',
    passed: true,
    actualValue: isMarketOpen ? '🟢 Session Live' : '🔴 Session Closed',
    requiredCriteria: isMarketOpen ? 'Direct Market Order' : 'Stage Limit Order for Open',
    status: isMarketOpen ? 'PASS' : 'WARN',
  });

  // Determine overall verdict
  const failCount = checks.filter(c => c.status === 'FAIL').length;
  const warnCount = checks.filter(c => c.status === 'WARN').length;

  let shouldTrade: 'TRADE_APPROVED' | 'REDUCED_SIZE' | 'DO_NOT_TRADE' = 'TRADE_APPROVED';
  let verdictBadge = '🟢 TRADE APPROVED';
  let verdictTitle = 'Favorable Quantitative Edge — Trade Approved';
  let verdictSummary = '';
  let recommendedSizeMultiplier = 1.0;

  if (failCount > 0) {
    shouldTrade = 'DO_NOT_TRADE';
    verdictBadge = '🔴 PASS / DO NOT TRADE';
    verdictTitle = 'Unfavorable Risk Profile — Do Not Take Trade';
    recommendedSizeMultiplier = 0.0;
    const failedLabels = checks.filter(c => c.status === 'FAIL').map(c => c.label).join(', ');
    verdictSummary = `Failed critical quantitative criteria: ${failedLabels}. Taking this trade would compromise portfolio capital preservation.`;
  } else if (warnCount >= 2 || !riskCapPassed || !confPassed) {
    shouldTrade = 'REDUCED_SIZE';
    verdictBadge = '🟡 TRADE WITH 0.5x SIZE';
    verdictTitle = 'Moderate Confluence — Trade with Reduced Capital';
    recommendedSizeMultiplier = 0.5;
    verdictSummary = `Criteria passed with caveats (${warnCount} cautionary metrics). Recommend entering at half position size (0.5x) to limit portfolio drawdown.`;
  } else {
    shouldTrade = 'TRADE_APPROVED';
    verdictBadge = '🟢 TRADE APPROVED';
    verdictTitle = 'High-Conviction Setup — Full Size Approved';
    recommendedSizeMultiplier = 1.0;
    verdictSummary = `All primary quantitative criteria satisfied: R:R of ${analysis.rewardToRisk.toFixed(2)}:1, positive EV (+${analysis.expectedValue.toFixed(2)}), pristine trend confluence, and ample portfolio risk buffer.`;
  }

  const recommendedShares = Math.floor(analysis.fixedRiskShares * recommendedSizeMultiplier);
  const recommendedRiskDollars = Math.round(analysis.riskDollars * recommendedSizeMultiplier);

  return {
    portfolioEquity: settings.portfolioEquity,
    maxPortfolioRiskPercent: settings.maxPortfolioRiskPercent,
    currentOpenRiskPercent: settings.currentOpenRiskPercent,
    availableRiskPercent: Math.round(availableRiskPercent * 10) / 10,
    tradeRiskPercent: Math.round(tradeRiskPercent * 10) / 10,
    postTradeTotalRiskPercent: Math.round(postTradeTotalRiskPercent * 10) / 10,
    maxSectorExposurePercent: settings.maxSectorExposurePercent,
    shouldTrade,
    verdictBadge,
    verdictTitle,
    verdictSummary,
    recommendedSizeMultiplier,
    recommendedShares,
    recommendedRiskDollars,
    checks,
  };
}
