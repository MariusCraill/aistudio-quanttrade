import React, { useState, useEffect } from 'react';
import {
  Activity,
  Volume2,
  VolumeX,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Target,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import { CandleData, TradeSetup, AILiveSignalAlert, LiveIndicatorValues } from '../types';
import {
  evaluateLiveSignal,
  isAiLiveMonitorEnabled,
  setAiLiveMonitorEnabled,
} from '../services/aiLiveSignalService';
import {
  isSoundAlertsEnabled,
  setSoundAlertsEnabled,
  playBuyAlertSound,
  playSellAlertSound,
} from '../services/audioAlertService';

interface LiveIndicatorsHUDProps {
  candles: CandleData[];
  setup?: TradeSetup | null;
  symbol: string;
  name?: string;
  exchange?: 'JSE' | 'US';
  currencySymbol?: string;
  onApplySetupParameters?: (params: { entry: number; stop: number; target: number }) => void;
}

export default function LiveIndicatorsHUD({
  candles,
  setup,
  symbol,
  name,
  exchange,
  currencySymbol = '$',
  onApplySetupParameters,
}: LiveIndicatorsHUDProps) {
  // State for switches
  const [isAiActive, setIsAiActive] = useState<boolean>(() => isAiLiveMonitorEnabled());
  const [isSoundActive, setIsSoundActive] = useState<boolean>(() => isSoundAlertsEnabled());

  // Signal & Indicator State
  const [currentAlert, setCurrentAlert] = useState<AILiveSignalAlert | null>(null);
  const [indicators, setIndicators] = useState<LiveIndicatorValues | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [lastEvaluatedAt, setLastEvaluatedAt] = useState<Date | null>(null);
  const [soundTestMessage, setSoundTestMessage] = useState<string | null>(null);

  // Evaluate on mount, on symbol change, or when candles update
  const runEvaluation = async (forceSound = false, forceAi = false) => {
    if (!candles || candles.length === 0) return;
    setIsEvaluating(true);
    try {
      const result = await evaluateLiveSignal({
        symbol,
        name,
        exchange,
        currencySymbol,
        candles,
        setup,
        forceSound,
        forceAi,
      });
      setCurrentAlert(result.alert);
      setIndicators(result.indicators);
      setLastEvaluatedAt(new Date());
    } catch (e) {
      console.error('Error running live indicator evaluation:', e);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Run evaluation whenever symbol or candle count changes
  useEffect(() => {
    runEvaluation(false, false);
  }, [symbol, candles.length, isAiActive]);

  // Periodic live check every 30 seconds when active (uses quantitative engine + cached AI signal)
  useEffect(() => {
    if (!isAiActive) return;
    const interval = setInterval(() => {
      runEvaluation(false, false);
    }, 30000);
    return () => clearInterval(interval);
  }, [isAiActive, symbol, candles.length]);

  // Handle master AI Live Monitor Toggle
  const handleToggleAiMonitor = () => {
    const next = !isAiActive;
    setIsAiActive(next);
    setAiLiveMonitorEnabled(next);
  };

  // Handle Audio Sounds Toggle
  const handleToggleSound = () => {
    const next = !isSoundActive;
    setIsSoundActive(next);
    setSoundAlertsEnabled(next);
    if (next) {
      setSoundTestMessage('Sound alerts enabled');
      setTimeout(() => setSoundTestMessage(null), 2500);
    } else {
      setSoundTestMessage('Sound alerts muted');
      setTimeout(() => setSoundTestMessage(null), 2500);
    }
  };

  // Test sound triggers
  const handleTestBuySound = () => {
    playBuyAlertSound();
    setSoundTestMessage('Playing BUY Alert sound (Rising Chord)');
    setTimeout(() => setSoundTestMessage(null), 3000);
  };

  const handleTestSellSound = () => {
    playSellAlertSound();
    setSoundTestMessage('Playing SELL Alert sound (Urgent Descending Tone)');
    setTimeout(() => setSoundTestMessage(null), 3000);
  };

  const isBuy = currentAlert?.verdict === 'BUY_NOW';
  const isSell = currentAlert?.verdict === 'SELL_NOW';
  const isAccumulate = currentAlert?.verdict === 'ACCUMULATE';
  const isTakeProfit = currentAlert?.verdict === 'TAKE_PROFIT';

  return (
    <section
      id="live-indicators-hud"
      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md flex flex-col gap-4 relative overflow-hidden"
    >
      {/* Background ambient lighting based on signal */}
      <div
        className={`absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-all duration-700 opacity-20 ${
          isBuy
            ? 'bg-emerald-500'
            : isSell
            ? 'bg-rose-500'
            : isAccumulate
            ? 'bg-cyan-500'
            : isTakeProfit
            ? 'bg-amber-500'
            : 'bg-blue-600'
        }`}
      />

      {/* Control Header & Master Switches */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Activity className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-1.5">
                  AI Live Indicators &amp; Alerts
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                </h2>
                {/* Active Indicator Pulse */}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border transition-colors ${
                    isAiActive
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/70 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isAiActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
                    }`}
                  />
                  {isAiActive ? 'AI SENTINEL ACTIVE' : 'MONITOR STANDBY'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Real-time RSI, EMA 9/21, 200 SMA, and synthesized sound triggers for{' '}
                <strong className="text-slate-200">{symbol}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Controls: AI Switch, Sound Switch, Test Sounds */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Master AI Monitor Switch (ON / OFF) */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-inner">
            <span className="text-[11px] font-mono text-slate-300">AI Monitor:</span>
            <button
              id="toggle-ai-live-monitor"
              type="button"
              role="switch"
              aria-checked={isAiActive}
              onClick={handleToggleAiMonitor}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isAiActive ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
              title={isAiActive ? 'Click to turn AI Live Monitor OFF' : 'Click to turn AI Live Monitor ON'}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                  isAiActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span
              className={`text-[11px] font-bold font-mono ${
                isAiActive ? 'text-cyan-400' : 'text-slate-500'
              }`}
            >
              {isAiActive ? 'ON' : 'OFF'}
            </span>
          </div>

          {/* Sound Alerts Switch (ON / OFF) */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-inner">
            <button
              id="toggle-audio-alerts"
              onClick={handleToggleSound}
              className={`p-1 rounded-md transition-colors ${
                isSoundActive
                  ? 'text-cyan-400 hover:text-cyan-300'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
              title={isSoundActive ? 'Click to Mute Sound Alerts' : 'Click to Unmute Sound Alerts'}
            >
              {isSoundActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <span className="text-[11px] font-mono text-slate-300 hidden sm:inline">Sounds:</span>
            <button
              type="button"
              role="switch"
              aria-checked={isSoundActive}
              onClick={handleToggleSound}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isSoundActive ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
              title={isSoundActive ? 'Click to Mute Sounds' : 'Click to Unmute Sounds'}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                  isSoundActive ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span
              className={`text-[11px] font-bold font-mono ${
                isSoundActive ? 'text-emerald-400' : 'text-slate-500'
              }`}
            >
              {isSoundActive ? 'ON' : 'OFF'}
            </span>
          </div>

          {/* Quick Sound Test Buttons */}
          <div className="flex items-center gap-1">
            <button
              id="btn-test-buy-sound"
              onClick={handleTestBuySound}
              className="px-2 py-1 rounded-lg border border-emerald-700/60 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 hover:text-emerald-100 text-[11px] font-mono font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="Test the affirmative BUY NOW rising chord audio chime"
            >
              <Volume2 className="w-3 h-3 text-emerald-400" />
              <span>Test Buy</span>
            </button>
            <button
              id="btn-test-sell-sound"
              onClick={handleTestSellSound}
              className="px-2 py-1 rounded-lg border border-rose-800/60 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 text-[11px] font-mono font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="Test the urgent SELL NOW warning alarm sound"
            >
              <Volume2 className="w-3 h-3 text-rose-400" />
              <span>Test Sell</span>
            </button>
          </div>

          {/* Manual Re-evaluate Button */}
          <button
            id="btn-reevaluate-live"
            onClick={() => runEvaluation(true, true)}
            disabled={isEvaluating}
            className="p-1.5 rounded-lg border border-slate-700/80 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer disabled:opacity-50"
            title="Force immediate AI live indicators re-evaluation"
          >
            <RefreshCw className={`w-4 h-4 ${isEvaluating ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sound Test Feedback Banner */}
      {soundTestMessage && (
        <div className="bg-slate-950 border border-cyan-800/60 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-mono flex items-center gap-2 animate-in fade-in duration-100">
          <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
          <span>{soundTestMessage}</span>
        </div>
      )}

      {/* PRIMARY SIGNAL ALERT BANNER (BUY NOW / SELL NOW / ACCUMULATE / TAKE PROFIT) */}
      {currentAlert && (
        <div
          id="current-ai-signal-banner"
          className={`rounded-xl p-4 border transition-all duration-300 ${
            isBuy
              ? 'bg-emerald-950/50 border-emerald-500/80 text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.2)]'
              : isSell
              ? 'bg-rose-950/60 border-rose-500/90 text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.25)]'
              : isAccumulate
              ? 'bg-cyan-950/40 border-cyan-600/70 text-cyan-100'
              : isTakeProfit
              ? 'bg-amber-950/40 border-amber-500/80 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
              : 'bg-slate-950/70 border-slate-800 text-slate-200'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Verdict Headline & Badge */}
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
                  isBuy
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 animate-pulse'
                    : isSell
                    ? 'bg-rose-600 text-white border-rose-400 animate-pulse'
                    : isAccumulate
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : isTakeProfit
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {isBuy ? (
                  <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                ) : isSell ? (
                  <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
                ) : isTakeProfit ? (
                  <Target className="w-5 h-5 stroke-[2.5]" />
                ) : isAccumulate ? (
                  <TrendingUp className="w-5 h-5 stroke-[2.5]" />
                ) : (
                  <Activity className="w-5 h-5" />
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-xs font-black tracking-wider uppercase ${
                      isBuy
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : isSell
                        ? 'bg-rose-500 text-white shadow'
                        : isAccumulate
                        ? 'bg-cyan-500 text-slate-950'
                        : isTakeProfit
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {currentAlert.verdict.replace('_', ' ')}
                  </span>

                  <span className="text-xs font-mono font-bold text-slate-300">
                    Confidence: <span className="text-cyan-400">{currentAlert.confidenceScore}%</span>
                  </span>

                  {currentAlert.soundPlayed && isSoundActive && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-1">
                      <Volume2 className="w-3 h-3 text-cyan-400" />
                      Alert Sound Chime Played
                    </span>
                  )}

                  {currentAlert.isAiGenerated ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800 text-purple-300 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                      Gemini Live AI
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 flex items-center gap-1">
                      <Activity className="w-2.5 h-2.5 text-cyan-400" />
                      Quantitative Sentinel
                    </span>
                  )}
                </div>

                <h3 className="text-sm sm:text-base font-bold mt-1 text-slate-100">
                  {currentAlert.signalHeadline}
                </h3>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {isBuy && onApplySetupParameters && (
                <button
                  id="btn-apply-buy-alert-params"
                  onClick={() =>
                    onApplySetupParameters({
                      entry: currentAlert.suggestedTriggerPrice,
                      stop: currentAlert.suggestedStopLoss,
                      target: currentAlert.suggestedTargetPrice,
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold font-sans flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Execute Setup</span>
                </button>
              )}

              {/* Sound replay button */}
              {isBuy && (
                <button
                  onClick={() => playBuyAlertSound()}
                  title="Replay BUY sound"
                  className="p-1.5 rounded-lg border border-emerald-800 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              )}

              {isSell && (
                <button
                  onClick={() => playSellAlertSound()}
                  title="Replay SELL sound"
                  className="p-1.5 rounded-lg border border-rose-800 bg-rose-950/70 hover:bg-rose-900 text-rose-300 transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Trade Parameters row (Trigger, Stop Loss, Target, R:R) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-800/60 font-mono text-xs">
            <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block uppercase">Trigger Price</span>
              <span className="text-slate-200 font-bold text-sm">
                {currencySymbol}{currentAlert.suggestedTriggerPrice?.toFixed(2)}
              </span>
            </div>
            <div className="bg-slate-950/60 rounded-lg p-2 border border-rose-900/40">
              <span className="text-[10px] text-rose-400 block uppercase flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                Stop Loss
              </span>
              <span className="text-rose-300 font-bold text-sm">
                {currencySymbol}{currentAlert.suggestedStopLoss?.toFixed(2)}
              </span>
            </div>
            <div className="bg-slate-950/60 rounded-lg p-2 border border-emerald-900/40">
              <span className="text-[10px] text-emerald-400 block uppercase flex items-center gap-1">
                <Target className="w-3 h-3" />
                Profit Target
              </span>
              <span className="text-emerald-300 font-bold text-sm">
                {currencySymbol}{currentAlert.suggestedTargetPrice?.toFixed(2)}
              </span>
            </div>
            <div className="bg-slate-950/60 rounded-lg p-2 border border-cyan-900/40">
              <span className="text-[10px] text-cyan-400 block uppercase">Reward : Risk</span>
              <span className="text-cyan-300 font-bold text-sm">
                {currentAlert.rewardToRisk?.toFixed(1)}:1 R:R
              </span>
            </div>
          </div>

          {/* Key Bullet Reasons */}
          {currentAlert.keyReasons && currentAlert.keyReasons.length > 0 && (
            <div className="mt-3 flex flex-col gap-1 text-xs text-slate-300">
              {currentAlert.keyReasons.map((reason, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <span className="text-cyan-400 shrink-0 mt-0.5">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LIVE TECHNICAL INDICATOR GAUGES & METRICS */}
      {indicators && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* 1. RSI (14) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>RSI (14)</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                  indicators.rsiStatus === 'OVERSOLD'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : indicators.rsiStatus === 'OVERBOUGHT'
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : indicators.rsiStatus === 'BULLISH'
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {indicators.rsiStatus}
              </span>
            </div>
            <div className="my-1.5 flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-slate-100">
                {indicators.rsi14.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-500">/ 100</span>
            </div>
            {/* Visual Minibar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  indicators.rsi14 >= 70
                    ? 'bg-rose-500'
                    : indicators.rsi14 <= 30
                    ? 'bg-emerald-400'
                    : 'bg-cyan-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, indicators.rsi14))}%` }}
              />
            </div>
          </div>

          {/* 2. EMA 9 vs EMA 21 */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>EMA 9 / 21</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                  indicators.emaAlignment === 'BULLISH_STACK'
                    ? 'bg-emerald-950 text-emerald-300'
                    : indicators.emaAlignment === 'BEARISH_STACK'
                    ? 'bg-rose-950 text-rose-300'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {indicators.emaAlignment === 'BULLISH_STACK' ? 'BULL' : indicators.emaAlignment === 'BEARISH_STACK' ? 'BEAR' : 'NEUTRAL'}
              </span>
            </div>
            <div className="my-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span className="text-cyan-400">9:</span>
                <span>{currencySymbol}{indicators.ema9.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span className="text-purple-400">21:</span>
                <span>{currencySymbol}{indicators.ema21.toFixed(2)}</span>
              </div>
            </div>
            <span className="text-[10px] text-slate-500 font-mono truncate">
              {indicators.ema9 > indicators.ema21 ? 'Golden Stack (9 > 21)' : 'Bearish (9 < 21)'}
            </span>
          </div>

          {/* 3. 200 SMA Macro Trend */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>200 SMA Regime</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                  indicators.trendRegime === 'BULL_MARKET'
                    ? 'bg-emerald-950 text-emerald-300'
                    : 'bg-rose-950 text-rose-300'
                }`}
              >
                {indicators.trendRegime === 'BULL_MARKET' ? '🐂 BULL' : '🐻 BEAR'}
              </span>
            </div>
            <div className="my-1.5 flex items-baseline gap-1">
              <span className="text-sm font-bold font-mono text-slate-200">
                {indicators.sma200 ? `${currencySymbol}${indicators.sma200.toFixed(2)}` : 'N/A'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono truncate">
              {indicators.currentPrice >= (indicators.sma200 || 0)
                ? 'Price > 200 SMA Support'
                : 'Price < 200 SMA Resistance'}
            </span>
          </div>

          {/* 4. MACD Momentum */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>MACD Momentum</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                  indicators.macdHist >= 0
                    ? 'bg-emerald-950 text-emerald-300'
                    : 'bg-rose-950 text-rose-300'
                }`}
              >
                {indicators.macdHist >= 0 ? '+HIST' : '-HIST'}
              </span>
            </div>
            <div className="my-1.5 flex items-baseline gap-1">
              <span
                className={`text-base font-bold font-mono ${
                  indicators.macdHist >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {indicators.macdHist > 0 ? `+${indicators.macdHist.toFixed(2)}` : indicators.macdHist.toFixed(2)}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono truncate">
              {indicators.macdMomentum.replace('_', ' ')}
            </span>
          </div>

          {/* 5. ATR (14) Volatility */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>ATR (14) Vol</span>
              <span className="text-[9px] text-cyan-400 font-mono font-bold">
                {indicators.atrPercent.toFixed(1)}%
              </span>
            </div>
            <div className="my-1.5 flex items-baseline gap-1">
              <span className="text-base font-bold font-mono text-slate-200">
                {currencySymbol}{indicators.atr14.toFixed(2)}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono truncate">
              Daily Expected Range
            </span>
          </div>

          {/* 6. Volume Surge vs 20MA */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Volume vs 20d</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                  indicators.volumeRatio20 >= 1.5
                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                    : indicators.volumeRatio20 >= 1.1
                    ? 'bg-cyan-950 text-cyan-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {indicators.volumeRatio20 >= 1.5 ? '🔥 SURGE' : 'NORMAL'}
              </span>
            </div>
            <div className="my-1.5 flex items-baseline gap-1">
              <span
                className={`text-base font-bold font-mono ${
                  indicators.volumeRatio20 >= 1.5
                    ? 'text-amber-300'
                    : indicators.volumeRatio20 >= 1.1
                    ? 'text-cyan-300'
                    : 'text-slate-200'
                }`}
              >
                {indicators.volumeRatio20.toFixed(2)}x
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono truncate">
              Institutional Pace
            </span>
          </div>
        </div>
      )}

      {/* Footer Timestamp */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
        <span>
          Live Indicator Engine • 20s Polling Cycle • Synthesized Web Audio Alerts
        </span>
        <span>
          {lastEvaluatedAt ? `Last evaluation: ${lastEvaluatedAt.toLocaleTimeString()}` : 'Live'}
        </span>
      </div>
    </section>
  );
}
