import { useState, useMemo } from 'react';
import { TradeSetup, SetupType, AIRankedTradeOption } from '../types';
import { calculateTargetDuration } from '../services/targetDurationService';
import { rankTradeOptionsWithAI } from '../services/aiTradeService';
import {
  Search,
  Flame,
  RotateCcw,
  ShieldCheck,
  Activity,
  ChevronRight,
  RefreshCw,
  Clock,
  Sparkles,
  BrainCircuit,
  Briefcase,
  CheckCircle2,
  Calendar,
  Zap,
} from 'lucide-react';

interface MarketScannerProps {
  setups: TradeSetup[];
  selectedSetupId: string | null;
  onSelectSetup: (setup: TradeSetup) => void;
  onRefreshScan: () => void;
  initialExchangeFilter?: 'ALL' | 'JSE' | 'US';
}

export default function MarketScanner({
  setups,
  selectedSetupId,
  onSelectSetup,
  onRefreshScan,
  initialExchangeFilter = 'ALL',
}: MarketScannerProps) {
  const [filterType, setFilterType] = useState<'ALL' | SetupType | 'HIGH_CONFLUENCE' | 'ATR_SURGE'>('ALL');
  const [exchangeFilter, setExchangeFilter] = useState<'ALL' | 'JSE' | 'US'>(initialExchangeFilter);
  const [searchQuery, setSearchQuery] = useState('');

  // AI Options Ranking State
  const [aiRankings, setAiRankings] = useState<AIRankedTradeOption[] | null>(null);
  const [isAiRankingLoading, setIsAiRankingLoading] = useState(false);
  const [showAiTopPicksOnly, setShowAiTopPicksOnly] = useState(false);

  // Precompute target duration estimates for all setups for fast rendering
  const durationMap = useMemo(() => {
    const map = new Map<string, { days: number; date: string }>();
    for (const s of setups) {
      const proj = calculateTargetDuration(s);
      map.set(s.id, {
        days: proj.expectedTradingDays,
        date: proj.expectedTargetDate,
      });
    }
    return map;
  }, [setups]);

  // Lookup map for AI rankings by symbol
  const aiRankMap = useMemo(() => {
    if (!aiRankings) return new Map<string, AIRankedTradeOption>();
    const map = new Map<string, AIRankedTradeOption>();
    for (const r of aiRankings) {
      map.set(r.symbol, r);
    }
    return map;
  }, [aiRankings]);

  const filteredSetups = setups.filter(setup => {
    // Exchange filter
    if (exchangeFilter !== 'ALL') {
      const isJSE = setup.exchange === 'JSE' || setup.symbol.endsWith('.JO');
      if (exchangeFilter === 'JSE' && !isJSE) return false;
      if (exchangeFilter === 'US' && isJSE) return false;
    }

    // AI Top Picks filter
    if (showAiTopPicksOnly && aiRankMap.size > 0) {
      const r = aiRankMap.get(setup.symbol);
      if (!r || (r.actionTag !== 'STRONG_BUY' && r.actionTag !== 'ACCUMULATE')) {
        return false;
      }
    }

    // Search query filter
    const matchesSearch =
      setup.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      setup.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Signal type filter
    if (filterType === 'ALL') return true;
    if (filterType === 'HIGH_CONFLUENCE') return setup.confluenceScore >= 70;
    if (filterType === 'ATR_SURGE') return Boolean(setup.isAtrSurgeActive);
    return setup.setupType === filterType;
  });

  const jseCount = setups.filter(s => s.exchange === 'JSE' || s.symbol.endsWith('.JO')).length;
  const usCount = setups.filter(s => s.exchange === 'US' || !s.symbol.endsWith('.JO')).length;

  const handleRunAiRank = async () => {
    if (setups.length === 0) return;
    setIsAiRankingLoading(true);
    try {
      const ranked = await rankTradeOptionsWithAI(setups);
      setAiRankings(ranked);
    } catch (e) {
      console.error('Failed to rank trade options with AI:', e);
    } finally {
      setIsAiRankingLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
      {/* Scanner Header Controls */}
      <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Automated Signal Scanner
              <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-[10px] text-cyan-300 font-mono">
                {filteredSetups.length} / {setups.length} Real Tickers
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Live quantitative scan over Johannesburg Stock Exchange (JSE) &amp; US Markets
            </p>
          </div>
        </div>

        {/* Action Button: AI Options Ranking */}
        <div className="flex items-center gap-2">
          <button
            id="btn-ai-rank-options"
            onClick={handleRunAiRank}
            disabled={isAiRankingLoading || setups.length === 0}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            {isAiRankingLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Ranking Options with AI...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                {aiRankings ? 'Re-Rank Options (AI)' : 'AI Analyze Trade Options'}
              </>
            )}
          </button>

          {aiRankings && (
            <button
              onClick={() => setShowAiTopPicksOnly(!showAiTopPicksOnly)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                showAiTopPicksOnly
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <BrainCircuit className="w-3.5 h-3.5" />
              {showAiTopPicksOnly ? 'Showing AI Top Picks' : 'Filter AI Top Picks'}
            </button>
          )}

          <button
            onClick={onRefreshScan}
            title="Refresh Scan"
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Exchange Filter Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setExchangeFilter('ALL')}
            className={`px-3 py-1 rounded transition-colors font-medium cursor-pointer ${
              exchangeFilter === 'ALL'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({setups.length})
          </button>
          <button
            onClick={() => setExchangeFilter('JSE')}
            className={`px-3 py-1 rounded transition-colors font-medium flex items-center gap-1.5 cursor-pointer ${
              exchangeFilter === 'JSE'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🇿🇦 JSE ({jseCount})</span>
          </button>
          <button
            onClick={() => setExchangeFilter('US')}
            className={`px-3 py-1 rounded transition-colors font-medium flex items-center gap-1.5 cursor-pointer ${
              exchangeFilter === 'US'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🇺🇸 US ({usCount})</span>
          </button>
        </div>

        {/* Signal Filter Pills */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-2.5 py-1 rounded transition-colors font-medium ${
              filterType === 'ALL'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Signals
          </button>
          <button
            onClick={() => setFilterType('MOMENTUM_BREAKOUT')}
            className={`px-2.5 py-1 rounded transition-colors font-medium flex items-center gap-1 ${
              filterType === 'MOMENTUM_BREAKOUT'
                ? 'bg-cyan-950 border border-cyan-800 text-cyan-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3 h-3 text-cyan-400" />
            Breakouts
          </button>
          <button
            onClick={() => setFilterType('MEAN_REVERSION_PULLBACK')}
            className={`px-2.5 py-1 rounded transition-colors font-medium flex items-center gap-1 ${
              filterType === 'MEAN_REVERSION_PULLBACK'
                ? 'bg-amber-950 border border-amber-800 text-amber-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            Pullbacks
          </button>
          <button
            onClick={() => setFilterType('HIGH_CONFLUENCE')}
            className={`px-2.5 py-1 rounded transition-colors font-medium flex items-center gap-1 ${
              filterType === 'HIGH_CONFLUENCE'
                ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            Confluence &ge;70
          </button>
          <button
            onClick={() => setFilterType('ATR_SURGE')}
            className={`px-2.5 py-1 rounded transition-colors font-medium flex items-center gap-1 ${
              filterType === 'ATR_SURGE'
                ? 'bg-amber-950 border border-amber-600 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
            Active ATR Surges ({setups.filter(s => s.isAtrSurgeActive).length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search ticker or name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500 w-36 sm:w-48 font-mono"
          />
        </div>
      </div>

      {/* AI Trade Options Universe Summary (When Ranked) */}
      {aiRankings && (
        <div className="bg-indigo-950/20 border-b border-indigo-900/40 p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Gemini AI Universe Ranking: Top Trade Options Analyzed
            </span>
            <span className="text-[11px] font-mono text-indigo-400">
              Evaluated by expected duration, R:R, and portfolio safety
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {aiRankings.slice(0, 4).map(r => (
              <div
                key={r.symbol}
                onClick={() => {
                  const target = setups.find(s => s.symbol === r.symbol);
                  if (target) onSelectSetup(target);
                }}
                className="p-2.5 rounded-lg bg-slate-950/90 border border-indigo-800/50 hover:border-indigo-500 transition-colors cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-100 font-mono">
                    #{r.rank} {r.symbol}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold font-mono ${
                      r.actionTag === 'STRONG_BUY'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                    }`}
                  >
                    {r.actionTag.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-[11px] text-amber-300 font-mono my-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> ~{r.expectedDaysToTarget}d ({r.targetDate})
                </div>
                <div className="text-[10px] text-slate-400 line-clamp-2">
                  {r.rationale}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market Status Notification Banner */}
      <div className="bg-slate-950/90 border-b border-slate-800 px-4 py-2 text-xs font-mono flex flex-wrap items-center justify-between gap-2 text-slate-400">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            Market Sessions: When an exchange is closed, trade setups reflect official session close data. Orders can be staged for market open.
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>🔴 Market is Closed</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>🟢 Market is Open</span>
          </span>
        </div>
      </div>

      {/* Scanned Candidates Grid / Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-2.5 px-4 font-semibold">Asset / Symbol</th>
              <th className="py-2.5 px-3 font-semibold">Exchange &amp; Status</th>
              <th className="py-2.5 px-3 font-semibold">Signal Type</th>
              <th className="py-2.5 px-3 font-semibold">Target Arrival ETA</th>
              <th className="py-2.5 px-3 font-semibold">Trend Quality</th>
              <th className="py-2.5 px-3 font-semibold">Volatility (ATR-14)</th>
              <th className="py-2.5 px-3 font-semibold">Entry / Stop / Target</th>
              <th className="py-2.5 px-3 font-semibold text-right">R:R Ratio</th>
              {aiRankings && <th className="py-2.5 px-3 font-semibold text-center">AI Verdict</th>}
              <th className="py-2.5 px-4 font-semibold text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredSetups.map(setup => {
              const isSelected = setup.id === selectedSetupId;
              const isJSE = setup.exchange === 'JSE' || setup.symbol.endsWith('.JO');
              const currSym = setup.currencySymbol || (isJSE ? 'R' : '$');
              const isClosed = setup.marketStatus === 'CLOSED';
              const duration = durationMap.get(setup.id);
              const aiVerdict = aiRankMap.get(setup.symbol);

              return (
                <tr
                  key={setup.id}
                  onClick={() => onSelectSetup(setup)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-cyan-950/30 hover:bg-cyan-950/40'
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  {/* Symbol & Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-100 text-xs">
                        {setup.symbol.replace('.JO', '')}
                      </div>
                      <div>
                        <div className="font-bold text-slate-100 flex items-center gap-1.5">
                          {setup.symbol}
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans truncate max-w-[120px]">
                          {setup.name}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Exchange & Market Status */}
                  <td className="py-3 px-3">
                    <div className="flex flex-col gap-1 items-start">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        {isJSE ? '🇿🇦 JSE' : '🇺🇸 US'}
                      </span>
                      {isClosed ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          Closed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/80 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          Open
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Signal Type */}
                  <td className="py-3 px-3">
                    {setup.setupType === 'MOMENTUM_BREAKOUT' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 text-[11px] font-semibold">
                        <Flame className="w-3 h-3" /> Breakout
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-800/80 text-amber-300 text-[11px] font-semibold">
                        <RotateCcw className="w-3 h-3" /> Pullback
                      </span>
                    )}
                    <div className="text-[10px] text-slate-500 mt-1 truncate max-w-[130px]">
                      {setup.horizon === 'SWING' ? 'Swing (3-15d)' : 'Position (3w-3m)'}
                    </div>
                  </td>

                  {/* Target Arrival ETA */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 text-amber-300 font-bold text-xs">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>~{duration?.days ?? 12}d</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {duration?.date ?? 'Next 2 Weeks'}
                    </span>
                  </td>

                  {/* Trend Quality */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                          style={{ width: `${setup.trendQualityScore}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-200">
                        {setup.trendQualityScore}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {setup.confluenceScore} pts conf
                    </span>
                  </td>

                  {/* Volatility (ATR-14 vs 20d MA) */}
                  <td className="py-3 px-3">
                    <div className="text-slate-200">
                      {currSym}{setup.atr14.toFixed(2)} ({setup.atrPercent.toFixed(1)}%)
                    </div>
                    {setup.isAtrSurgeActive ? (
                      <div className="mt-1">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                            setup.volatilityAlert?.severity === 'EXTREME_ANOMALY'
                              ? 'bg-rose-950 text-rose-300 border border-rose-700 animate-pulse'
                              : 'bg-amber-950 text-amber-300 border border-amber-700'
                          }`}
                          title={`Current ATR (${currSym}${setup.atr14.toFixed(2)}) > 20d MA (${currSym}${setup.atrMa20 ? setup.atrMa20.toFixed(2) : '-'}). Breakout expansion active.`}
                        >
                          <Zap className="w-2.5 h-2.5" />
                          +{setup.volatilitySurgeRatio ? Math.round((setup.volatilitySurgeRatio - 1) * 100) : 15}% vs 20d MA
                        </span>
                      </div>
                    ) : (
                      <span
                        className={`text-[10px] px-1 py-0.2 rounded inline-block mt-0.5 ${
                          setup.volatilityState === 'Low Compression'
                            ? 'text-cyan-400'
                            : setup.volatilityState === 'High Expansion'
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {setup.volatilityState}
                      </span>
                    )}
                  </td>

                  {/* Execution Levels */}
                  <td className="py-3 px-3 text-slate-300 text-[11px]">
                    <div>
                      Entry: <strong className="text-white">{currSym}{setup.entryPrice.toFixed(2)}</strong>
                    </div>
                    <div className="text-slate-400 text-[10px]">
                      SL: <span className="text-rose-400">{currSym}{setup.stopLossPrice.toFixed(2)}</span> • TP: <span className="text-emerald-400">{currSym}{setup.targetPrice.toFixed(2)}</span>
                    </div>
                  </td>

                  {/* R:R Ratio */}
                  <td className="py-3 px-3 text-right">
                    <div
                      className={`text-sm font-bold ${
                        setup.rewardToRisk >= 2.0 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {setup.rewardToRisk.toFixed(2)}:1
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {setup.rewardToRisk >= 2.0 ? 'Valid \u2265 2:1' : 'Below 2:1'}
                    </span>
                  </td>

                  {/* AI Verdict Column (If loaded) */}
                  {aiRankings && (
                    <td className="py-3 px-3 text-center">
                      {aiVerdict ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              aiVerdict.actionTag === 'STRONG_BUY'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : aiVerdict.actionTag === 'ACCUMULATE'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {aiVerdict.actionTag.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Rank #{aiVerdict.rank}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-600">-</span>
                      )}
                    </td>
                  )}

                  {/* Action */}
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onSelectSetup(setup);
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-sans font-medium flex items-center gap-1 mx-auto transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      Analyze
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
