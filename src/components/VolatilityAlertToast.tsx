import { Zap, X, ArrowRight } from 'lucide-react';
import { VolatilityAlert } from '../types';

interface VolatilityAlertToastProps {
  alert: VolatilityAlert | null;
  onDismiss: () => void;
  onOpenRadar: () => void;
  onAnalyze: (symbol: string) => void;
}

export default function VolatilityAlertToast({
  alert,
  onDismiss,
  onOpenRadar,
  onAnalyze,
}: VolatilityAlertToastProps) {
  if (!alert) return null;

  const isAnomaly = alert.severity === 'EXTREME_ANOMALY';
  const isBullish = alert.signalType === 'BULLISH_BREAKOUT_VOLATILITY';

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900/95 border border-amber-500/50 rounded-xl p-4 shadow-2xl backdrop-blur-md animate-slideUp">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Zap className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-sm text-white">
                {alert.symbol}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-950 border border-amber-700 text-amber-300">
                +{alert.surgePercent}% ATR SURGE
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium">
              ATR &gt; 20-Day Moving Average
            </p>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-white p-1"
          title="Dismiss toast"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-2.5 p-2 rounded bg-slate-950/70 border border-slate-800 text-[11px] font-mono flex items-center justify-between text-slate-300">
        <div>
          <span className="text-slate-500">ATR:</span>{' '}
          <strong className="text-amber-300">{alert.currencySymbol}{alert.currentAtr.toFixed(2)}</strong>
          <span className="text-slate-500 ml-1.5">vs 20d MA:</span>{' '}
          <span className="text-slate-300">{alert.currencySymbol}{alert.atrMa20.toFixed(2)}</span>
        </div>
        <span
          className={`font-bold ${
            isAnomaly ? 'text-rose-400' : isBullish ? 'text-emerald-400' : 'text-amber-400'
          }`}
        >
          {alert.surgeRatio.toFixed(2)}x
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <button
          onClick={onOpenRadar}
          className="text-slate-400 hover:text-slate-200 underline text-[11px]"
        >
          View All Surges
        </button>

        <button
          onClick={() => {
            onAnalyze(alert.symbol);
            onDismiss();
          }}
          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 transition-colors text-xs"
        >
          <span>Analyze {alert.symbol}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
