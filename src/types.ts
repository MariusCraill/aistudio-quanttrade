export interface CandleData {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CalculatedIndicators {
  sma20: (number | null)[];
  sma50: (number | null)[];
  sma200: (number | null)[];
  rsi14: (number | null)[];
  atr14: (number | null)[];
  atrMa20: (number | null)[]; // 20-day moving average of ATR(14)
  high20: (number | null)[];
  volSma20: (number | null)[];
}

export type SetupType = 'MOMENTUM_BREAKOUT' | 'MEAN_REVERSION_PULLBACK';
export type TradeHorizon = 'SWING' | 'POSITION';
export type StopLossType = 'STRUCTURAL_SWING_LOW' | 'ATR_2X';

export interface MarketStatusInfo {
  exchange: 'JSE' | 'US';
  exchangeName: string;
  isOpen: boolean;
  statusText: string;
  timezone: string;
  localTime: string;
  tradingHours: string;
  message: string;
}

export interface TradeSetup {
  id: string;
  symbol: string;
  name: string;
  date: string;
  setupType: SetupType;
  horizon: TradeHorizon;
  currentPrice: number;
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  stopLossType: StopLossType;
  atr14: number;
  swingLow: number;
  riskAmount: number; // Entry - Stop
  rewardAmount: number; // Target - Entry
  rewardToRisk: number; // (Target - Entry) / (Entry - Stop)
  trendQualityScore: number; // 0 - 100
  confluenceScore: number; // 0 - 100
  volatilityState: 'Low Compression' | 'Normal' | 'High Expansion';
  atrPercent: number;
  atrMa20?: number; // 20-day moving average of ATR
  volatilitySurgeRatio?: number; // current ATR / atrMa20
  isAtrSurgeActive?: boolean; // true when current ATR > atrMa20
  volatilityAlert?: VolatilityAlert;
  estimatedDuration: string; // e.g. "3 - 15 Days (Swing)" or "3 Weeks - 3 Months (Position)"
  triggerDescription: string;
  confluenceFactors: string[];
  exchange?: 'JSE' | 'US';
  currency?: 'ZAR' | 'ZAc' | 'USD';
  currencySymbol?: string;
  marketStatus?: 'OPEN' | 'CLOSED';
  marketStatusText?: string;
  marketHours?: string;
  marketMessage?: string;
}

export interface RiskAnalysis {
  accountEquity: number;
  riskPercent: number; // e.g. 1% or 2%
  riskDollars: number; // Equity * (riskPercent / 100)
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  rewardToRisk: number; // R
  isValidRR: boolean; // >= 2.0
  estimatedWinRate: number; // W (0 - 1, e.g. 0.45)
  expectedValue: number; // EV per dollar risked: (W * R) - (1 - W)
  expectedProfitPerTrade: number; // EV * riskDollars
  breakEvenWinRate: number; // 1 / (1 + R)
  fullKellyPercent: number; // W - ((1 - W) / R)
  halfKellyPercent: number; // Kelly / 2
  quarterKellyPercent: number;
  kellyShares: number;
  kellyCapital: number;
  fixedRiskShares: number;
  fixedRiskCapital: number;
  fixedRiskPercentOfEquity: number;
  projectedProfit: number; // (Target - Entry) * fixedRiskShares
  projectedLoss: number; // (Entry - Stop) * fixedRiskShares
  currencySymbol?: string;
}

export interface BacktestTrade {
  id: string;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  target: number;
  setupType: SetupType;
  outcome: 'WIN' | 'LOSS' | 'TIME_EXIT';
  pnlDollars: number;
  pnlR: number; // in units of R (e.g. +2.0 or -1.0)
  holdingDays: number;
  exitReason: string;
}

export interface BacktestSummary {
  totalTrades: number;
  wins: number;
  losses: number;
  timeExits: number;
  winRate: number; // e.g. 0.52
  lossRate: number;
  averageRewardToRisk: number;
  expectedValue: number;
  profitFactor: number;
  totalPnlR: number;
  maxDrawdownR: number;
  sharpeRatio: number;
  trades: BacktestTrade[];
  equityCurve: { date: string; equityR: number; capital: number }[];
}

export interface SavedJournalEntry {
  id: string;
  createdAt: string;
  symbol: string;
  setupType: SetupType;
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  rewardToRisk: number;
  expectedValue: number;
  shares: number;
  riskDollars: number;
  status: 'PLANNED' | 'EXECUTED' | 'WON' | 'LOST' | 'CANCELLED';
  notes: string;
  actualExitPrice?: number;
  actualPnl?: number;
  currencySymbol?: string;
  exchange?: string;
}

export interface TargetDurationMilestone {
  label: string;
  targetPrice: number;
  tradingDays: number;
  targetDate: string;
  description: string;
}

export interface TargetDurationProjection {
  expectedTradingDays: number;
  expectedTargetDate: string;
  fastTradingDays: number;
  fastTargetDate: string;
  slowTradingDays: number;
  slowTargetDate: string;
  dailyExpectedDrift: number;
  atrDollars: number;
  atrPercent: number;
  maxHoldingPeriodDays: number;
  maxHoldingPeriodDate: string;
  milestones: TargetDurationMilestone[];
  targetGainPercent: number;
  targetVelocityDescription: string;
}

export interface PortfolioCheckItem {
  id: string;
  label: string;
  passed: boolean;
  actualValue: string;
  requiredCriteria: string;
  status: 'PASS' | 'WARN' | 'FAIL';
}

export interface PortfolioEvaluation {
  portfolioEquity: number;
  maxPortfolioRiskPercent: number;
  currentOpenRiskPercent: number;
  availableRiskPercent: number;
  tradeRiskPercent: number;
  postTradeTotalRiskPercent: number;
  maxSectorExposurePercent: number;
  shouldTrade: 'TRADE_APPROVED' | 'REDUCED_SIZE' | 'DO_NOT_TRADE';
  verdictBadge: string;
  verdictTitle: string;
  verdictSummary: string;
  recommendedSizeMultiplier: number;
  recommendedShares: number;
  recommendedRiskDollars: number;
  checks: PortfolioCheckItem[];
}

export interface AITradeAnalysis {
  verdict: 'STRONG_TRADE' | 'MODERATE_TRADE' | 'WAIT_PULLBACK' | 'PASS';
  verdictTitle: string;
  confidenceScore: number;
  targetTimelineVerdict: string;
  targetReachDateEstimate: string;
  bullishThesis: string[];
  bearishRisks: string[];
  portfolioRecommendation: string;
  executionGuidance: string;
  timestamp: string;
  isAiGenerated: boolean;
}

export interface AIRankedTradeOption {
  symbol: string;
  name: string;
  exchange: 'JSE' | 'US';
  currencySymbol: string;
  setupType: SetupType;
  rank: number;
  score: number;
  actionTag: 'STRONG_BUY' | 'ACCUMULATE' | 'WATCH_DIP' | 'PASS';
  expectedDaysToTarget: number;
  targetDate: string;
  rewardToRisk: number;
  shouldTradeVerdict: string;
  rationale: string;
}

export type VolatilityAlertSeverity = 'ELEVATED' | 'HIGH' | 'EXTREME_ANOMALY';

export type VolatilitySignalType =
  | 'BULLISH_BREAKOUT_VOLATILITY'
  | 'BEARISH_EXPANSION_VOLATILITY'
  | 'VOLATILITY_ANOMALY'
  | 'COMPRESSION';

export interface VolatilityAlert {
  id: string;
  symbol: string;
  name: string;
  exchange: 'JSE' | 'US';
  currencySymbol: string;
  currentPrice: number;
  priceChangePercent: number;
  currentAtr: number; // Current 14-period ATR
  atrMa20: number; // 20-day moving average of ATR
  surgeRatio: number; // currentAtr / atrMa20 (e.g. 1.35x)
  surgePercent: number; // ((currentAtr - atrMa20) / atrMa20) * 100 (e.g. +35%)
  severity: VolatilityAlertSeverity;
  signalType: VolatilitySignalType;
  signalTitle: string;
  signalDescription: string;
  isBreakout: boolean;
  isAnomaly: boolean;
  detectedAt: string;
  marketStatus: 'OPEN' | 'CLOSED';
  isDismissed?: boolean;
}

export interface VolatilityRadarReport {
  timestamp: string;
  totalMonitored: number;
  activeSurgeCount: number;
  averageSurgePercent: number;
  marketRegime: 'VOLATILITY_EXPANSION' | 'VOLATILITY_COMPRESSION' | 'NORMAL';
  regimeSummary: string;
  topAnomaly: VolatilityAlert | null;
  alerts: VolatilityAlert[];
}

export type LiveSignalVerdict =
  | 'BUY_NOW'
  | 'SELL_NOW'
  | 'ACCUMULATE'
  | 'TAKE_PROFIT'
  | 'NEUTRAL_HOLD';

export interface LiveIndicatorValues {
  rsi14: number;
  rsiStatus: 'OVERSOLD' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'OVERBOUGHT';
  ema9: number;
  ema21: number;
  emaAlignment: 'BULLISH_STACK' | 'BEARISH_STACK' | 'NEUTRAL';
  sma200: number | null;
  trendRegime: 'BULL_MARKET' | 'BEAR_MARKET';
  macdLine: number;
  macdSignal: number;
  macdHist: number;
  macdMomentum: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'EXPANDING_MOMENTUM' | 'WEAKENING';
  atr14: number;
  atrPercent: number;
  volumeRatio20: number;
  currentPrice: number;
  priceChangePercent: number;
}

export interface AILiveSignalAlert {
  id: string;
  symbol: string;
  name: string;
  exchange: 'JSE' | 'US';
  currencySymbol: string;
  verdict: LiveSignalVerdict;
  signalHeadline: string;
  confidenceScore: number; // 0-100
  urgency: 'IMMEDIATE' | 'ACTIVE_WATCH' | 'PASS';
  currentPrice: number;
  suggestedTriggerPrice: number;
  suggestedStopLoss: number;
  suggestedTargetPrice: number;
  rewardToRisk: number;
  keyReasons: string[];
  indicators: LiveIndicatorValues;
  timestamp: string;
  isAiGenerated: boolean;
  soundPlayed?: boolean;
}


