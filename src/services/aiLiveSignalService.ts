import { CandleData, TradeSetup, AILiveSignalAlert, LiveIndicatorValues } from '../types';
import { calculateLiveIndicatorSnapshot } from '../utils/technicalIndicators';
import { playBuyAlertSound, playSellAlertSound, isSoundAlertsEnabled } from './audioAlertService';

const AI_MONITOR_STORAGE_KEY = 'tradequant_ai_live_monitor_enabled';
const RECENT_ALERTS_STORAGE_KEY = 'tradequant_recent_ai_live_alerts';

// Listeners for AI Live Monitor active/inactive toggle
type MonitorStateListener = (enabled: boolean) => void;
const monitorListeners: Set<MonitorStateListener> = new Set();

// Listeners for new Live Signal Alerts
type AlertListener = (alert: AILiveSignalAlert | null) => void;
const alertListeners: Set<AlertListener> = new Set();

let currentActiveAlert: AILiveSignalAlert | null = null;
let lastSoundAlertId: string | null = null;

/**
 * Checks if the AI Live Monitor Sentinel is active (default: true)
 */
export function isAiLiveMonitorEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = localStorage.getItem(AI_MONITOR_STORAGE_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
    return true; // Default ON
  } catch {
    return true;
  }
}

/**
 * Turns the AI Live Monitor ON / OFF
 */
export function setAiLiveMonitorEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AI_MONITOR_STORAGE_KEY, enabled.toString());
  } catch (e) {
    console.warn('Failed to save AI monitor preference:', e);
  }
  monitorListeners.forEach(fn => fn(enabled));
  if (!enabled) {
    // Dismiss active banner if user explicitly turns monitoring off
    currentActiveAlert = null;
    alertListeners.forEach(fn => fn(null));
  }
}

/**
 * Toggles AI Live Monitor state
 */
export function toggleAiLiveMonitor(): boolean {
  const current = isAiLiveMonitorEnabled();
  const next = !current;
  setAiLiveMonitorEnabled(next);
  return next;
}

/**
 * Subscribe to AI Monitor ON / OFF state changes
 */
export function subscribeToAiMonitorState(listener: MonitorStateListener): () => void {
  monitorListeners.add(listener);
  return () => {
    monitorListeners.delete(listener);
  };
}

/**
 * Subscribe to new Live Signal Alerts
 */
export function subscribeToLiveSignalAlerts(listener: AlertListener): () => void {
  alertListeners.add(listener);
  return () => {
    alertListeners.delete(listener);
  };
}

export function getActiveLiveAlert(): AILiveSignalAlert | null {
  return currentActiveAlert;
}

export function dismissActiveLiveAlert(): void {
  currentActiveAlert = null;
  alertListeners.forEach(fn => fn(null));
}

/**
 * Evaluates live indicators for the provided candle data and requests an AI Signal analysis
 */
