import { useState, useMemo, useEffect } from 'react';
import {
  TradeSetup,
  RiskAnalysis,
  StopLossType,
  AITradeAnalysis,
  CandleData,
} from '../types';
import { computeCompleteRiskAnalysis } from '../utils/quantMath';
import { evaluateVolatilitySurge } from '../utils/technicalIndicators';
import {
  calculateTargetDuration,
  evaluatePortfolioSuitability,
  PortfolioSettings,
} from '../services/targetDurationService';
import { analyzeSetupWithAI } from '../services/aiTradeService';
import {
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  Percent,
  Clock,
  BookmarkPlus,
  Scale,
  Sparkles,
  BrainCircuit,
  Calendar,
  AlertTriangle,
  Check,
  X,
  Gauge,
  Briefcase,
  RefreshCw,
  Zap,
  Flame,
  ExternalLink,
} from 'lucide-react';
import { getYahooFinanceChartUrl } from '../utils/marketUrls';

interface TradeAnalyzerProps {
  setup: TradeSetup | null;
  candles?: CandleData[];
  onUpdateSetup?: (updated: Partial<TradeSetup>) => void;
  onSaveToJournal?: (analysis: RiskAnalysis, setup: TradeSetup) => void;
  backtestWinRate?: number;
}

export default function TradeAnalyzer({
  setup,
  candles,
  onUpdateSetup,
  onSaveToJournal,
  backtestWinRate,
}: TradeAnalyzerProps) {
  // Configurable parameters
  const [accountEquity, setAccountEquity] = useState<number>(50000);
  const [riskPercent, setRiskPercent] = useState<number>(1.5);
  const [winRateInput, setWinRateInput] = useState<number>(
    backtestWinRate ? Math.round(backtestWinRate * 100) : 48
  );
  const [targetMultiplier, setTargetMultiplier] = useState<number>(2.5);
  const [customEntry, setCustomEntry] = useState<number>(setup?.entryPrice ?? 150);
  const [customStop, setCustomStop] = useState<number>(setup?.stopLossPrice ?? 144);
  const [customTarget, setCustomTarget] = useState<number>(setup?.targetPrice ?? 165);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Portfolio Management Parameters
  const [maxPortfolioRisk, setMaxPortfolioRisk] = useState<number>(5.0);
  const [currentOpenRisk, setCurrentOpenRisk] = useState<number>(2.0);
  const [maxSectorExposure, setMaxSectorExposure] = useState<number>(20.0);

  // AI Analysis State
  const [aiAnalysis, setAiAnalysis] = useState<AITradeAnalysis | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Sync with setup when it changes
  useEffect(() => {
    if (setup) {
      setCustomEntry(setup.entryPrice);
      setCustomStop(setup.stopLossPrice);
      setCustomTarget(setup.targetPrice);
      // Reset or auto-clear old AI analysis on ticker switch
      setAiAnalysis(null);
      setAiError(null);
    }
  }, [setup?.symbol, setup?.id]);

  const isJSE = setup?.exchange === 'JSE' || setup?.symbol.endsWith('.JO');
  const currSym = setup?.currencySymbol || (isJSE ? 'R' : '$');
  const isClosed = setup?.marketStatus === 'CLOSED';

  // Compute quantitative risk metrics
  const analysis: RiskAnalysis = useMemo(() => {
    return computeCompleteRiskAnalysis({
      accountEquity: Number(accountEquity) || 10000,
      riskPercent: Number(riskPercent) || 1,
      entryPrice: Number(customEntry) || 100,
      stopLossPrice: Number(customStop) || 95,
      targetPrice: Number(customTarget) || 110,
      estimatedWinRate: (Number(winRateInput) || 50) / 100,
    });
  }, [accountEquity, riskPercent, customEntry, customStop, customTarget, winRateInput]);

  // Current effective setup for duration & portfolio evaluation
  const activeSetup: TradeSetup | null = useMemo(() => {
    if (!setup) return null;
    return {
      ...setup,
      entryPrice: customEntry,
      stopLossPrice: customStop,
      targetPrice: customTarget,
      rewardToRisk: analysis.rewardToRisk,
    };
  }, [setup, customEntry, customStop, customTarget, analysis.rewardToRisk]);

  // Compute Target Duration Projections
  const durationProjection = useMemo(() => {
    if (!activeSetup) return null;
    return calculateTargetDuration(activeSetup);
  }, [activeSetup]);

  // Compute Portfolio Suitability & "Should I Trade?" decision
  const portfolioSettings: PortfolioSettings = useMemo(() => ({
    portfolioEquity: accountEquity,
    maxPortfolioRiskPercent: maxPortfolioRisk,
    currentOpenRiskPercent: currentOpenRisk,
    maxSectorExposurePercent: maxSectorExposure,
    currentSectorExposurePercent: 8.0,
  }), [accountEquity, maxPortfolioRisk, currentOpenRisk, maxSectorExposure]);

  const portfolioEvaluation = useMemo(() => {
    if (!activeSetup) return null;
    return evaluatePortfolioSuitability(activeSetup, analysis, portfolioSettings);
  }, [activeSetup, analysis, portfolioSettings]);

  // Real-Time Volatility Surge & 20-Day ATR Moving Average Evaluation
  const volatilityEvaluation = useMemo(() => {
    if (candles && candles.length >= 35 && setup) {
      return evaluateVolatilitySurge(
        candles,
        setup.symbol,
        setup.name,
        isJSE ? 'JSE' : 'US',
        currSym,
        setup.marketStatus
      );
    }
    // Fallback if candles array not provided directly: use setup indicators
    if (setup && setup.atr14 && setup.atrMa20) {
      const surgeRatio = Number((setup.atr14 / setup.atrMa20).toFixed(2));
      const surgePercent = Number((((setup.atr14 - setup.atrMa20) / setup.atrMa20) * 100).toFixed(1));
      return {
        currentAtr: setup.atr14,
        atrMa20: setup.atrMa20,
        surgeRatio,
        surgePercent,
        isSurgeActive: Boolean(setup.isAtrSurgeActive ?? (setup.atr14 > setup.atrMa20)),
        alert: setup.volatilityAlert ?? null,
      };
    }
    return null;
  }, [candles, setup, isJSE, currSym]);

  // Trigger AI Analysis
  const handleRunAiAnalysis = async () => {
    if (!activeSetup) return;
    setIsAiLoading(true);
    setAiError(null);
    try {
      const result = await analyzeSetupWithAI(
        activeSetup,
        analysis,
        durationProjection || undefined,
        portfolioEvaluation || undefined
      );
      setAiAnalysis(result);
    } catch (err: any) {
      setAiError(err.message || 'AI analysis failed');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleStopPreset = (type: StopLossType) => {
    if (!setup) return;
    let newStop = setup.stopLossPrice;
    if (type === 'ATR_2X') {
      newStop = Number((customEntry - 2 * setup.atr14).toFixed(2));
    } else {
      newStop = Number((setup.swingLow * 0.995).toFixed(2));
    }
    setCustomStop(newStop);
    const newRisk = customEntry - newStop;
    const newTarget = Number((customEntry + targetMultiplier * newRisk).toFixed(2));
    setCustomTarget(newTarget);
    onUpdateSetup?.({ stopLossPrice: newStop, targetPrice: newTarget, stopLossType: type });
  };

  const handleMultiplierPreset = (mult: number) => {
    setTargetMultiplier(mult);
    const risk = customEntry - customStop;
    if (risk > 0) {
      const newTarget = Number((customEntry + mult * risk).toFixed(2));
      setCustomTarget(newTarget);
      onUpdateSetup?.({ targetPrice: newTarget });
    }
  };

  const handleSave = () => {
    if (activeSetup) {
      onSaveToJournal?.(analysis, activeSetup);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2400);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Market Status Alert Banner */}
      {isClosed ? (
        <div className="p-3.5 bg-rose-950/40 border border-rose-800/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2.5 text-rose-300">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
            <div>
              <strong className="font-bold text-rose-200">Market is Closed:</strong>{' '}
              <span>
                {setup?.exchange === 'JSE' ? 'Johannesburg Stock Exchange (JSE)' : 'US Markets (NYSE/NASDAQ)'} is currently closed.
                {setup?.marketMessage ? ` ${setup.marketMessage}` : ' Displaying official session close. Staging orders for next session.'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {setup?.symbol && (
              <a
                href={getYahooFinanceChartUrl(setup.symbol)}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${setup.symbol} chart in Yahoo Finance`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-950/70 hover:bg-purple-900 border border-purple-800 text-purple-300 hover:text-purple-100 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                <span className="font-black text-[10px] bg-purple-600 text-white px-1 rounded">Y!</span>
                <span>Yahoo Chart</span>
                <ExternalLink className="w-3 h-3 text-purple-400" />
              </a>
            )}
            <span className="px-2.5 py-0.5 rounded bg-rose-900/60 border border-rose-700/60 text-rose-200 text-[11px] font-bold shrink-0">
              STAGE FOR MARKET OPEN
            </span>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-emerald-950/30 border border-emerald-800/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2.5 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 animate-pulse"></span>
            <div>
              <strong className="font-bold text-emerald-200">Market is Open:</strong>{' '}
              <span>Live trading session active for {setup?.symbol}. Real-time execution parameters and live pricing.</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {setup?.symbol && (
              <a
                href={getYahooFinanceChartUrl(setup.symbol)}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${setup.symbol} chart in Yahoo Finance`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-950/70 hover:bg-purple-900 border border-purple-800 text-purple-300 hover:text-purple-100 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                <span className="font-black text-[10px] bg-purple-600 text-white px-1 rounded">Y!</span>
                <span>Yahoo Chart</span>
                <ExternalLink className="w-3 h-3 text-purple-400" />
              </a>
            )}
            <span className="px-2.5 py-0.5 rounded bg-emerald-900/60 border border-emerald-700/60 text-emerald-200 text-[11px] font-bold shrink-0 animate-pulse">
              LIVE SESSION ACTIVE
            </span>
          </div>
        </div>
      )}

      {/* Top Card: Quick Status & R:R Rule Compliance */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* R:R Ratio Card */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
            analysis.isValidRR
              ? 'bg-slate-900/90 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
              : 'bg-rose-950/20 border-rose-600/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Reward-to-Risk (R:R)</span>
            {analysis.isValidRR ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Valid &ge; 2.0
              </span>
            ) : (
              <span className="flex items-center gap-1 text-rose-400 font-medium text-[11px]">
                <ShieldAlert className="w-3.5 h-3.5" /> Invalid &lt; 2.0
              </span>
            )}
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span
              className={`text-3xl font-extrabold font-mono ${
                analysis.isValidRR ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {analysis.rewardToRisk.toFixed(2)} : 1
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            {analysis.isValidRR
              ? `Requires only ${(analysis.breakEvenWinRate * 100).toFixed(1)}% win rate to break even.`
              : 'Rule: Never enter a setup where R:R < 2.0.'}
          </p>
        </div>

        {/* Expected Value (EV) Card */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            analysis.expectedValue > 0
              ? 'bg-slate-900/90 border-cyan-500/30'
              : 'bg-rose-950/20 border-rose-800/40'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Expected Value (EV)</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                analysis.expectedValue > 0 ? 'bg-cyan-950 text-cyan-300' : 'bg-rose-950 text-rose-300'
              }`}
            >
              {analysis.expectedValue > 0 ? 'Statistical Edge' : 'Negative Edge'}
            </span>
          </div>
          <div className="my-2">
            <span
              className={`text-3xl font-extrabold font-mono ${
                analysis.expectedValue > 0 ? 'text-cyan-400' : 'text-rose-400'
              }`}
            >
              {analysis.expectedValue > 0 ? '+' : ''}
              {analysis.expectedValue.toFixed(3)}
            </span>
            <span className="text-xs text-slate-400 ml-1.5 font-mono">per $1 risked</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Expected profit: <strong className="text-slate-200">{currSym}{analysis.expectedProfitPerTrade.toFixed(2)}</strong> per trade.
          </p>
        </div>

        {/* Target Arrival ETA Card */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Target Arrival
            </span>
            <span className="text-[10px] text-amber-400 font-mono font-bold">
              ~{durationProjection?.expectedTradingDays ?? 12} Sessions
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold font-mono text-amber-300">
              {durationProjection?.expectedTargetDate ?? 'Next 2 Weeks'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Range: {durationProjection?.fastTradingDays}-{durationProjection?.slowTradingDays} days</span>
            <span className="text-slate-300">+{durationProjection?.targetGainPercent}% gain</span>
          </div>
        </div>

        {/* Portfolio Should I Trade Card */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            portfolioEvaluation?.shouldTrade === 'TRADE_APPROVED'
              ? 'bg-slate-900/90 border-emerald-500/40'
              : portfolioEvaluation?.shouldTrade === 'REDUCED_SIZE'
              ? 'bg-slate-900/90 border-amber-500/40'
              : 'bg-rose-950/20 border-rose-800/40'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-cyan-400" /> Should I Trade?
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {portfolioEvaluation?.tradeRiskPercent.toFixed(1)}% Portfolio Heat
            </span>
          </div>
          <div className="my-2">
            <span
              className={`text-lg font-extrabold font-mono ${
                portfolioEvaluation?.shouldTrade === 'TRADE_APPROVED'
                  ? 'text-emerald-400'
                  : portfolioEvaluation?.shouldTrade === 'REDUCED_SIZE'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {portfolioEvaluation?.verdictBadge ?? 'CALCULATING'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Size: {portfolioEvaluation?.recommendedSizeMultiplier === 1 ? '1.0x Full' : portfolioEvaluation?.recommendedSizeMultiplier === 0.5 ? '0.5x Half' : '0.0x Pass'}</span>
            <span className="text-slate-300">{portfolioEvaluation?.recommendedShares} shares</span>
          </div>
        </div>
      </div>

      {/* REAL-TIME VOLATILITY SURGE & 20-DAY ATR MOVING AVERAGE RADAR CARD */}
      {volatilityEvaluation && (
        <div
          className={`rounded-xl p-4.5 border transition-all ${
            volatilityEvaluation.isSurgeActive
              ? volatilityEvaluation.alert?.severity === 'EXTREME_ANOMALY'
                ? 'bg-rose-950/20 border-rose-600/60 shadow-[0_0_20px_rgba(244,63,94,0.12)]'
                : 'bg-amber-950/20 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.12)]'
              : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3 mb-3.5">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2 rounded-lg border ${
                  volatilityEvaluation.isSurgeActive
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                <Zap className={`w-4 h-4 ${volatilityEvaluation.isSurgeActive ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-100 text-sm">
                    Real-Time Volatility Alert &amp; ATR Moving Average Engine
                  </h4>
                  {volatilityEvaluation.isSurgeActive ? (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase flex items-center gap-1 ${
                        volatilityEvaluation.alert?.severity === 'EXTREME_ANOMALY'
                          ? 'bg-rose-950 text-rose-300 border border-rose-700 animate-pulse'
                          : 'bg-amber-950 text-amber-300 border border-amber-600 animate-pulse'
                      }`}
                    >
                      <Flame className="w-3 h-3" />
                      ATR SURGE ACTIVE: +{volatilityEvaluation.surgePercent}% &gt; 20d MA
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-400">
                      NORMAL COMPRESSION (ATR &le; 20d MA)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {volatilityEvaluation.isSurgeActive
                    ? 'Current 14-period Average True Range exceeds the 20-day moving average benchmark, signaling breakout kinetic fuel.'
                    : 'Asset is currently in a steady volatility regime. Target timelines track standard drift rates.'}
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 font-mono text-xs">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase block">Current ATR(14)</span>
                <span className="font-bold text-amber-300 text-sm">
                  {currSym}{volatilityEvaluation.currentAtr.toFixed(2)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase block">20-Day ATR MA</span>
                <span className="font-bold text-slate-200 text-sm">
                  {currSym}{volatilityEvaluation.atrMa20.toFixed(2)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase block">Surge Ratio</span>
                <span
                  className={`font-bold text-sm ${
                    volatilityEvaluation.isSurgeActive ? 'text-amber-400' : 'text-slate-400'
                  }`}
                >
                  {volatilityEvaluation.surgeRatio.toFixed(2)}x
                </span>
              </div>
            </div>
          </div>

          {/* Visual Ratio Indicator & Signal Details */}
          {volatilityEvaluation.isSurgeActive && volatilityEvaluation.alert && (
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    volatilityEvaluation.alert.signalType === 'BULLISH_BREAKOUT_VOLATILITY'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : volatilityEvaluation.alert.signalType === 'BEARISH_EXPANSION_VOLATILITY'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}
                >
                  {volatilityEvaluation.alert.signalTitle}
                </span>
                <span className="text-slate-300 text-[11px]">
                  {volatilityEvaluation.alert.signalDescription}
                </span>
              </div>

              <div className="text-[11px] font-mono text-amber-300/90 flex items-center gap-1">
                <span>Velocity Impact:</span>
                <strong className="text-amber-200">Accelerates Target Arrival by ~25-40%</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 1: TARGET DURATION & MILESTONES (When Targets Are Going to Be Met) */}
      {durationProjection && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                  Trade Duration &amp; Target Arrival Forecast
                  <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-[10px] font-mono text-amber-300">
                    Quant Velocity Model
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Calculated based on 14-day Average True Range ({currSym}{durationProjection.atrDollars.toFixed(2)} / {durationProjection.atrPercent.toFixed(1)}% daily movement)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">
                Daily Expected Price Drift: <strong className="text-slate-200">{currSym}{durationProjection.dailyExpectedDrift.toFixed(2)}</strong> / day
              </span>
            </div>
          </div>

          {/* Forecast Scenarios Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> High Momentum (Fast)
                </span>
                <span className="font-mono text-emerald-400/90 text-[11px]">{durationProjection.fastTradingDays} sessions</span>
              </div>
              <div className="text-base font-bold font-mono text-slate-100 my-1">
                {durationProjection.fastTargetDate}
              </div>
              <p className="text-[11px] text-slate-400">
                Assumes rapid breakout velocity at ~0.70x daily ATR expansion.
              </p>
            </div>

            <div className="p-3.5 bg-amber-950/20 border border-amber-800/40 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-amber-300 font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Base Rate (Expected)
                </span>
                <span className="font-mono text-amber-300 text-[11px] font-bold">{durationProjection.expectedTradingDays} sessions</span>
              </div>
              <div className="text-base font-bold font-mono text-amber-200 my-1">
                {durationProjection.expectedTargetDate}
              </div>
              <p className="text-[11px] text-slate-400">
                Normal two-steps-forward, one-step-back swing drift with consolidation.
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400 font-semibold flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5" /> High Resistance (Slow)
                </span>
                <span className="font-mono text-slate-400 text-[11px]">{durationProjection.slowTradingDays} sessions</span>
              </div>
              <div className="text-base font-bold font-mono text-slate-300 my-1">
                {durationProjection.slowTargetDate}
              </div>
              <p className="text-[11px] text-slate-400">
                Chop / grinding price action through heavy resistance zones.
              </p>
            </div>
          </div>

          {/* Visual Milestone Road Map */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Target Milestone Checkpoints
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {durationProjection.milestones.map((ms, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-950 border border-slate-800/90 rounded-lg flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-cyan-300">
                      Step {idx + 1}: {ms.label}
                    </span>
                    <span className="text-xs font-mono text-emerald-400 font-bold">
                      {currSym}{ms.targetPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="my-1.5 flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-slate-200">{ms.targetDate}</span>
                    <span className="text-[11px] font-mono text-slate-400">~{ms.tradingDays} trading days</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {ms.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Time Stop Cutoff Banner */}
          <div className="mt-4 p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <strong>Time-Decay Stop (Max Holding Cutoff):</strong> If target is not reached by{' '}
              <span className="text-amber-300 font-mono font-bold">{durationProjection.maxHoldingPeriodDate}</span> (~{durationProjection.maxHoldingPeriodDays} days), close trade to release capital.
            </span>
            <span className="font-mono text-[10px] text-slate-500">Edge Decay Threshold</span>
          </div>
        </div>
      )}

      {/* SECTION 2: AI TRADE ANALYST & OPTIONS ADVICE */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                Gemini AI Trade Analyst
                <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-[10px] font-mono text-indigo-300">
                  Gemini 3.8 Flash
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Deep AI trade options analysis, duration feasibility audit, and portfolio recommendation
              </p>
            </div>
          </div>

          <button
            id="btn-run-ai-analysis"
            onClick={handleRunAiAnalysis}
            disabled={isAiLoading || !setup}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
          >
            {isAiLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Analyzing Trade with AI...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                {aiAnalysis ? 'Re-Analyze with AI' : 'Run AI Trade Analysis'}
              </>
            )}
          </button>
        </div>

        {aiError && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-lg text-xs text-rose-300 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{aiError}</span>
          </div>
        )}

        {aiAnalysis ? (
          <div className="space-y-4">
            {/* Top AI Verdict Banner */}
            <div className="p-4 bg-slate-950 border border-indigo-900/60 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                      aiAnalysis.verdict === 'STRONG_TRADE'
                        ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                        : aiAnalysis.verdict === 'MODERATE_TRADE'
                        ? 'bg-amber-950 border border-amber-700 text-amber-300'
                        : 'bg-rose-950 border border-rose-700 text-rose-300'
                    }`}
                  >
                    AI VERDICT: {aiAnalysis.verdict.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Conviction Score: <strong className="text-cyan-300">{aiAnalysis.confidenceScore}%</strong>
                  </span>
                  {aiAnalysis.isAiGenerated && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800">
                      Live Gemini AI
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-bold text-slate-100">{aiAnalysis.verdictTitle}</h4>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 block">Estimated Target Reach</span>
                <span className="text-sm font-mono font-bold text-amber-300">
                  {aiAnalysis.targetReachDateEstimate}
                </span>
              </div>
            </div>

            {/* Target Timeline Assessment & Execution Guidance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 mb-1.5">
                  <Clock className="w-3.5 h-3.5" /> Target Timeline Feasibility Audit
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {aiAnalysis.targetTimelineVerdict}
                </p>
              </div>

              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300 mb-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> AI Portfolio &amp; Execution Guidance
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {aiAnalysis.executionGuidance}
                </p>
              </div>
            </div>

            {/* Bullish Thesis vs Bearish Risks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 bg-emerald-950/15 border border-emerald-800/40 rounded-lg">
                <h5 className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Bullish Thesis &amp; Target Drivers
                </h5>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {aiAnalysis.bullishThesis.map((thesis, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold shrink-0">•</span>
                      <span>{thesis}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3.5 bg-rose-950/15 border border-rose-800/40 rounded-lg">
                <h5 className="text-xs font-bold text-rose-400 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Bearish Invalidation Risks
                </h5>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {aiAnalysis.bearishRisks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-rose-400 font-bold shrink-0">•</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-950/50 border border-dashed border-slate-800 rounded-xl text-center flex flex-col items-center justify-center gap-2">
            <BrainCircuit className="w-8 h-8 text-indigo-400/60" />
            <span className="text-xs font-semibold text-slate-300">
              AI Quantitative Option Analysis Ready
            </span>
            <p className="text-xs text-slate-500 max-w-md">
              Click &quot;Run AI Trade Analysis&quot; to have Gemini 3.8 Flash evaluate the risk/reward, verify when profit targets will realistically be met, and generate portfolio recommendations.
            </p>
          </div>
        )}
      </div>

      {/* SECTION 3: PORTFOLIO & "SHOULD I TRADE?" ENGINE */}
      {portfolioEvaluation && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                  Portfolio Allocation &amp; Should I Trade? Decision Engine
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      portfolioEvaluation.shouldTrade === 'TRADE_APPROVED'
                        ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                        : portfolioEvaluation.shouldTrade === 'REDUCED_SIZE'
                        ? 'bg-amber-950 border border-amber-800 text-amber-300'
                        : 'bg-rose-950 border border-rose-800 text-rose-300'
                    }`}
                  >
                    {portfolioEvaluation.verdictBadge}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Comprehensive risk capacity check and portfolio heat simulator
                </p>
              </div>
            </div>

            {/* Configurable Portfolio Inputs */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                <span className="text-slate-400">Portfolio Max Risk:</span>
                <input
                  type="number"
                  value={maxPortfolioRisk}
                  onChange={e => setMaxPortfolioRisk(Math.max(1, Number(e.target.value)))}
                  className="w-12 bg-transparent text-slate-100 text-right focus:outline-none focus:text-cyan-400 font-bold"
                  step={0.5}
                />
                <span className="text-slate-400">%</span>
              </div>

              <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                <span className="text-slate-400">Current Open Risk:</span>
                <input
                  type="number"
                  value={currentOpenRisk}
                  onChange={e => setCurrentOpenRisk(Math.max(0, Number(e.target.value)))}
                  className="w-12 bg-transparent text-slate-100 text-right focus:outline-none focus:text-cyan-400 font-bold"
                  step={0.5}
                />
                <span className="text-slate-400">%</span>
              </div>
            </div>
          </div>

          {/* Portfolio Verdict Card */}
          <div
            className={`p-4 rounded-xl border mb-5 ${
              portfolioEvaluation.shouldTrade === 'TRADE_APPROVED'
                ? 'bg-emerald-950/20 border-emerald-700/50'
                : portfolioEvaluation.shouldTrade === 'REDUCED_SIZE'
                ? 'bg-amber-950/20 border-amber-700/50'
                : 'bg-rose-950/20 border-rose-700/50'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-sm font-bold text-slate-100 flex items-center gap-2">
                {portfolioEvaluation.shouldTrade === 'TRADE_APPROVED' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : portfolioEvaluation.shouldTrade === 'REDUCED_SIZE' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                )}
                {portfolioEvaluation.verdictTitle}
              </span>
              <span className="text-xs font-mono text-slate-300 font-bold">
                Recommended Allocation: {currSym}{portfolioEvaluation.recommendedRiskDollars} Risk ({portfolioEvaluation.recommendedShares} shares)
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {portfolioEvaluation.verdictSummary}
            </p>
          </div>

          {/* Portfolio Risk Meter */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl mb-5">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-400 font-medium">Portfolio Risk Heat (Pre vs Post Trade)</span>
              <span className="font-mono text-xs">
                <span className="text-cyan-400 font-bold">{portfolioEvaluation.currentOpenRiskPercent}%</span>
                {' + '}
                <span className="text-amber-400 font-bold">{portfolioEvaluation.tradeRiskPercent}%</span>
                {' = '}
                <strong
                  className={
                    portfolioEvaluation.postTradeTotalRiskPercent > portfolioEvaluation.maxPortfolioRiskPercent
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }
                >
                  {portfolioEvaluation.postTradeTotalRiskPercent}%
                </strong>
                <span className="text-slate-500"> / {portfolioEvaluation.maxPortfolioRiskPercent}% Cap</span>
              </span>
            </div>

            {/* Visual Bar */}
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${Math.min(100, (currentOpenRisk / maxPortfolioRisk) * 100)}%` }}
                className="bg-cyan-500 h-full"
                title={`Current Open Risk: ${currentOpenRisk}%`}
              ></div>
              <div
                style={{
                  width: `${Math.min(
                    100 - (currentOpenRisk / maxPortfolioRisk) * 100,
                    (portfolioEvaluation.tradeRiskPercent / maxPortfolioRisk) * 100
                  )}%`,
                }}
                className="bg-amber-400 h-full"
                title={`This Trade Risk: ${portfolioEvaluation.tradeRiskPercent}%`}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1.5">
              <span>0% Risk</span>
              <span>Available Risk Buffer: {portfolioEvaluation.availableRiskPercent}%</span>
              <span>{maxPortfolioRisk}% Max Risk Cap</span>
            </div>
          </div>

          {/* 6-Point Viability Scorecard */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Quant Viability Scorecard
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {portfolioEvaluation.checks.map(chk => (
                <div
                  key={chk.id}
                  className={`p-3 rounded-lg border flex flex-col justify-between text-xs ${
                    chk.status === 'PASS'
                      ? 'bg-slate-950 border-emerald-900/40 text-slate-300'
                      : chk.status === 'WARN'
                      ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                      : 'bg-rose-950/20 border-rose-800/50 text-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-200">{chk.label}</span>
                    {chk.status === 'PASS' ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold font-mono">
                        <Check className="w-3.5 h-3.5" /> PASS
                      </span>
                    ) : chk.status === 'WARN' ? (
                      <span className="flex items-center gap-1 text-[11px] text-amber-400 font-bold font-mono">
                        <AlertTriangle className="w-3.5 h-3.5" /> CAUTION
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-rose-400 font-bold font-mono">
                        <X className="w-3.5 h-3.5" /> FAIL
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-100 my-0.5">
                    {chk.actualValue}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Criteria: {chk.requiredCriteria}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: INTERACTIVE PARAMETERS & EXECUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Parameters (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold text-slate-100 text-sm">Interactive Trade Parameters</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {setup ? `${setup.symbol} • ${setup.setupType.replace('_', ' ')}` : 'Custom Trade Setup'}
            </span>
          </div>

          {/* Account Equity & Risk % Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Total Account Equity ({currSym})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 text-xs">{currSym}</span>
                <input
                  id="input-account-equity"
                  type="number"
                  value={accountEquity}
                  onChange={e => setAccountEquity(Number(e.target.value))}
                  className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                  step={1000}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-400">Account Risk per Trade (%)</label>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {currSym}{analysis.riskDollars.toLocaleString()} (1R)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="input-risk-percent"
                  type="number"
                  value={riskPercent}
                  onChange={e => setRiskPercent(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                  step={0.25}
                  min={0.25}
                  max={10}
                />
                <span className="text-xs text-slate-400 font-mono">%</span>
              </div>
            </div>
          </div>

          {/* Win Rate Assumption */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-400">
                Strategy Historical Win Rate Assumption
              </label>
              <span className="text-xs font-mono text-slate-300 font-semibold">{winRateInput}%</span>
            </div>
            <input
              id="slider-win-rate"
              type="range"
              min={30}
              max={75}
              value={winRateInput}
              onChange={e => setWinRateInput(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>30% (Trend Follower)</span>
              <span>Break-Even: {(analysis.breakEvenWinRate * 100).toFixed(1)}%</span>
              <span>75% (High Confluence)</span>
            </div>
          </div>

          {/* Price Level Adjusters */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Exact Price Execution Levels ({currSym})
            </h4>

            {/* Entry Price */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">Entry Trigger Price</label>
                <span className="text-[11px] text-slate-500 font-mono">Current: {currSym}{setup?.currentPrice ?? 150}</span>
              </div>
              <input
                id="input-entry-price"
                type="number"
                value={customEntry}
                onChange={e => setCustomEntry(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                step={0.1}
              />
            </div>

            {/* Stop Loss Price & Quick Presets */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-rose-400 font-medium">
                  Stop Loss Price (-1.0R Invalidation)
                </label>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleStopPreset('STRUCTURAL_SWING_LOW')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 transition-colors cursor-pointer"
                  >
                    Swing Low
                  </button>
                  <button
                    onClick={() => handleStopPreset('ATR_2X')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 transition-colors cursor-pointer"
                  >
                    2x ATR
                  </button>
                </div>
              </div>
              <input
                id="input-stop-loss"
                type="number"
                value={customStop}
                onChange={e => setCustomStop(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-rose-900/60 rounded-lg text-sm font-mono text-rose-300 focus:outline-none focus:border-rose-500"
                step={0.1}
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
                <span>Risk per Share: {currSym}{(customEntry - customStop).toFixed(2)}</span>
                <span>Stop Distance: {(((customEntry - customStop) / customEntry) * 100).toFixed(2)}%</span>
              </div>
            </div>

            {/* Target Price & Multiplier Presets */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-emerald-400 font-medium">Profit Target Price</label>
                <div className="flex items-center gap-1 text-[10px] font-mono">
                  <span className="text-slate-500 mr-1">Multiplier:</span>
                  {[2.0, 2.5, 3.0, 4.0].map(mult => (
                    <button
                      key={mult}
                      onClick={() => handleMultiplierPreset(mult)}
                      className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                        targetMultiplier === mult
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {mult}R
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="input-target-price"
                type="number"
                value={customTarget}
                onChange={e => setCustomTarget(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-900/60 rounded-lg text-sm font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                step={0.1}
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
                <span>Reward per Share: {currSym}{(customTarget - customEntry).toFixed(2)}</span>
                <span>Target Gain: {(((customTarget - customEntry) / customEntry) * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Mathematical Sizing Breakdown (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-slate-100 text-sm">Quant Position Sizing Output</h3>
            </div>

            {/* Position Size Breakdown Table */}
            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Fixed 1R Risk Shares:</span>
                <span className="text-sm font-bold font-mono text-slate-100">
                  {analysis.fixedRiskShares} shares
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Required Position Capital:</span>
                <span className="text-sm font-bold font-mono text-slate-100">
                  {currSym}{analysis.fixedRiskCapital.toLocaleString()}
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Capital as % of Account:</span>
                <span className="text-sm font-bold font-mono text-cyan-400">
                  {analysis.fixedRiskPercentOfEquity}%
                </span>
              </div>

              <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-xs text-emerald-400 font-semibold block">Target Profit (+{analysis.rewardToRisk.toFixed(1)}R)</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {analysis.fixedRiskShares} sh &times; {currSym}{(customTarget - customEntry).toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    +{currSym}{analysis.projectedProfit.toLocaleString()}
                  </span>
                  <span className="block text-[11px] text-emerald-500/80 font-mono">
                    +{((analysis.projectedProfit / accountEquity) * 100).toFixed(2)}% on equity
                  </span>
                </div>
              </div>

              <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-xs text-rose-400 font-semibold block">Stop Invalidation (-1.0R)</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {analysis.fixedRiskShares} sh &times; {currSym}{(customEntry - customStop).toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold font-mono text-rose-400">
                    -{currSym}{analysis.projectedLoss.toLocaleString()}
                  </span>
                  <span className="block text-[11px] text-rose-500/80 font-mono">
                    -{((analysis.projectedLoss / accountEquity) * 100).toFixed(2)}% on equity
                  </span>
                </div>
              </div>
            </div>

            {/* Duration and Holding Framework Details */}
            <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Target Arrival Forecast:
                </span>
                <span className="font-mono text-amber-300 font-bold">
                  {durationProjection?.expectedTargetDate ?? '3 to 15 Days'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Exit Rule 1 (Invalidation):</span>
                <span className="font-mono text-rose-300">
                  {setup?.stopLossType === 'ATR_2X' ? '2x ATR Below Entry' : 'Recent Swing Low'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Exit Rule 2 (Take Profit):</span>
                <span className="font-mono text-emerald-300">
                  Dynamic Multiplier (+{analysis.rewardToRisk.toFixed(1)}R)
                </span>
              </div>
            </div>
          </div>

          {/* Action Button: Save to Trade Journal / Setup Database */}
          <button
            id="btn-save-setup-journal"
            onClick={handleSave}
            disabled={!setup}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
              savedSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white cursor-pointer active:scale-[0.99]'
            }`}
          >
            {savedSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Setup Saved to Trade Log!
              </>
            ) : (
              <>
                <BookmarkPlus className="w-4 h-4" />
                Log Trade Setup to Journal
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
