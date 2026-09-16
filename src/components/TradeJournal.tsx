import { useState, useEffect } from 'react';
import { SavedJournalEntry } from '../types';
import {
  BookOpen,
  Trash2,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

interface TradeJournalProps {
  entries: SavedJournalEntry[];
  onUpdateEntry: (updated: SavedJournalEntry) => void;
  onDeleteEntry: (id: string) => void;
  onClearAll: () => void;
}

export default function TradeJournal({
  entries,
  onUpdateEntry,
  onDeleteEntry,
  onClearAll,
}: TradeJournalProps) {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Stats calculation
  const totalLogged = entries.length;
  const executedTrades = entries.filter(e => e.status === 'WON' || e.status === 'LOST');
  const wins = entries.filter(e => e.status === 'WON').length;
  const paperWinRate =
    executedTrades.length > 0 ? (wins / executedTrades.length) * 100 : 0;
  const totalRiskCommitted = entries.reduce((sum, e) => sum + e.riskDollars, 0);

  const filtered = entries.filter(e => {
    if (filterStatus === 'ALL') return true;
    return e.status === filterStatus;
  });

  const exportCSV = () => {
    if (entries.length === 0) return;
    const headers = [
      'ID',
      'Date',
      'Symbol',
      'SetupType',
      'EntryPrice',
      'StopLossPrice',
      'TargetPrice',
      'RewardToRisk',
      'ExpectedValue',
      'Shares',
      'RiskDollars',
      'Status',
      'Notes',
    ];
    const rows = entries.map(e => [
      e.id,
      e.createdAt,
      e.symbol,
      e.setupType,
      e.entryPrice,
      e.stopLossPrice,
      e.targetPrice,
      e.rewardToRisk,
      e.expectedValue,
      e.shares,
      e.riskDollars,
      e.status,
      `"${e.notes.replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `trade_journal_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-100">
              Trade Setup Journal & Execution Log
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300 font-mono">
              {entries.length} Logged
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Structured database logging standardized criteria, R:R metrics, and paper trade outcomes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={entries.length === 0}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          {entries.length > 0 && (
            <button
              onClick={onClearAll}
              className="px-2.5 py-1.5 rounded-lg border border-rose-900/60 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs transition-colors"
              title="Clear all saved setups"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Journal Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Logged Setups</span>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">{totalLogged}</div>
          <span className="text-[10px] text-slate-500 font-mono">Local persistence active</span>
        </div>

        <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Completed Trades</span>
          <div className="text-xl font-bold font-mono text-cyan-400 mt-1">{executedTrades.length}</div>
          <span className="text-[10px] text-slate-500 font-mono">Won / Lost marked</span>
        </div>

        <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Journal Win Rate</span>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {paperWinRate.toFixed(1)}%
          </div>
          <span className="text-[10px] text-slate-500 font-mono">{wins} wins logged</span>
        </div>

        <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Risk Committed</span>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1">
            ${totalRiskCommitted.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">1R per setup</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 text-xs bg-slate-950 p-1 rounded-lg border border-slate-800 self-start">
        {['ALL', 'PLANNED', 'EXECUTED', 'WON', 'LOST'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1 rounded transition-colors font-mono font-medium ${
              filterStatus === status
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Table / List */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Date / ID</th>
              <th className="py-2.5 px-3">Symbol</th>
              <th className="py-2.5 px-3">Trigger Type</th>
              <th className="py-2.5 px-3">Entry / Stop / Target</th>
              <th className="py-2.5 px-3">R:R Ratio</th>
              <th className="py-2.5 px-3">Sizing (Shares &amp; Risk)</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
            {filtered.map(entry => (
              <tr key={entry.id} className="hover:bg-slate-800/30">
                <td className="py-3 px-3 text-slate-400">
                  <div>{entry.createdAt}</div>
                  <div className="text-[10px] text-slate-500">{entry.id}</div>
                </td>

                <td className="py-3 px-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-100 text-sm">{entry.symbol}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-slate-300">
                      {entry.exchange === 'JSE' || entry.symbol.endsWith('.JO') ? '🇿🇦 JSE' : '🇺🇸 US'}
                    </span>
                  </div>
                </td>

                <td className="py-3 px-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      entry.setupType === 'MOMENTUM_BREAKOUT'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/80'
                        : 'bg-amber-950 text-amber-300 border border-amber-800/80'
                    }`}
                  >
                    {entry.setupType === 'MOMENTUM_BREAKOUT' ? 'Breakout' : 'Pullback'}
                  </span>
                </td>

                {(() => {
                  const isJSE = entry.exchange === 'JSE' || entry.symbol.endsWith('.JO');
                  const sym = entry.currencySymbol || (isJSE ? 'R' : '$');
                  return (
                    <>
                      <td className="py-3 px-3 text-slate-300">
                        <div>
                          Entry: <strong className="text-white">{sym}{entry.entryPrice.toFixed(2)}</strong>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          SL: <span className="text-rose-400">{sym}{entry.stopLossPrice.toFixed(2)}</span> • TP:{' '}
                          <span className="text-emerald-400">{sym}{entry.targetPrice.toFixed(2)}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div
                          className={`font-bold ${
                            entry.rewardToRisk >= 2.0 ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {entry.rewardToRisk.toFixed(2)}:1
                        </div>
                        <div className="text-[10px] text-slate-400">
                          EV: {entry.expectedValue > 0 ? '+' : ''}
                          {entry.expectedValue.toFixed(2)}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-300">
                        <div>
                          {entry.shares} sh ({sym}{(entry.shares * entry.entryPrice).toLocaleString()})
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Risk: {sym}{entry.riskDollars.toLocaleString()}
                        </div>
                      </td>
                    </>
                  );
                })()}

                <td className="py-3 px-3">
                  <select
                    value={entry.status}
                    onChange={e =>
                      onUpdateEntry({
                        ...entry,
                        status: e.target.value as any,
                      })
                    }
                    className={`px-2 py-1 rounded text-xs font-mono font-semibold focus:outline-none ${
                      entry.status === 'WON'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : entry.status === 'LOST'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : entry.status === 'EXECUTED'
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    <option value="PLANNED">Planned</option>
                    <option value="EXECUTED">Active / Open</option>
                    <option value="WON">Won (+2R Target)</option>
                    <option value="LOST">Lost (-1R Stop)</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </td>

                <td className="py-3 px-3 text-right">
                  <button
                    onClick={() => onDeleteEntry(entry.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Delete entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-500">
                  No trade journal records found in this category. Click &quot;Log Trade Setup to Journal&quot; in the analyzer to save candidates!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
