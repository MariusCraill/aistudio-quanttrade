import React from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  X,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { AILiveSignalAlert } from '../types';
import { playBuyAlertSound, playSellAlertSound, isSoundAlertsEnabled, toggleSoundAlerts } from '../services/audioAlertService';

interface LiveSignalAlertToastProps {
  alert: AILiveSignalAlert | null;
  onDismiss: () => void;
  onSelectSymbol: (symbol: string) => void;
}

export default function LiveSignalAlertToast({
  alert,
  onDismiss,
  onSelectSymbol,
}: LiveSignalAlertToastProps) {
  if (!alert) return null;

  const isBuy = alert.verdict === 'BUY_NOW';
  const isSell = alert.verdict === 'SELL_NOW';
  const isSoundOn = isSoundAlertsEnabled();

  // Only pop toast for actionable trade signals
  if (!isBuy && !isSell && alert.verdict !== 'TAKE_PROFIT') {
    return null;
  }

  const handleReplaySound = () => {
    if (isBuy) {
      playBuyAlertSound();
    } else {
      playSellAlertSound();
    }
  };

  return (
    <div
      id="live-signal-alert-toast"
      className={`fixed bottom-20 right-5 z-50 max-w-sm w-full rounded-2xl p-4 shadow-2xl backdrop-blur-md border transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
        isBuy
          ? 'bg-slate-950/95 border-emerald-500/80 shadow-[0_0_30px_rgba(16,185,129,0.3)]'
          : isSell
          ? 'bg-slate-950/95 border-rose-500/80 shadow-[0_0_30px_rgba(244,63,94,0.35)]'
          : 'bg-slate-950/95 border-amber-500/80 shadow-[0_0_30px_rgba(245,158,11,0.3)]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-lg ${
              isBuy
                ? 'bg-emerald-500 shadow-emerald-500/30 text-slate-950'
                : isSell
                ? 'bg-rose-500 shadow-rose-500/30 text-white'
                : 'bg-amber-500 shadow-amber-500/30 text-slate-950'
            }`}
          >
            {isBuy ? (
              <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
            ) : isSell ? (
              <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
            ) : (
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm text-slate-100">
                {alert.symbol}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                  isBuy
                    ? 'bg-emerald-500 text-slate-950'
                    : isSell
                    ? 'bg-rose-500 text-white'
                    : 'bg-amber-500 text-slate-950'
                }`}
              >
                {alert.verdict.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium">
              {alert.currencySymbol}{alert.currentPrice?.toFixed(2)} • {alert.confidenceScore}% Confidence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Audio test/replay button */}
          <button
            onClick={handleReplaySound}
            className={`p-1.5 rounded-lg transition-colors ${
              isBuy
                ? 'text-emerald-400 hover:bg-emerald-950/60'
                : 'text-rose-400 hover:bg-rose-950/60'
            }`}
            title="Replay Alert Audio Sound"
          >
            <Volume2 className="w-4 h-4" />
          </button>

          {/* Dismiss button */}
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title="Dismiss Alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Signal Headline */}
      <p className="mt-2 text-xs text-slate-200 line-clamp-2">
        {alert.signalHeadline}
      </p>

      {/* Target & Stop info */}
      <div className="mt-2.5 p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] font-mono flex items-center justify-between text-slate-300">
        <div>
          <span className="text-slate-400">Stop:</span>{' '}
          <strong className="text-rose-300">
            {alert.currencySymbol}{alert.suggestedStopLoss?.toFixed(2)}
          </strong>
        </div>
        <div>
          <span className="text-slate-400">Target:</span>{' '}
          <strong className="text-emerald-300">
            {alert.currencySymbol}{alert.suggestedTargetPrice?.toFixed(2)}
          </strong>
        </div>
        <div className="text-cyan-400 font-bold">
          {alert.rewardToRisk?.toFixed(1)}:1 R:R
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          onClick={() => {
            toggleSoundAlerts();
          }}
          className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1"
          title="Toggle audio sounds on or off"
        >
          {isSoundOn ? (
            <>
              <Volume2 className="w-3 h-3 text-emerald-400" />
              <span>Sound: ON</span>
            </>
          ) : (
            <>
              <VolumeX className="w-3 h-3 text-slate-500" />
              <span>Sound: OFF</span>
            </>
          )}
        </button>

        <button
          onClick={() => {
            onSelectSymbol(alert.symbol);
            onDismiss();
          }}
          className={`px-3 py-1 rounded-lg text-xs font-bold font-sans flex items-center gap-1 transition-all ${
            isBuy
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              : isSell
              ? 'bg-rose-500 hover:bg-rose-400 text-white'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
          }`}
        >
          <span>View Live Setup</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