export async function evaluateLiveSignal(params: {
  symbol: string;
  name?: string;
  exchange?: 'JSE' | 'US';
  currencySymbol?: string;
  candles: CandleData[];
  setup?: TradeSetup | null;
  forceSound?: boolean;
  forceAi?: boolean;
}): Promise<{ alert: AILiveSignalAlert; indicators: LiveIndicatorValues }> {
  const { symbol, name, exchange, currencySymbol, candles, setup, forceSound = false, forceAi = false } = params;

  // 1. Calculate live technical indicators snapshot
  const indicators = calculateLiveIndicatorSnapshot(candles);

  if (!isAiLiveMonitorEnabled()) {
    // When monitor is switched OFF, return passive snapshot without triggering alerts or sounds
    const passiveAlert: AILiveSignalAlert = {
      id: `SIG-OFF-${symbol}`,
      symbol,
      name: name || symbol,
      exchange: exchange || 'US',
      currencySymbol: currencySymbol || (exchange === 'JSE' ? 'R' : '$'),
      verdict: 'NEUTRAL_HOLD',
      signalHeadline: `AI Live Monitoring is switched OFF`,
      confidenceScore: 50,
      urgency: 'PASS',
      currentPrice: indicators.currentPrice,
      suggestedTriggerPrice: indicators.currentPrice,
      suggestedStopLoss: Number((indicators.currentPrice * 0.95).toFixed(2)),
      suggestedTargetPrice: Number((indicators.currentPrice * 1.10).toFixed(2)),
      rewardToRisk: 2.0,
      keyReasons: ['Switch AI Live Monitor ON to receive real-time BUY and SELL indicator alerts with sounds.'],
      indicators,
      timestamp: new Date().toISOString(),
      isAiGenerated: false,
    };
    return { alert: passiveAlert, indicators };
  }

  // 2. Fetch live signal from server endpoint
  let alertData: AILiveSignalAlert;
  try {
    const res = await fetch('/api/ai/live-signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        name: name || symbol,
        exchange: exchange || 'US',
        currencySymbol: currencySymbol || (exchange === 'JSE' ? 'R' : '$'),
        currentPrice: indicators.currentPrice,
        indicators,
        forceAi,
        setup: setup
          ? {
              setupType: setup.setupType,
              entryPrice: setup.entryPrice,
              stopLossPrice: setup.stopLossPrice,
              targetPrice: setup.targetPrice,
              rewardToRisk: setup.rewardToRisk,
              confluenceScore: setup.confluenceScore,
            }
          : undefined,
      }),
    });

    if (res.ok) {
      alertData = await res.json();
    } else {
      alertData = generateClientFallbackSignal(symbol, name, exchange, currencySymbol, indicators, setup);
    }
  } catch (_err) {
    alertData = generateClientFallbackSignal(symbol, name, exchange, currencySymbol, indicators, setup);
  }

  // 3. Audio sound trigger for BUY NOW and SELL NOW
  const alertKey = `${symbol}-${alertData.verdict}`;
  const isNewOrForced = alertKey !== lastSoundAlertId || forceSound;

  if (isNewOrForced && isAiLiveMonitorEnabled() && isSoundAlertsEnabled()) {
    if (alertData.verdict === 'BUY_NOW') {
      playBuyAlertSound();
      lastSoundAlertId = alertKey;
      alertData.soundPlayed = true;
    } else if (alertData.verdict === 'SELL_NOW') {
      playSellAlertSound();
      lastSoundAlertId = alertKey;
      alertData.soundPlayed = true;
    }
  }

  // 4. Update active alert state if significant signal
  if (alertData.verdict === 'BUY_NOW' || alertData.verdict === 'SELL_NOW' || alertData.verdict === 'TAKE_PROFIT') {
    currentActiveAlert = alertData;
    alertListeners.forEach(fn => fn(alertData));
  } else {
    currentActiveAlert = alertData;
    alertListeners.forEach(fn => fn(alertData));
  }

  // 5. Store in recent alerts log
  try {
    const existingStr = localStorage.getItem(RECENT_ALERTS_STORAGE_KEY);
    const existingList: AILiveSignalAlert[] = existingStr ? JSON.parse(existingStr) : [];
    const filtered = existingList.filter(a => a.id !== alertData.id).slice(0, 19);
    localStorage.setItem(RECENT_ALERTS_STORAGE_KEY, JSON.stringify([alertData, ...filtered]));
  } catch (e) {
    // ignore storage quota errors
  }

  return { alert: alertData, indicators };
}

/**
 * Client-side fallback signal generator in case of network disconnect
 */
