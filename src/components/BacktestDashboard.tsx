import { useState, useMemo } from 'react';
import {
  CandleData,
  BacktestSummary,
  SetupType,
  StopLossType,
  TradeHorizon,
} from '../types';
import { runContinuousBacktest } from '../services/backtestEngine';
import {
  LineChart,
  Play,
  RotateCcw,
  TrendingUp,
  Percent,
  Award,
  AlertTriangle,
  ArrowDownRight,
  CheckCircle,
  Clock,
  Sparkles,
  Download,
} from 'lucide-react';

interface BacktestDashboardProps {
  candles: CandleData[];
  symbol: string;
  onApplyWinRateToAnalyzer: (winRate: number) => void;
}

export default function BacktestDashboard({
  candles,
  symbol,
  onApplyWinRateToAnalyzer,
}: BacktestDashboardProps) {
  const [strategy, setStrategy] = useState<'ALL' | SetupType>('ALL');
  const [stopLossType, setStopLossType] = useState<StopLossType>('ATR_2X');
  const [targetMultiplier, setTargetMultiplier] = useState<number>(2.5);
  const [horizon, setHorizon] = useState<TradeHorizon>('SWING');
  const [appliedNotification, setAppliedNotification] = useState(false);

  // Run backtest computation
  const summary: BacktestSummary = useMemo(() => {
    return runContinuousBacktest({
      candles,
      strategy,
      stopLossType,
      targetMultiplier,
      horizon,
      startingCapital: 50000,
      riskPercent: 1.5,
    });
  }, [candles, strategy, stopLossType, targetMultiplier, horizon]);

  const handleApply = () => {
    onApplyWinRateToAnalyzer(summary.winRate);
    setAppliedNotification(true);
    setTimeout(() => setAppliedNotification(false), 2400);
  };

  // Equity curve SVG geometry
  const equityPoints = summary.equityCurve;
  const minEquity = Math.min(0, ...equityPoints.map(p => p.equityR));
  const maxEquity = Math.max(1, ...equityPoints.map(p => p.equityR));
  const range = maxEquity - minEquity || 1;

  const svgWidth = 700;
  const svgHeight = 160;
  const padding = 20;

  const pointsString = equityPoints
    .map((p, idx) => {
      const x = padding + (idx / Math.max(1, equityPoints.length - 1)) * (svgWidth - 2 * padding);
      const y = svgHeight - padding - ((p.equityR - minEquity) / range) * (svgHeight - 2 * padding);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col gap-5 p-5">
      {/* Top Header & Strategy Parameters */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-100">
              Continuous Backtest Engine • {symbol} (1 Year Historical Data)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Empirically verifies entry triggers, 2x ATR / swing invalidation, and R:R outcomes without manual bias
          </p>
        </div>

        {/* Sync with Analyzer CTA */}
        <button
          id="btn-sync-backtest-stats"
          onClick={handleApply}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md ${
            appliedNotification
              ? 'bg-emerald-600 text-white'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer active:scale-95'
          }`}
        >
          {appliedNotification ? (
            <>
              <CheckCircle className="w-3.5 h-3.5" />
              Empirical {Math.round(summary.winRate * 100)}% W Synced to Analyzer!
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Apply Empirical Win Rate ({Math.round(summary.winRate * 100)}%) to Sizing
            </>
          )}
        </button>
      </div>

      {/* Parameter Controls Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 text-xs">
        {/* Strategy Filter */}
        <div>
          <label className="block text-slate-400 mb-1 font-medium">Trigger Rule</label>
          <select
            value={strategy}
            onChange={e => setStrategy(e.target.value as any)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-xs"
          >
            <option value="ALL">Both Breakout & Pullback</option>
            <option value="MOMENTUM_BREAKOUT">Momentum Breakout (&gt;20d High)</option>
            <option value="MEAN_REVERSION_PULLBACK">Mean-Reversion Pullback (SMA+RSI)</option>
          </select>
        </div>

        {/* Stop Loss Rule */}
        <div>
          <label className="block text-slate-400 mb-1 font-medium">Invalidation Stop</label>
          <select
            value={stopLossType}
            onChange={e => setStopLossType(e.target.value as any)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-xs"
          >
            <option value="ATR_2X">2x ATR Volatility Stop</option>
            <option value="STRUCTURAL_SWING_LOW">Structural Swing Low Stop</option>
          </select>
        </div>

        {/* Target Multiple */}
        <div>
          <label className="block text-slate-400 mb-1 font-medium">Take Profit Target</label>
          <select
            value={targetMultiplier}
            onChange={e => setTargetMultiplier(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-xs"
          >
            <option value={2.0}>2.0x Risk (Minimum 2:1)</option>
            <option value={2.5}>2.5x Risk (Recommended)</option>
            <option value={3.0}>3.0x Risk (High Momentum)</option>
          </select>
        </div>

        {/* Holding Horizon */}
        <div>
          <label className="block text-slate-400 mb-1 font-medium">Holding Horizon</label>
          <select
            value={horizon}
            onChange={e => setHorizon(e.target.value as any)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-xs"
          >
            <option value="SWING">Swing (3 to 15 Days)</option>
            <option value="POSITION">Position (3w to 3 Months)</option>
          </select>
        </div>
      </div>

      {/* Backtest Empirical Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Win Rate */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
            Empirical Win Rate (W)
          </span>
          <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
            {(summary.winRate * 100).toFixed(1)}%
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {summary.wins}W / {summary.losses}L ({summary.totalTrades} trades)
          </span>
        </div>

        {/* Total R Return */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
            Net Edge Return
          </span>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              summary.totalPnlR >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {summary.totalPnlR >= 0 ? '+' : ''}
            {summary.totalPnlR.toFixed(1)} R
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {summary.totalPnlR > 0 ? 'Consistent Alpha' : 'Re-tune entries'}
          </span>
        </div>

        {/* Expected Value per $ risked */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
            Expected Value (EV)
          </span>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              summary.expectedValue > 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {summary.expectedValue > 0 ? '+' : ''}
            {summary.expectedValue.toFixed(3)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Per $1 risked</span>
        </div>

        {/* Profit Factor */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
            Profit Factor
          </span>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1">
            {summary.profitFactor.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Gross Wins / Losses</span>
        </div>

        {/* Max Drawdown */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
            Max Drawdown
          </span>
          <div className="text-xl font-bold font-mono text-rose-400 mt-1">
            -{summary.maxDrawdownR.toFixed(1)} R
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Peak-to-trough</span>
        </div>

        {/* Sharpe Ratio */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
            Sharpe Ratio
          </span>
          <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
            {summary.sharpeRatio.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Risk-adjusted</span>
        </div>
      </div>

      {/* Equity Curve Visualization (SVG) */}
      <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            Cumulative Equity Curve (in R-multiples of risk)
          </span>
          <span className="text-slate-400">
            Final Equity: <strong className="text-emerald-400 font-bold">+{summary.totalPnlR.toFixed(1)}R</strong> ($
            {summary.equityCurve[summary.equityCurve.length - 1]?.capital.toLocaleString()})
          </span>
        </div>

        <div className="relative w-full h-40 bg-slate-950 rounded-lg overflow-hidden border border-slate-800/60 flex items-center justify-center">
          {equityPoints.length > 1 ? (
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-full preserve-3d"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Zero R baseline */}
              {minEquity < 0 && maxEquity > 0 && (
                <line
                  x1={padding}
                  y1={svgHeight - padding - ((0 - minEquity) / range) * (svgHeight - 2 * padding)}
                  x2={svgWidth - padding}
                  y2={svgHeight - padding - ((0 - minEquity) / range) * (svgHeight - 2 * padding)}
                  stroke="#475569"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              )}

              {/* Shaded Area */}
              <polygon
                points={`${padding},${svgHeight - padding} ${pointsString} ${svgWidth - padding},${svgHeight - padding}`}
                fill="url(#equityGrad)"
              />

              {/* Line */}
              <polyline
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pointsString}
              />
            </svg>
          ) : (
            <div className="text-xs text-slate-500 font-mono">No backtest trades executed yet</div>
          )}
        </div>
      </div>

      {/* Trade-by-Trade Execution Log Table */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <h3 className="font-bold text-slate-200">Historical Signal Executions ({summary.trades.length})</h3>
          <span className="text-[11px] text-slate-400 font-mono">
            Evaluated on real daily OHLCV bars
          </span>
        </div>

        <div className="overflow-x-auto max-h-60 overflow-y-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2 px-3">Trade #</th>
                <th className="py-2 px-3">Trigger</th>
                <th className="py-2 px-3">Entry Date</th>
                <th className="py-2 px-3">Exit Date</th>
                <th className="py-2 px-3">Entry / Exit</th>
                <th className="py-2 px-3">Holding</th>
                <th className="py-2 px-3">Exit Reason</th>
                <th className="py-2 px-3 text-right">Result (R)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
              {summary.trades.map((t, idx) => (
                <tr key={t.id} className="hover:bg-slate-800/30">
                  <td className="py-2 px-3 text-slate-400">{t.id}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        t.setupType === 'MOMENTUM_BREAKOUT'
                          ? 'bg-cyan-950 text-cyan-300'
                          : 'bg-amber-950 text-amber-300'
                      }`}
                    >
                      {t.setupType === 'MOMENTUM_BREAKOUT' ? 'Breakout' : 'Pullback'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-300">{t.entryDate}</td>
                  <td className="py-2 px-3 text-slate-300">{t.exitDate}</td>
                  <td className="py-2 px-3 text-slate-300">
                    ${t.entryPrice.toFixed(2)} &rarr; ${t.exitPrice.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-slate-400">{t.holdingDays}d</td>
                  <td className="py-2 px-3 text-slate-400 truncate max-w-[160px]">{t.exitReason}</td>
                  <td className="py-2 px-3 text-right">
                    <span
                      className={`font-bold ${
                        t.pnlR > 0
                          ? 'text-emerald-400'
                          : t.pnlR === 0
                          ? 'text-slate-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {t.pnlR > 0 ? '+' : ''}
                      {t.pnlR.toFixed(1)} R
                    </span>
                  </td>
                </tr>
              ))}
              {summary.trades.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-slate-500">
                    No signals triggered under current parameter constraints.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
