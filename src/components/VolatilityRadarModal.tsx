import { useState, MouseEvent } from 'react';
import {
  Zap,
  Volume2,
  VolumeX,
  RefreshCw,
  X,
  ExternalLink,
  Flame,
  ArrowUpRight,
  TrendingDown,
  Info,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { VolatilityAlert, VolatilityRadarReport } from '../types';
import {
  isAudioMuted,
  setAudioMuted,
  playVolatilityChime,
  dismissAlert,
} from '../services/volatilityAlertService';

interface VolatilityRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: VolatilityRadarReport | null;
  isLoading: boolean;
  onRefresh: () => void;
  onSelectSymbol: (symbol: string) => void;
}

export default function VolatilityRadarModal({
  isOpen,
  onClose,
  report,
  isLoading,
  onRefresh,
  onSelectSymbol,
}: VolatilityRadarModalProps) {
  const [exchangeFilter, setExchangeFilter] = useState<'ALL' | 'JSE' | 'US'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'HIGH_EXTREME' | 'EXTREME_ONLY'>('ALL');
  const [muted, setMuted] = useState(() => isAudioMuted());
  const [dismissedList, setDismissedList] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
    if (!next) {
      playVolatilityChime('ELEVATED');
    }
  };

  const handleDismiss = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    dismissAlert(id);
    setDismissedList(prev => [...prev, id]);
  };

  const allAlerts = (report?.alerts || []).filter(a => !a.isDismissed && !dismissedList.includes(a.id));

  const filteredAlerts = allAlerts.filter(alert => {
    if (exchangeFilter !== 'ALL' && alert.exchange !== exchangeFilter) {
      return false;
    }
    if (severityFilter === 'HIGH_EXTREME' && alert.severity === 'ELEVATED') {
      return false;
    }
    if (severityFilter === 'EXTREME_ONLY' && alert.severity !== 'EXTREME_ANOMALY') {
      return false;
    }
    return true;
  });

  const handleSelectAndClose = (symbol: string) => {
    onSelectSymbol(symbol);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-md shadow-amber-500/10">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Real-Time Volatility Alert Radar
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                  ATR &gt; 20d MA DETECTOR
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Signals potential price breakouts and volatility anomalies across JSE &amp; US equities.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              onClick={handleToggleMute}
              className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
                muted
                  ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  : 'bg-amber-950/40 border-amber-800/60 text-amber-300 hover:bg-amber-900/50'
              }`}
              title={muted ? 'Audio chimes are muted (Click to enable)' : 'Audio chimes active (Click to mute)'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
              <span className="text-[11px] font-mono hidden sm:inline">{muted ? 'Muted' : 'Chime On'}</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh live volatility scan"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Radar Summary Metrics Bar */}
        <div className="px-6 py-3.5 bg-slate-950/40 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Active Surges</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-amber-400">
                {report?.activeSurgeCount ?? 0}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                / {report?.totalMonitored ?? 16} monitored
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Avg Volatility Surge</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold font-mono text-cyan-400">
                +{report?.averageSurgePercent ?? 0}%
              </span>
              <span className="text-[10px] text-slate-400 font-mono">above 20d MA</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Market Regime</span>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                  report?.marketRegime === 'VOLATILITY_EXPANSION'
                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}
              >
                {report?.marketRegime === 'VOLATILITY_EXPANSION' ? 'EXPANSION REGIME' : 'NORMAL COMPRESSION'}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Top Volatility Anomaly</span>
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-sm font-bold font-mono text-white">
                {report?.topAnomaly ? report.topAnomaly.symbol : 'None'}
              </span>
              {report?.topAnomaly && (
                <span className="text-[11px] font-mono font-bold text-rose-400">
                  +{report.topAnomaly.surgePercent}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="px-6 py-2.5 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] flex items-center gap-1 font-mono">
              <Sliders className="w-3.5 h-3.5" /> Exchange:
            </span>
            <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[11px] font-mono">
              <button
                onClick={() => setExchangeFilter('ALL')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  exchangeFilter === 'ALL' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({allAlerts.length})
              </button>
              <button
                onClick={() => setExchangeFilter('JSE')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  exchangeFilter === 'JSE' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                JSE ({allAlerts.filter(a => a.exchange === 'JSE').length})
              </button>
              <button
                onClick={() => setExchangeFilter('US')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  exchangeFilter === 'US' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                US ({allAlerts.filter(a => a.exchange === 'US').length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] font-mono">Surge Sensitivity:</span>
            <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[11px] font-mono">
              <button
                onClick={() => setSeverityFilter('ALL')}
                className={`px-2 py-1 rounded transition-colors ${
                  severityFilter === 'ALL' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                &gt;1.0x (All Surges)
              </button>
              <button
                onClick={() => setSeverityFilter('HIGH_EXTREME')}
                className={`px-2 py-1 rounded transition-colors ${
                  severityFilter === 'HIGH_EXTREME' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                &gt;1.18x (High)
              </button>
              <button
                onClick={() => setSeverityFilter('EXTREME_ONLY')}
                className={`px-2 py-1 rounded transition-colors ${
                  severityFilter === 'EXTREME_ONLY' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                &gt;1.35x (Anomalies)
              </button>
            </div>
          </div>
        </div>

        {/* Alerts Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
          {filteredAlerts.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">No Active Volatility Surges in Filtered Set</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                Monitored assets are currently trading within normal volatility parameters (Current ATR &le; 20-day ATR moving average). You will be notified when an asset's ATR crosses above its 20-day mean.
              </p>
            </div>
          ) : (
            filteredAlerts.map(alert => {
              const isBullish = alert.signalType === 'BULLISH_BREAKOUT_VOLATILITY';
              const isBearish = alert.signalType === 'BEARISH_EXPANSION_VOLATILITY';
              const isAnomaly = alert.severity === 'EXTREME_ANOMALY';

              return (
                <div
                  key={alert.id}
                  onClick={() => handleSelectAndClose(alert.symbol)}
                  className={`group relative p-4 rounded-xl border transition-all cursor-pointer hover:scale-[1.005] ${
                    isAnomaly
                      ? 'bg-rose-950/20 border-rose-600/50 hover:border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.1)]'
                      : isBullish
                      ? 'bg-slate-900/90 border-amber-500/40 hover:border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
                      : 'bg-slate-900/80 border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  {/* Top line: Symbol, Exchange, Tags, Price */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-base font-mono text-white group-hover:text-cyan-400 transition-colors">
                        {alert.symbol}
                      </span>
                      <span className="text-xs text-slate-300 font-medium">
                        {alert.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {alert.exchange}
                      </span>
                      {alert.marketStatus === 'CLOSED' && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800">
                          CLOSED
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 font-mono">
                      <div className="text-right">
                        <span className="text-sm font-bold text-white">
                          {alert.currencySymbol}{alert.currentPrice.toFixed(2)}
                        </span>
                        <span
                          className={`ml-2 text-xs font-semibold ${
                            alert.priceChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {alert.priceChangePercent >= 0 ? '+' : ''}{alert.priceChangePercent.toFixed(2)}%
                        </span>
                      </div>

                      <button
                        onClick={(e) => handleDismiss(alert.id, e)}
                        className="opacity-40 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-200 transition-opacity"
                        title="Dismiss alert"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Visual ATR vs 20d MA Comparison Bar */}
                  <div className="mt-3 p-3 rounded-lg bg-slate-950/70 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                    {/* Current ATR */}
                    <div>
                      <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
                        <span>Current ATR (14)</span>
                        <span className="font-bold text-amber-300">
                          {alert.currencySymbol}{alert.currentAtr.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"
                          style={{
                            width: `${Math.min(100, (alert.currentAtr / (alert.currentAtr + alert.atrMa20)) * 170)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* 20-Day ATR Moving Average */}
                    <div>
                      <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
                        <span>20-Day ATR MA</span>
                        <span className="text-slate-300">
                          {alert.currencySymbol}{alert.atrMa20.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-slate-600 rounded-full"
                          style={{
                            width: `${Math.min(100, (alert.atrMa20 / (alert.currentAtr + alert.atrMa20)) * 170)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Volatility Surge Metric */}
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs font-mono text-slate-400">Surge Ratio:</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono font-bold flex items-center gap-1 ${
                          isAnomaly
                            ? 'bg-rose-950 text-rose-300 border border-rose-700 animate-pulse'
                            : 'bg-amber-950 text-amber-300 border border-amber-700'
                        }`}
                      >
                        <Flame className="w-3.5 h-3.5" />
                        {alert.surgeRatio.toFixed(2)}x (+{alert.surgePercent}%)
                      </span>
                    </div>
                  </div>

                  {/* Signal Description & Action Hook */}
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase flex items-center gap-1 ${
                          isBullish
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : isBearish
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {isBullish ? <ArrowUpRight className="w-3 h-3" /> : isBearish ? <TrendingDown className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                        {alert.signalTitle}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {alert.signalDescription}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-cyan-400 text-xs font-semibold group-hover:translate-x-0.5 transition-transform">
                      <span>Analyze Setup</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Technical Note */}
        <div className="px-6 py-3 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong>Quantitative Trigger Rule:</strong> When ATR(14) crosses above its 20-day moving average, volatility expansion has ignited. Breakouts accompanied by ATR expansion have a statistically higher velocity of target fulfillment.
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Real-time auto-scan: 30s interval
          </span>
        </div>
      </div>
    </div>
  );
}
