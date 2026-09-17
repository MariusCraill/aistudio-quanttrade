import { VolatilityAlert, VolatilityRadarReport } from '../types';
import { REAL_MARKET_ASSETS } from '../data/realMarketData';
import { evaluateVolatilitySurge } from '../utils/technicalIndicators';
import { calculateMarketStatus } from './marketDataService';

const MUTE_STORAGE_KEY = 'tradequant_volatility_alerts_muted';
const DISMISSED_STORAGE_KEY = 'tradequant_volatility_alerts_dismissed';
const RADAR_ENABLED_STORAGE_KEY = 'tradequant_volatility_radar_enabled';

type RadarStateListener = (enabled: boolean) => void;
const radarListeners: Set<RadarStateListener> = new Set();

export function isAtrRadarEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = localStorage.getItem(RADAR_ENABLED_STORAGE_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
    return true; // Default ON
  } catch {
    return true;
  }
}

export function setAtrRadarEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(RADAR_ENABLED_STORAGE_KEY, enabled.toString());
  } catch (e) {
    console.warn('Failed to save ATR radar preference:', e);
  }
  radarListeners.forEach(fn => fn(enabled));
}

export function toggleAtrRadar(): boolean {
  const current = isAtrRadarEnabled();
  const next = !current;
  setAtrRadarEnabled(next);
  return next;
}

export function subscribeToAtrRadarState(listener: RadarStateListener): () => void {
  radarListeners.add(listener);
  return () => {
    radarListeners.delete(listener);
  };
}

/**
 * Web Audio API synthesizer for clean, pleasant audio alert chimes
 * Runs purely client-side without external asset dependencies.
 */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    console.warn('Web Audio API not supported or blocked:', e);
    return null;
  }
}

export function playVolatilityChime(severity: 'ELEVATED' | 'HIGH' | 'EXTREME_ANOMALY' = 'HIGH') {
  if (isAudioMuted()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    if (severity === 'EXTREME_ANOMALY') {
      // Urgent high-impact double chime: F#5 (739.99Hz) -> C#6 (1108.73Hz)
      osc1.frequency.setValueAtTime(739.99, now);
      osc1.frequency.exponentialRampToValueAtTime(1108.73, now + 0.12);
      osc2.frequency.setValueAtTime(369.99, now);
      osc2.frequency.exponentialRampToValueAtTime(554.37, now + 0.12);
      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    } else if (severity === 'HIGH') {
      // High chime: E5 (659.25Hz) -> A5 (880.00Hz)
      osc1.frequency.setValueAtTime(659.25, now);
      osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.1);
      osc2.frequency.setValueAtTime(329.63, now);
      osc2.frequency.exponentialRampToValueAtTime(440.0, now + 0.1);
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    } else {
      // Subtle pulse chime: D5 (587.33Hz) -> G5 (783.99Hz)
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.1);
      osc2.frequency.setValueAtTime(293.66, now);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    }

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
  } catch (err) {
    console.warn('Error playing volatility chime:', err);
  }
}

export function isAudioMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
}

export function setAudioMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false');
}

export function getDismissedAlertIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function dismissAlert(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getDismissedAlertIds();
    if (!current.includes(id)) {
      current.push(id);
      localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(current.slice(-50)));
    }
  } catch (e) {
    console.warn('Error dismissing alert:', e);
  }
}

/**
 * Evaluates real-time volatility alerts:
 * 1. Queries `/api/market/volatility-alerts` for real live exchange data
 * 2. Falls back seamlessly to real recorded dataset if network is offline
 */
export async function fetchLiveVolatilityAlerts(symbols?: string[], refresh = false): Promise<VolatilityRadarReport> {
  const params = new URLSearchParams();
  if (symbols && symbols.length > 0) params.append('symbols', symbols.join(','));
  if (refresh) params.append('refresh', 'true');
  const query = params.toString() ? `?${params.toString()}` : '';

  try {
    const res = await fetch(`/api/market/volatility-alerts${query}`);
    if (res.ok) {
      const data: VolatilityRadarReport = await res.json();
      const dismissed = getDismissedAlertIds();
      return {
        ...data,
        alerts: (data.alerts || []).map(a => ({
          ...a,
          isDismissed: dismissed.includes(a.id),
        })),
      };
    }
  } catch (err) {
    console.warn('Live volatility API fetch failed, computing from local market datasets:', err);
  }

  // Fallback: Compute directly from real market dataset
  return computeFallbackVolatilityRadar(symbols);
}

/**
 * Computes volatility alerts directly from the embedded real dataset
 */
export function computeFallbackVolatilityRadar(filterSymbols?: string[]): VolatilityRadarReport {
  const alerts: VolatilityAlert[] = [];
  const dismissed = getDismissedAlertIds();

  const assetsToScan = filterSymbols && filterSymbols.length > 0
    ? REAL_MARKET_ASSETS.filter(a => filterSymbols.includes(a.symbol))
    : REAL_MARKET_ASSETS;

  for (const asset of assetsToScan) {
    const status = calculateMarketStatus(asset.exchange);
    const evalResult = evaluateVolatilitySurge(
      asset.data,
      asset.symbol,
      asset.name,
      asset.exchange,
      asset.currencySymbol,
      status.isOpen ? 'OPEN' : 'CLOSED'
    );

    if (evalResult.alert) {
      alerts.push({
        ...evalResult.alert,
        isDismissed: dismissed.includes(evalResult.alert.id),
      });
    }
  }

  alerts.sort((a, b) => b.surgePercent - a.surgePercent);

  const totalMonitored = assetsToScan.length;
  const activeSurgeCount = alerts.length;
  const avgSurge = activeSurgeCount > 0
    ? Number((alerts.reduce((acc, a) => acc + a.surgePercent, 0) / activeSurgeCount).toFixed(1))
    : 0;

  const isExpansion = activeSurgeCount >= Math.max(2, Math.floor(totalMonitored * 0.3));

  return {
    timestamp: new Date().toISOString(),
    totalMonitored,
    activeSurgeCount,
    averageSurgePercent: avgSurge,
    marketRegime: isExpansion ? 'VOLATILITY_EXPANSION' : 'NORMAL',
    regimeSummary: isExpansion
      ? `Market Volatility Expansion: ${activeSurgeCount} of ${totalMonitored} assets (${Math.round((activeSurgeCount / totalMonitored) * 100)}%) are surging above their 20-day ATR moving average.`
      : `Normal Volatility: ${activeSurgeCount} of ${totalMonitored} assets currently show ATR > 20d MA.`,
    topAnomaly: alerts[0] || null,
    alerts,
  };
}

/**
 * Real-time polling subscriber:
 * Sets up an automated interval to periodically check volatility status.
 */
export function subscribeToVolatilityAlerts(
  callback: (report: VolatilityRadarReport) => void,
  intervalMs = 30000
): () => void {
  let isMounted = true;

  const run = async () => {
    if (!isAtrRadarEnabled()) return;
    try {
      const report = await fetchLiveVolatilityAlerts();
      if (isMounted) {
        callback(report);
      }
    } catch (e) {
      console.warn('Error in volatility subscriber:', e);
    }
  };

  // Immediate initial run
  run();
  const timer = setInterval(run, intervalMs);

  return () => {
    isMounted = false;
    clearInterval(timer);
  };
}
