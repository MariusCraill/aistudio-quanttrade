import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Crosshair,
  TrendingUp,
  Activity,
  Layers,
  Clock,
  X,
} from 'lucide-react';

interface StrategyFrameworkGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StrategyFrameworkGuide({ isOpen, onClose }: StrategyFrameworkGuideProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full max-h-[88vh] overflow-y-auto shadow-2xl p-6 relative flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Quantitative Trading Framework &amp; Mathematical Edge Specification
              </h2>
              <p className="text-xs text-slate-400">
                Objective criteria for automated scanning, standardized entry/exit rules, and probability math
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Three Quantitative Pillars */}
        <div>
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" /> 1. How to Analyze Shares: Three Pillars
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="font-semibold text-slate-200 text-xs block mb-1 text-cyan-300">
                A. Trend Quality
              </span>
              <p className="text-xs text-slate-400 leading-relaxed">
                Evaluates macro alignment across moving averages (Price &gt; 20 SMA &gt; 50 SMA &gt; 200 SMA) and higher-highs / higher-lows market structure. Avoids counter-trend traps.
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="font-semibold text-slate-200 text-xs block mb-1 text-amber-300">
                B. Confluence
              </span>
              <p className="text-xs text-slate-400 leading-relaxed">
                Multi-signal confirmation where price breakout or moving average test coincides with volume surges, RSI resets, and volatility compression.
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="font-semibold text-slate-200 text-xs block mb-1 text-emerald-300">
                C. Volatility
              </span>
              <p className="text-xs text-slate-400 leading-relaxed">
                Quantified via 14-day Average True Range (ATR). Classifies market regime into Low Compression, Normal, or High Expansion to calibrate stops dynamically.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Entry, Exit, and Duration Estimation Framework */}
        <div>
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Crosshair className="w-4 h-4" /> 2. Entry, Exit, &amp; Duration Estimation Framework
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col gap-2">
              <span className="font-semibold text-slate-200 text-xs text-blue-400">
                Entry Point Triggers (Predetermined Rules)
              </span>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li>
                  <strong className="text-white">Momentum Breakout:</strong> Price breaks above the 20-day high with Volume &gt; 1.5x the 20-day Average Volume.
                </li>
                <li>
                  <strong className="text-white">Mean-Reversion Pullback:</strong> Price touches the 20-day or 50-day Simple Moving Average (SMA) while RSI-14 drops below 40 in a structural uptrend.
                </li>
              </ul>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col gap-2">
              <span className="font-semibold text-slate-200 text-xs text-rose-400">
                Exit Point 1 — Stop Loss (Invalidation Level)
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                Set stops using structural levels rather than fixed percentages: place stops just below the recent swing low or using <strong>2x Average True Range (ATR)</strong> below entry to adjust for current market volatility.
              </p>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col gap-2">
              <span className="font-semibold text-slate-200 text-xs text-emerald-400">
                Exit Point 2 — Take Profit (Target)
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                Defined using key resistance levels or dynamic targets based on risk multiples:
                <code className="block mt-1 font-mono text-emerald-300 bg-slate-900 p-1.5 rounded">
                  Target = Entry + (R &times; Risk) [e.g. 2.0R to 2.5R]
                </code>
              </p>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col gap-2">
              <span className="font-semibold text-slate-200 text-xs text-amber-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Estimated Trade Duration
              </span>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li>
                  <strong className="text-white">Swing Trades:</strong> Typically 3 to 15 days (tracking 10-day to 20-day moving average holds).
                </li>
                <li>
                  <strong className="text-white">Position Trades:</strong> 3 weeks to 3 months (holding as long as price remains above the 50-day SMA).
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Section 3: Mathematical Probability & Risk-Reward Calculations */}
        <div>
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Scale className="w-4 h-4" /> 3. Mathematical Probability &amp; Position Sizing Formulas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl font-mono text-xs">
              <div className="text-emerald-400 font-bold mb-1 font-sans">A. Reward-to-Risk (R:R)</div>
              <div className="text-slate-300 bg-slate-900 p-2 rounded mb-2 text-center">
                R:R = (Target - Entry) / (Entry - Stop)
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                <strong className="text-white">The 2:1 Rule:</strong> Never enter a setup where R:R &lt; 2.0. A minimum 2:1 ratio allows long-term profitability even with a 40% win rate.
              </p>
            </div>

            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl font-mono text-xs">
              <div className="text-cyan-400 font-bold mb-1 font-sans">B. Expected Value (EV)</div>
              <div className="text-slate-300 bg-slate-900 p-2 rounded mb-2 text-center">
                EV = (W &times; R) - (1 - W)
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                W = Win Rate, R = R:R. Example: (0.45 &times; 2.5) - (0.55) = <strong className="text-cyan-300">+0.575</strong> per dollar risked. Any EV &gt; 0 represents statistical edge.
              </p>
            </div>

            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl font-mono text-xs">
              <div className="text-amber-400 font-bold mb-1 font-sans">C. Fractional Kelly (K%)</div>
              <div className="text-slate-300 bg-slate-900 p-2 rounded mb-2 text-center">
                K% = W - ((1 - W) / R)
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                Maximizes long-term growth while avoiding ruin. Use <strong className="text-amber-300">Half-Kelly (K% / 2)</strong> or a 1% to 2% fixed account risk limit to avoid severe drawdowns.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold text-xs transition-colors"
          >
            Close Guide &amp; Return to Terminal
          </button>
        </div>
      </div>
    </div>
  );
}
