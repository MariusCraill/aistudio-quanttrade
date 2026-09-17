import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TradeSetup,
  SavedJournalEntry,
  RiskAnalysis,
  CandleData,
  VolatilityRadarReport,
  VolatilityAlert,
  AILiveSignalAlert,
} from './types';
import { REAL_MARKET_ASSETS, RealMarketAsset } from './data/realMarketData';
import {
  fetchAssetCandles,
  calculateMarketStatus,
  buildRealMarketSetups,
} from './services/marketDataService';
import {
  subscribeToVolatilityAlerts,
  fetchLiveVolatilityAlerts,
  playVolatilityChime,
} from './services/volatilityAlertService';
import { subscribeToLiveSignalAlerts } from './services/aiLiveSignalService';
import { analyzeCandleSetup } from './services/scannerService';
import Header, { HeaderAssetOption } from './components/Header';
import TradingViewChart from './components/TradingViewChart';
import TradeAnalyzer from './components/TradeAnalyzer';
import MarketScanner from './components/MarketScanner';
import BacktestDashboard from './components/BacktestDashboard';
import TradeJournal from './components/TradeJournal';
import StrategyFrameworkGuide from './components/StrategyFrameworkGuide';
import VolatilityRadarModal from './components/VolatilityRadarModal';
import VolatilityAlertToast from './components/VolatilityAlertToast';
import LiveIndicatorsHUD from './components/LiveIndicatorsHUD';
import LiveSignalAlertToast from './components/LiveSignalAlertToast';
import AtrRadarLiveMonitorPage from './components/AtrRadarLiveMonitorPage';

const LOCAL_STORAGE_KEY = 'tradequant_real_journal_entries';