function generateClientFallbackSignal(
  symbol: string,
  name: string | undefined,
  exchange: 'JSE' | 'US' | undefined,
  currencySymbol: string | undefined,
  indicators: LiveIndicatorValues,
  setup: TradeSetup | null | undefined
): AILiveSignalAlert {
  const curSym = currencySymbol || (exchange === 'JSE' ? 'R' : '$');
  const price = indicators.currentPrice;
  const rsi = indicators.rsi14;
  const isBull = indicators.emaAlignment === 'BULLISH_STACK';
  const isAbove200 = indicators.trendRegime === 'BULL_MARKET';
  const vol = indicators.volumeRatio20;

  let verdict: AILiveSignalAlert['verdict'] = 'NEUTRAL_HOLD';
  let headline = `NEUTRAL: ${symbol} holding steady; waiting for expansion trigger`;
  let urgency: AILiveSignalAlert['urgency'] = 'PASS';
  let confidence = 65;
  const reasons: string[] = [];

  if (indicators.emaAlignment === 'BEARISH_STACK' && rsi < 42) {
    verdict = 'SELL_NOW';
    urgency = 'IMMEDIATE';
    confidence = 86;
    headline = `SELL NOW: Bearish EMA breakdown with accelerating downside momentum`;
    reasons.push(`EMA 9 is below EMA 21 with negative MACD histogram.`);
    reasons.push(`RSI at ${rsi.toFixed(1)} confirms selling pressure.`);
    reasons.push(`Preserve risk capital: exit position or set trailing stop.`);
  } else if (isAbove200 && isBull && rsi >= 48 && rsi <= 68 && (vol >= 1.1 || (setup?.rewardToRisk || 0) >= 2.0)) {
    verdict = 'BUY_NOW';
    urgency = 'IMMEDIATE';
    confidence = Math.min(95, Math.round(75 + (vol > 1.3 ? 12 : 0) + (isAbove200 ? 8 : 0)));
    headline = `BUY NOW: High-probability entry triggered! EMA 9/21 stack + ${vol.toFixed(1)}x volume surge`;
    reasons.push(`Bullish EMA alignment in structural macro uptrend.`);
    reasons.push(`Institutional accumulation detected: volume is ${vol.toFixed(1)}x 20-day average.`);
    reasons.push(`Asymmetric Reward-to-Risk ratio with positive expectancy.`);
  } else if (rsi >= 75) {
    verdict = 'TAKE_PROFIT';
    urgency = 'IMMEDIATE';
    confidence = 88;
    headline = `TAKE PROFIT: Overbought extension reached with RSI at ${rsi.toFixed(1)}`;
    reasons.push(`Price is extended far above moving average baselines.`);
    reasons.push(`Lock in profits or scale out partial position.`);
  } else if (isAbove200 && rsi <= 38) {
    verdict = 'ACCUMULATE';
    urgency = 'ACTIVE_WATCH';
    confidence = 80;
    headline = `ACCUMULATE: Oversold dip into structural support (${rsi.toFixed(1)} RSI)`;
    reasons.push(`Price holding above 200 SMA long-term baseline.`);
    reasons.push(`Favorable risk/reward entry for swing accumulation.`);
  } else {
    reasons.push(`RSI(14) neutral at ${rsi.toFixed(1)}.`);
    reasons.push(`Price within normal ATR fluctuation bounds.`);
  }

  const stop = setup?.stopLossPrice || Number((price * 0.96).toFixed(2));
  const target = setup?.targetPrice || Number((price * 1.08).toFixed(2));
  const rr = setup?.rewardToRisk || Number(((target - price) / Math.max(0.01, price - stop)).toFixed(2));

  return {
    id: `SIG-CLI-${symbol}-${Date.now()}`,
    symbol,
    name: name || symbol,
    exchange: exchange || 'US',
    currencySymbol: curSym,
    verdict,
    signalHeadline: headline,
    confidenceScore: confidence,
    urgency,
    currentPrice: price,
    suggestedTriggerPrice: price,
    suggestedStopLoss: stop,
    suggestedTargetPrice: target,
    rewardToRisk: rr,
    keyReasons: reasons,
    indicators,
    timestamp: new Date().toISOString(),
    isAiGenerated: false,
  };
}
