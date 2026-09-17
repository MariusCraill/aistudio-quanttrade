import { useState, useEffect, FormEvent } from 'react';
import {
  BarChart2,
  Search,
  BookOpen,
  Activity,
  HelpCircle,
  TrendingUp,
  Globe,
  Clock,
  CheckCircle,
  AlertCircle,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { MarketStatusInfo } from '../types';
import { calculateMarketStatus } from '../services/marketDataService';
import { getYahooFinanceChartUrl } from '../utils/marketUrls';

export interface HeaderAssetOption {
  symbol: string;
  name: string;
  exchange?: 'JSE' | 'US';
  currencySymbol?: string;
}

interface HeaderProps {
  activeTab: 'ANALYZER' | 'SCANNER' | 'BACKTEST' | 'JOURNAL';
  onSelectTab: (tab: 'ANALYZER' | 'SCANNER' | 'BACKTEST' | 'JOURNAL') => void;
  assets: HeaderAssetOption[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  onOpenGuide: () => void;
  onOpenVolatilityRadar: () => void;
  activeSurgeCount?: number;
  journalCount: number;
  marketFilter: 'ALL' | 'JSE' | 'US';
  onSelectMarketFilter: (filter: 'ALL' | 'JSE' | 'US') => void;
  onSearchCustomTicker: (ticker: string) => void;
  isSearchingTicker?: boolean;
}

export default function Header({
  activeTab,
  onSelectTab,
  assets,
  selectedSymbol,
  onSelectSymbol,
  onOpenGuide,
  onOpenVolatilityRadar,
  activeSurgeCount = 0,
  journalCount,
  marketFilter,
  onSelectMarketFilter,
  onSearchCustomTicker,
  isSearchingTicker = false,
}: HeaderProps) {
  const [jseStatus, setJseStatus] = useState<MarketStatusInfo>(() => calculateMarketStatus('JSE'));
  const [usStatus, setUsStatus] = useState<MarketStatusInfo>(() => calculateMarketStatus('US'));
  const [customTickerInput, setCustomTickerInput] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Update clocks and open/closed status every 10 seconds
  useEffect(() => {
    const update = () => {
      setJseStatus(calculateMarketStatus('JSE'));
      setUsStatus(calculateMarketStatus('US'));
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeAsset = assets.find(a => a.symbol === selectedSymbol);
  const activeExchange = activeAsset?.exchange || (selectedSymbol.endsWith('.JO') ? 'JSE' : 'US');
  const activeStatus = activeExchange === 'JSE' ? jseStatus : usStatus;

  const filteredAssets = assets.filter(a => {
    if (marketFilter === 'ALL') return true;
    return a.exchange === marketFilter;
  });

  const handleCustomSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (customTickerInput.trim()) {
      onSearchCustomTicker(customTickerInput.trim());
      setCustomTickerInput('');
      setShowSearchModal(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 border-b border-slate-800 backdrop-blur-md">
      {/* Top Primary Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                TradeQuant
              </h1>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-cyan-950 border border-cyan-800 text-cyan-300">
                JSE &amp; US REAL FEEDS
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden md:block">
              Johannesburg Stock Exchange • NYSE / NASDAQ • Standardized Sizing
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800/90 text-xs font-medium">
          <button
            id="tab-analyzer"
            onClick={() => onSelectTab('ANALYZER')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === 'ANALYZER'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Interactive</span> Analyzer
          </button>

          <button
            id="tab-scanner"
            onClick={() => onSelectTab('SCANNER')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === 'SCANNER'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Scanner</span>
          </button>

          <button
            id="tab-backtest"
            onClick={() => onSelectTab('BACKTEST')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === 'BACKTEST'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Backtest</span>
          </button>

          <button
            id="tab-journal"
            onClick={() => onSelectTab('JOURNAL')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === 'JOURNAL'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Journal</span>
            {journalCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-900 text-cyan-200 text-[10px] font-mono">
                {journalCount}
              </span>
            )}
          </button>
        </nav>

        {/* Right Action Tools: Market Filter, Ticker Selector, Custom Search & Guide */}
        <div className="flex items-center gap-2">
          {/* Market selector (JSE / US / ALL) */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px] font-mono">
            <button
              onClick={() => onSelectMarketFilter('ALL')}
              className={`px-2 py-1 rounded transition-colors ${
                marketFilter === 'ALL'
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Show all assets"
            >
              ALL
            </button>
            <button
              onClick={() => onSelectMarketFilter('JSE')}
              className={`px-2 py-1 rounded transition-colors ${
                marketFilter === 'JSE'
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Johannesburg Stock Exchange"
            >
              🇿🇦 JSE
            </button>
            <button
              onClick={() => onSelectMarketFilter('US')}
              className={`px-2 py-1 rounded transition-colors ${
                marketFilter === 'US'
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="US Markets (NYSE / NASDAQ)"
            >
              🇺🇸 US
            </button>
          </div>

          {/* Ticker Dropdown */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
            <select
              id="select-active-ticker"
              value={selectedSymbol}
              onChange={e => onSelectSymbol(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-cyan-400 focus:outline-none cursor-pointer max-w-[150px] truncate"
            >
              {filteredAssets.map(a => (
                <option key={a.symbol} value={a.symbol} className="bg-slate-900 text-slate-100">
                  {a.exchange === 'JSE' ? '🇿🇦' : '🇺🇸'} {a.symbol} - {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Yahoo Finance Chart Quick Button */}
          <a
            href={getYahooFinanceChartUrl(selectedSymbol)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${selectedSymbol} interactive chart on Yahoo Finance`}
            className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg border border-purple-900/60 bg-purple-950/50 hover:bg-purple-900/70 text-purple-300 hover:text-purple-100 text-xs font-mono transition-colors"
          >
            <span className="font-black text-[10px] bg-purple-600 text-white px-1 rounded leading-tight">Y!</span>
            <span className="hidden xl:inline text-[11px]">Yahoo Chart</span>
            <ExternalLink className="w-3 h-3 text-purple-400" />
          </a>

          {/* Custom Search Form */}
          <form onSubmit={handleCustomSearchSubmit} className="hidden sm:flex items-center">
            <div className="relative">
              <input
                type="text"
                placeholder="Lookup (e.g. CPI.JO or NVDA)"
                value={customTickerInput}
                onChange={e => setCustomTickerInput(e.target.value)}
                className="w-36 lg:w-44 bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-2 py-1 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" />
            </div>
          </form>

          {/* Real-Time Volatility Alert Radar Trigger */}
          <button
            id="btn-open-volatility-radar"
            onClick={onOpenVolatilityRadar}
            className={`relative px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSurgeCount > 0
                ? 'border-amber-500/60 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                : 'border-slate-700/80 bg-slate-900 hover:bg-slate-800 text-slate-300'
            }`}
            title="Real-Time Volatility Alert Radar: Current ATR > 20d MA"
          >
            <Zap className={`w-3.5 h-3.5 ${activeSurgeCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">ATR Radar</span>
            {activeSurgeCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black animate-pulse">
                {activeSurgeCount}
              </span>
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            )}
          </button>

          {/* Guide Button */}
          <button
            id="btn-open-strategy-guide"
            onClick={onOpenGuide}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">Formulas</span>
          </button>
        </div>
      </div>

      {/* Real-Time Market Status Sub-Bar */}
      <div className="bg-slate-900/60 border-t border-slate-800/80 px-4 py-1.5 text-xs font-mono">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Active Ticker Market Status Announcement */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] font-sans">
              Active Stock: <strong className="text-slate-200 font-mono">{selectedSymbol}</strong> ({activeExchange === 'JSE' ? 'Johannesburg Stock Exchange' : 'US Markets'})
            </span>

            {/* Prominent Market Status Badge */}
            {activeStatus.isOpen ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/80 shadow-sm animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Market is Open
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800/80 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                Market is Closed
              </span>
            )}

            <span className="text-[11px] text-slate-400 hidden sm:inline">
              {activeStatus.message}
            </span>
          </div>

          {/* Exchange Clocks */}
          <div className="flex items-center gap-4 text-[11px]">
            {/* JSE Status */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">🇿🇦 JSE:</span>
              <span className="text-slate-200 font-bold">{jseStatus.localTime}</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  jseStatus.isOpen
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-rose-950 text-rose-300 border border-rose-800'
                }`}
              >
                {jseStatus.isOpen ? 'OPEN' : 'CLOSED'}
              </span>
              <span className="text-slate-500 text-[10px] hidden xl:inline">(09:00 - 17:00 SAST)</span>
            </div>

            <span className="text-slate-700">|</span>

            {/* US Status */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">🇺🇸 US:</span>
              <span className="text-slate-200 font-bold">{usStatus.localTime}</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  usStatus.isOpen
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-rose-950 text-rose-300 border border-rose-800'
                }`}
              >
                {usStatus.isOpen ? 'OPEN' : 'CLOSED'}
              </span>
              <span className="text-slate-500 text-[10px] hidden xl:inline">(09:30 - 16:00 ET)</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