const INITIAL_JOURNAL: SavedJournalEntry[] = [
  {
    id: 'LOG-NPN-01',
    createdAt: '2026-09-12',
    symbol: 'NPN.JO',
    setupType: 'MOMENTUM_BREAKOUT',
    entryPrice: 1186.06,
    stopLossPrice: 1145.0,
    targetPrice: 1288.7,
    rewardToRisk: 2.5,
    expectedValue: 0.68,
    shares: 15,
    riskDollars: 615.9,
    status: 'WON',
    notes: '20-day high breakout on JSE. Target achieved prior to market close.',
    actualExitPrice: 1288.7,
    actualPnl: 1539.6,
    currencySymbol: 'R',
    exchange: 'JSE',
  },
  {
    id: 'LOG-NVDA-02',
    createdAt: '2026-09-14',
    symbol: 'NVDA',
    setupType: 'MOMENTUM_BREAKOUT',
    entryPrice: 118.5,
    stopLossPrice: 112.3,
    targetPrice: 134.0,
    rewardToRisk: 2.5,
    expectedValue: 0.65,
    shares: 120,
    riskDollars: 744,
    status: 'EXECUTED',
    notes: '20-day high breakout on 2.1x volume surge. Structural uptrend intact.',
    currencySymbol: '$',
    exchange: 'US',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'ANALYZER' | 'SCANNER' | 'BACKTEST' | 'JOURNAL' | 'RADAR'>('ANALYZER');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NPN.JO');
  const [marketFilter, setMarketFilter] = useState<'ALL' | 'JSE' | 'US'>('ALL');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [backtestWinRate, setBacktestWinRate] = useState<number | undefined>(undefined);
  const [isSearchingTicker, setIsSearchingTicker] = useState(false);
  const [tickerSearchError, setTickerSearchError] = useState<string | null>(null);

  // Dynamic asset registry (including any tickers fetched via search)
  const [customAssets, setCustomAssets] = useState<Record<string, RealMarketAsset>>({});

  // Real-Time Volatility Radar Alert State
  const [volatilityRadarReport, setVolatilityRadarReport] = useState<VolatilityRadarReport | null>(null);
  const [isVolatilityModalOpen, setIsVolatilityModalOpen] = useState(false);
  const [isVolatilityLoading, setIsVolatilityLoading] = useState(false);
  const [activeToastAlert, setActiveToastAlert] = useState<VolatilityAlert | null>(null);

  // Subscribe to real-time volatility alerts polling (every 30 seconds)
  useEffect(() => {
    const unsubscribe = subscribeToVolatilityAlerts(report => {
      setVolatilityRadarReport(report);
      // Auto-trigger toast if an extreme anomaly or high surge is newly discovered
      if (report.alerts && report.alerts.length > 0) {
        const top = report.alerts[0];
        if (!top.isDismissed && (top.severity === 'EXTREME_ANOMALY' || top.severity === 'HIGH')) {
          setActiveToastAlert(top);
        }
      }
    }, 30000);
    return () => unsubscribe();
  }, []);

  // Real-Time AI Live Buy/Sell Alert Toast State
  const [liveSignalToast, setLiveSignalToast] = useState<AILiveSignalAlert | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToLiveSignalAlerts(alert => {
      if (alert && (alert.verdict === 'BUY_NOW' || alert.verdict === 'SELL_NOW')) {
        setLiveSignalToast(alert);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleRefreshVolatilityRadar = async () => {
    setIsVolatilityLoading(true);
    try {
      const fresh = await fetchLiveVolatilityAlerts();
      setVolatilityRadarReport(fresh);
    } catch (e) {
      console.error('Error refreshing volatility radar:', e);
    } finally {
      setIsVolatilityLoading(false);
    }
  };

  // Journal persistent storage
  const [journalEntries, setJournalEntries] = useState<SavedJournalEntry[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading journal from local storage:', e);
    }
    return INITIAL_JOURNAL;
  });

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(journalEntries));
    } catch (e) {
      console.error('Error saving journal to local storage:', e);
    }
  }, [journalEntries]);

  // Combined asset pool
  const allAssets = useMemo(() => {
    const customList = Object.values(customAssets);
    return [...customList, ...REAL_MARKET_ASSETS];
  }, [customAssets]);

  // Header options
  const headerAssetOptions: HeaderAssetOption[] = useMemo(() => {
    return allAssets.map(a => ({
      symbol: a.symbol,
      name: a.name,
      exchange: a.exchange,
      currencySymbol: a.currencySymbol,
    }));
  }, [allAssets]);

  // Current active asset
  const currentAsset: RealMarketAsset = useMemo(() => {
    return allAssets.find(a => a.symbol === selectedSymbol) || REAL_MARKET_ASSETS[0];
  }, [selectedSymbol, allAssets]);

  // Scanned setups from all assets
  const [scannedSetups, setScannedSetups] = useState<TradeSetup[]>(() => buildRealMarketSetups(REAL_MARKET_ASSETS));

  // Auto-refresh interval setting (default 30 minutes)
  const [autoRefreshMinutes, setAutoRefreshMinutes] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tradequant_auto_refresh_mins');
      return saved !== null ? Number(saved) : 30;
    } catch {
      return 30;
    }
  });

  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [isRefreshingScan, setIsRefreshingScan] = useState<boolean>(false);
  const [secondsUntilNextScan, setSecondsUntilNextScan] = useState<number>(autoRefreshMinutes * 60);

  // Compute active setup with real market metadata
  const computeSetupForAsset = useCallback((asset: RealMarketAsset, stopType: any = 'ATR_2X', horizon: any = 'SWING'): TradeSetup | null => {
    const baseSetup = analyzeCandleSetup(
      asset.symbol,
      asset.name,
      asset.data,
      stopType,
      horizon,
      2.5
    );
    if (!baseSetup) return null;

    const status = calculateMarketStatus(asset.exchange);
    return {
      ...baseSetup,
      exchange: asset.exchange,
      currency: asset.currency,
      currencySymbol: asset.currencySymbol,
      marketStatus: status.isOpen ? 'OPEN' : 'CLOSED',
      marketStatusText: status.statusText,
      marketHours: status.tradingHours,
      marketMessage: status.message,
    };
  }, []);

  // Active setup for the selected asset
  const [activeSetup, setActiveSetup] = useState<TradeSetup | null>(() => {
    return computeSetupForAsset(REAL_MARKET_ASSETS[0]);
  });

  // Keep activeSetup synced when selectedSymbol or currentAsset changes
  useEffect(() => {
    const updated = computeSetupForAsset(
      currentAsset,
      activeSetup?.stopLossType ?? 'ATR_2X',
      activeSetup?.horizon ?? 'SWING'
    );
    if (updated) {
      setActiveSetup(updated);
    }
  }, [currentAsset, computeSetupForAsset]);

  // Keep scannedSetups in sync if allAssets changes (e.g. user adds custom ticker)
  useEffect(() => {
    setScannedSetups(buildRealMarketSetups(allAssets));
  }, [allAssets]);

  // Function to refresh the market scanner candidates and active market feeds
  const handleRefreshScan = useCallback(async (manual = true) => {
    setIsRefreshingScan(true);
    try {
      // 1. Rebuild setups across all assets in the universe
      const updatedSetups = buildRealMarketSetups(allAssets);
      setScannedSetups(updatedSetups);

      // 2. Refresh active setup for current ticker
      const refreshedActive = computeSetupForAsset(
        currentAsset,
        activeSetup?.stopLossType ?? 'ATR_2X',
        activeSetup?.horizon ?? 'SWING'
      );
      if (refreshedActive) {
        setActiveSetup(refreshedActive);
      }

      // 3. Trigger fresh ATR Volatility Alert Radar evaluation
      const freshRadar = await fetchLiveVolatilityAlerts(undefined, manual);
      setVolatilityRadarReport(freshRadar);

      // 4. Update timestamps and countdown
      setLastRefreshedAt(new Date());
      if (autoRefreshMinutes > 0) {
        setSecondsUntilNextScan(autoRefreshMinutes * 60);
      }
    } catch (err) {
      console.error('Error during scan refresh:', err);
    } finally {
      setIsRefreshingScan(false);
    }
  }, [allAssets, currentAsset, activeSetup, computeSetupForAsset, autoRefreshMinutes]);

  // 30-minute automatic scan refresh interval timer
  useEffect(() => {
    if (autoRefreshMinutes <= 0) return;

    const timer = setInterval(() => {
      setSecondsUntilNextScan(prev => {
        if (prev <= 1) {
          // Trigger automatic 30-min scan refresh
          handleRefreshScan(false);
          return autoRefreshMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshMinutes, handleRefreshScan]);

  // Handle user changing auto-refresh interval (e.g. 30m, 15m, 5m, off)
  const handleChangeAutoRefreshMinutes = (minutes: number) => {
    setAutoRefreshMinutes(minutes);
    setSecondsUntilNextScan(minutes * 60);
    try {
      localStorage.setItem('tradequant_auto_refresh_mins', minutes.toString());
    } catch (e) {
      console.warn('Failed to save auto refresh preference:', e);
    }
  };

  // Handle custom ticker search via Yahoo Finance proxy
  const handleSearchCustomTicker = async (ticker: string) => {
    const upper = ticker.trim().toUpperCase();
    setIsSearchingTicker(true);
    setTickerSearchError(null);

    try {
      const result = await fetchAssetCandles(upper);
      const newAsset: RealMarketAsset = {
        symbol: result.symbol,
        name: result.name,
        exchange: result.exchange,
        sector: result.exchange === 'JSE' ? 'Johannesburg Equities' : 'US Equities',
        currency: result.currency,
        currencySymbol: result.currencySymbol,
        defaultSetup: 'MOMENTUM_BREAKOUT',
        description: `Live exchange feed for ${result.symbol}`,
        data: result.candles,
      };

      setCustomAssets(prev => ({ ...prev, [result.symbol]: newAsset }));
      setSelectedSymbol(result.symbol);
      const newSetup = computeSetupForAsset(newAsset);
      if (newSetup) setActiveSetup(newSetup);
    } catch (err: any) {
      console.warn('Custom ticker search failed, checking static universe:', err);
      const existing = allAssets.find(a => a.symbol.toUpperCase() === upper);
      if (existing) {
        setSelectedSymbol(existing.symbol);
      } else {
        setTickerSearchError(`Could not find live quote for "${upper}". Try adding .JO for JSE (e.g. SOL.JO) or US tickers (e.g. MSFT, TSLA).`);
      }
    } finally {
      setIsSearchingTicker(false);
    }
  };

  const handleUpdateSetup = useCallback((partial: Partial<TradeSetup>) => {
    setActiveSetup(prev => (prev ? { ...prev, ...partial } : null));
  }, []);

  const handleSelectSetupFromScanner = (setup: TradeSetup) => {
    setSelectedSymbol(setup.symbol);
    setActiveSetup(setup);
    setActiveTab('ANALYZER');
  };

  const handleSaveToJournal = (analysis: RiskAnalysis, setup: TradeSetup) => {
    const isJSE = setup.exchange === 'JSE' || setup.symbol.endsWith('.JO');
    const newEntry: SavedJournalEntry = {
      id: `LOG-${setup.symbol.replace('.JO', '')}-${Date.now().toString().slice(-4)}`,
      createdAt: new Date().toISOString().split('T')[0],
      symbol: setup.symbol,
      setupType: setup.setupType,
      entryPrice: setup.entryPrice,
      stopLossPrice: setup.stopLossPrice,
      targetPrice: setup.targetPrice,
      rewardToRisk: analysis.rewardToRisk,
      expectedValue: analysis.expectedValue,
      shares: analysis.fixedRiskShares,
      riskDollars: analysis.riskDollars,
      status: 'PLANNED',
      notes: `${setup.triggerDescription} (${setup.confluenceScore} pts confluence, ${setup.trendQualityScore}/100 trend). ${setup.marketStatus === 'CLOSED' ? 'Logged during closed market session.' : 'Logged during active session.'}`,
      currencySymbol: setup.currencySymbol || (isJSE ? 'R' : '$'),
      exchange: setup.exchange,
    };

    setJournalEntries(prev => [newEntry, ...prev]);
  };

  const handleUpdateJournalEntry = (updated: SavedJournalEntry) => {
    setJournalEntries(prev => prev.map(e => (e.id === updated.id ? updated : e)));
  };

  const handleDeleteJournalEntry = (id: string) => {
    setJournalEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleClearJournal = () => {
    if (window.confirm('Are you sure you want to clear all logged trade journal records?')) {
      setJournalEntries([]);
    }
  };

  const handleApplyWinRateToAnalyzer = (winRate: number) => {
    setBacktestWinRate(winRate);
    setActiveTab('ANALYZER');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        assets={headerAssetOptions}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={sym => setSelectedSymbol(sym)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenVolatilityRadar={() => setActiveTab('RADAR')}
        activeSurgeCount={volatilityRadarReport?.activeSurgeCount ?? 0}
        journalCount={journalEntries.length}
        marketFilter={marketFilter}
        onSelectMarketFilter={setMarketFilter}
        onSearchCustomTicker={handleSearchCustomTicker}
        isSearchingTicker={isSearchingTicker}
      />

      {/* Ticker Search Notification / Error Banner */}
      {tickerSearchError && (
        <div className="bg-rose-950/80 border-b border-rose-800 px-6 py-2.5 text-xs text-rose-300 font-mono flex items-center justify-between">
          <span>⚠️ {tickerSearchError}</span>
          <button
            onClick={() => setTickerSearchError(null)}
            className="text-rose-400 hover:text-rose-200 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main App Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* TAB 1: INTERACTIVE ANALYZER & CHARTING */}
        {activeTab === 'ANALYZER' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-150">
            {/* AI Live Indicators, Sound Controls & Real-Time Alert Sentinel HUD */}
            <LiveIndicatorsHUD
              candles={currentAsset.data}
              setup={activeSetup}
              symbol={currentAsset.symbol}
              name={currentAsset.name}
              exchange={currentAsset.exchange}
              currencySymbol={currentAsset.currencySymbol}
              onApplySetupParameters={({ entry, stop, target }) => {
                handleUpdateSetup({
                  entryPrice: entry,
                  stopLossPrice: stop,
                  targetPrice: target,
                  rewardToRisk: Number(((target - entry) / Math.max(0.01, entry - stop)).toFixed(2)),
                });
              }}
            />

            {/* TradingView Candlestick Chart */}
            <TradingViewChart
              candles={currentAsset.data}
              setup={activeSetup}
              height={460}
            />

            {/* Interactive Trade Analyzer & Sizing Calculator */}
            <TradeAnalyzer
              setup={activeSetup}
              candles={currentAsset.data}
              onUpdateSetup={handleUpdateSetup}
              onSaveToJournal={handleSaveToJournal}
              backtestWinRate={backtestWinRate}
            />
          </div>
        )}

        {/* TAB 2: AUTOMATED SIGNAL SCANNER */}
        {activeTab === 'SCANNER' && (
          <div className="animate-in fade-in duration-150">
            <MarketScanner
              setups={scannedSetups}
              selectedSetupId={activeSetup?.id ?? null}
              onSelectSetup={handleSelectSetupFromScanner}
              onRefreshScan={() => handleRefreshScan(true)}
              initialExchangeFilter={marketFilter}
              isRefreshing={isRefreshingScan}
              lastRefreshedAt={lastRefreshedAt}
              autoRefreshMinutes={autoRefreshMinutes}
              onChangeAutoRefreshMinutes={handleChangeAutoRefreshMinutes}
              nextAutoRefreshSeconds={secondsUntilNextScan}
            />
          </div>
        )}

        {/* TAB 3: CONTINUOUS BACKTEST ENGINE */}
        {activeTab === 'BACKTEST' && (
          <div className="animate-in fade-in duration-150">
            <BacktestDashboard
              candles={currentAsset.data}
              symbol={currentAsset.symbol}
              onApplyWinRateToAnalyzer={handleApplyWinRateToAnalyzer}
            />
          </div>
        )}

        {/* TAB 4: SAVED JOURNAL & EXECUTION LOG */}
        {activeTab === 'JOURNAL' && (
          <div className="animate-in fade-in duration-150">
            <TradeJournal
              entries={journalEntries}
              onUpdateEntry={handleUpdateJournalEntry}
              onDeleteEntry={handleDeleteJournalEntry}
              onClearAll={handleClearJournal}
            />
          </div>
        )}

        {/* SECOND PAGE: DEDICATED ATR VOLATILITY RADAR & LIVE AI MONITOR */}
        {activeTab === 'RADAR' && (
          <div className="animate-in fade-in duration-150">
            <AtrRadarLiveMonitorPage
              allAssets={allAssets}
              volatilityReport={volatilityRadarReport}
              isLoadingReport={isVolatilityLoading}
              onRefreshRadar={handleRefreshVolatilityRadar}
              onSelectAssetForAnalyzer={sym => {
                setSelectedSymbol(sym);
                setActiveTab('ANALYZER');
              }}
            />
          </div>
        )}
      </main>

      {/* Strategy Framework Guide Modal */}
      <StrategyFrameworkGuide
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Real-Time Volatility Alert Radar Modal */}
      <VolatilityRadarModal
        isOpen={isVolatilityModalOpen}
        onClose={() => setIsVolatilityModalOpen(false)}
        report={volatilityRadarReport}
        isLoading={isVolatilityLoading}
        onRefresh={handleRefreshVolatilityRadar}
        onSelectSymbol={sym => {
          setSelectedSymbol(sym);
          setActiveTab('ANALYZER');
        }}
      />

      {/* Real-Time Volatility Surge Toast Notification */}
      <VolatilityAlertToast
        alert={activeToastAlert}
        onDismiss={() => setActiveToastAlert(null)}
        onOpenRadar={() => {
          setActiveToastAlert(null);
          setActiveTab('RADAR');
        }}
        onAnalyze={sym => {
          setSelectedSymbol(sym);
          setActiveTab('ANALYZER');
          setActiveToastAlert(null);
        }}
      />

      {/* Real-Time AI Live Buy/Sell Alert Toast with Sound Action */}
      <LiveSignalAlertToast
        alert={liveSignalToast}
        onDismiss={() => setLiveSignalToast(null)}
        onSelectSymbol={sym => {
          setSelectedSymbol(sym);
          setActiveTab('ANALYZER');
          setLiveSignalToast(null);
        }}
      />

      {/* Minimal Real-Market Engine Footer */}
      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        TradeQuant Quantitative Engine • Johannesburg Stock Exchange (JSE) &amp; US Markets (NYSE/NASDAQ) • Real Daily Feeds • Standardized 20d Breakout &amp; Mean-Reversion Rules • Half-Kelly Risk Management
      </footer>
    </div>
  );
}
