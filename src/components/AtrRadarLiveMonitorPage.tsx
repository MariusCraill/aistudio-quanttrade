import { useState, useEffect, useMemo } from 'react';
import {
  Zap,
  Activity,
  Sparkles,
  Volume2,
  VolumeX,
  RefreshCw,
  Sliders,
  ArrowUpRight,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Play,
  Search,
  Power,
  BarChart2,
  Radio,
  Flame,
  Clock,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import {
  VolatilityAlert,
  VolatilityRadarReport,
  AILiveSignalAlert,
  LiveIndicatorValues,
} from '../types';
import { RealMarketAsset } from '../data/realMarketData';
import {
  isAtrRadarEnabled,
  setAtrRadarEnabled,
  toggleAtrRadar,
  subscribeToAtrRadarState,
  isAudioMuted,
  setAudioMuted,
  playVolatilityChime,
} from '../services/volatilityAlertService';
import {
  isAiLiveMonitorEnabled,
  setAiLiveMonitorEnabled,
  toggleAiLiveMonitor,
  subscribeToAiMonitorState,
  evaluateLiveSignal,
} from '../services/aiLiveSignalService';
import {
  isSoundAlertsEnabled,
  setSoundAlertsEnabled,
  playBuyAlertSound,
  playSellAlertSound,
} from '../services/audioAlertService';

interface AtrRadarLiveMonitorPageProps {
  allAssets: RealMarketAsset[];
  volatilityReport: VolatilityRadarReport | null;
  isLoadingReport: boolean;
  onRefreshRadar: () => Promise<void> | void;
  onSelectAssetForAnalyzer: (symbol: string) => void;
}

export default function AtrRadarLiveMonitorPage({
  allAssets,
  volatilityReport,
  isLoadingReport,
  onRefreshRadar,
  onSelectAssetForAnalyzer,
}: AtrRadarLiveMonitorPageProps) {
  // Master Switches
  const [radarOn, setRadarOn] = useState(() => isAtrRadarEnabled());
  const [aiMonitorOn, setAiMonitorOn] = useState(() => isAiLiveMonitorEnabled());
  const [soundAlertsOn, setSoundAlertsOn] = useState(() => isSoundAlertsEnabled() && !isAudioMuted());

  // Filter & Search States
  const [marketFilter, setMarketFilter] = useState<'ALL' | 'JSE' | 'US'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'HIGH_EXTREME' | 'EXTREME_ONLY'>('ALL');
  const [signalFilter, setSignalFilter] = useState<'ALL' | 'BUY_ONLY' | 'SELL_ONLY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'SURGE' | 'CONFIDENCE' | 'CHANGE'>('SURGE');

  // Per-asset evaluated AI signals cache
  const [assetSignals, setAssetSignals] = useState<Record<string, { alert: AILiveSignalAlert; indicators: LiveIndicatorValues }>>({});
  const [evaluatingSymbols, setEvaluatingSymbols] = useState<Record<string, boolean>>({});
  const [audioFeedbackMessage, setAudioFeedbackMessage] = useState<string | null>(null);

  // Subscribe to external master switch changes
  useEffect(() => {
    const unsubRadar = subscribeToAtrRadarState(enabled => setRadarOn(enabled));
    const unsubAi = subscribeToAiMonitorState(enabled => setAiMonitorOn(enabled));
    return () => {
      unsubRadar();
      unsubAi();
    };
  }, []);

  // Handlers for Master Switches
  const handleToggleRadar = () => {
    const next = toggleAtrRadar();
    setRadarOn(next);
  };

  const handleToggleAiMonitor = () => {
    const next = toggleAiLiveMonitor();
    setAiMonitorOn(next);
  };

  const handleToggleSound = () => {
    const next = !soundAlertsOn;
    setSoundAlertsOn(next);
    setSoundAlertsEnabled(next);
    setAudioMuted(!next);
    if (next) {
      playBuyAlertSound();
      showAudioMessage('Sound alerts enabled');
    } else {
      showAudioMessage('Sound alerts muted');
    }
  };

  const showAudioMessage = (msg: string) => {
    setAudioFeedbackMessage(msg);
    setTimeout(() => setAudioFeedbackMessage(null), 2500);
  };

  const handleTestBuySound = () => {
    playBuyAlertSound();
    showAudioMessage('Test: BUY alert sound triggered');
  };

  const handleTestSellSound = () => {
    playSellAlertSound();
    showAudioMessage('Test: SELL warning alarm triggered');
  };

  const handleTestVolatilityChime = () => {
    playVolatilityChime('HIGH');
    showAudioMessage('Test: ATR volatility expansion chime');
  };

  // Evaluate AI Live Signals for volatile shares detected by the radar
  const alertsList = volatilityReport?.alerts || [];

  // When alerts change or AI monitor is toggled ON, evaluate signals for volatile shares
  useEffect(() => {
    if (!aiMonitorOn) return;

    // Run evaluations for volatile assets
    const evaluateVolatileAssets = async () => {
      for (const alert of alertsList) {
        if (assetSignals[alert.symbol]) continue; // already evaluated

        const asset = allAssets.find(a => a.symbol === alert.symbol);
        if (!asset || !asset.data || asset.data.length === 0) continue;

        try {
          const result = await evaluateLiveSignal({
            symbol: alert.symbol,
            name: alert.name,
            exchange: alert.exchange,
            currencySymbol: alert.currencySymbol,
            candles: asset.data,
            forceSound: false,
            forceAi: false,
          });

          setAssetSignals(prev => ({
            ...prev,
            [alert.symbol]: result,
          }));
        } catch (err) {
          console.warn(`Could not evaluate live signal for ${alert.symbol}:`, err);
        }
      }
    };

    evaluateVolatileAssets();
  }, [alertsList, aiMonitorOn, allAssets]);

  // Handle single asset manual AI re-evaluation
  const handleReevaluateAsset = async (symbol: string) => {
    const asset = allAssets.find(a => a.symbol === symbol);
    if (!asset || !asset.data || asset.data.length === 0) return;

    setEvaluatingSymbols(prev => ({ ...prev, [symbol]: true }));
    try {
      const result = await evaluateLiveSignal({
        symbol: asset.symbol,
        name: asset.name,
        exchange: asset.exchange,
        currencySymbol: asset.currencySymbol,
        candles: asset.data,
        forceSound: soundAlertsOn,
        forceAi: true,
      });

      setAssetSignals(prev => ({
        ...prev,
        [symbol]: result,
      }));
      showAudioMessage(`Live AI Sentinel updated for ${symbol}`);
    } catch (err) {
      console.warn(`Error re-evaluating ${symbol}:`, err);
    } finally {
      setEvaluatingSymbols(prev => ({ ...prev, [symbol]: false }));
    }
  };

  // Filter and sort alerts
  const filteredAlerts = useMemo(() => {
    return alertsList.filter(alert => {
      // Exchange filter
      if (marketFilter !== 'ALL' && alert.exchange !== marketFilter) return false;

      // Severity filter
      if (severityFilter === 'HIGH_EXTREME' && alert.severity === 'ELEVATED') return false;
      if (severityFilter === 'EXTREME_ONLY' && alert.severity !== 'EXTREME_ANOMALY') return false;

      // Signal filter
      const sig = assetSignals[alert.symbol]?.alert?.verdict;
      if (signalFilter === 'BUY_ONLY' && sig !== 'BUY_NOW') return false;
      if (signalFilter === 'SELL_ONLY' && sig !== 'SELL_NOW') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSymbol = alert.symbol.toLowerCase().includes(q);
        const matchName = alert.name.toLowerCase().includes(q);
        if (!matchSymbol && !matchName) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'CONFIDENCE') {
        const confA = assetSignals[a.symbol]?.alert?.confidenceScore || 0;
        const confB = assetSignals[b.symbol]?.alert?.confidenceScore || 0;
        return confB - confA;
      }
      if (sortBy === 'CHANGE') {
        return Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent);
      }
      // default: SURGE
      return b.surgePercent - a.surgePercent;
    });
  }, [alertsList, marketFilter, severityFilter, signalFilter, searchQuery, sortBy, assetSignals]);

  // Aggregated Counts
  const buySignalsCount = Object.values(assetSignals).filter(
    (s: { alert: AILiveSignalAlert; indicators: LiveIndicatorValues }) => s.alert?.verdict === 'BUY_NOW'
  ).length;
  const sellSignalsCount = Object.values(assetSignals).filter(
    (s: { alert: AILiveSignalAlert; indicators: LiveIndicatorValues }) => s.alert?.verdict === 'SELL_NOW'
  ).length;
  const extremeSurgeCount = alertsList.filter(a => a.severity === 'EXTREME_ANOMALY').length;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* 1. Page Header & Master Switches Dashboard */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Background ambient accent */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          {/* Title & Info */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/80 border border-amber-800 text-amber-300 flex items-center gap-1.5">
                <Radio className={`w-3 h-3 ${radarOn ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
                LIVE SURVEILLANCE RADAR
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                JSE &amp; US REAL FEEDS
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              ATR Volatility Radar &amp; Live AI Monitor
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl mt-1">
              Surveillance engine detecting True Range expansions across South African and US equities, coupled with institutional AI Sentinel buy/sell triggers.
            </p>
          </div>

          {/* Master Control Switches */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/90">
            {/* ATR Radar Master Switch */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <Zap className={`w-3.5 h-3.5 ${radarOn ? 'text-amber-400' : 'text-slate-500'}`} />
                  <span>ATR Radar</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {radarOn ? 'Scanning (30s)' : 'Paused'}
                </span>
              </div>
              <button
                id="switch-radar-toggle"
                onClick={handleToggleRadar}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  radarOn ? 'bg-amber-500' : 'bg-slate-700'
                }`}
                title={radarOn ? 'Turn ATR Radar OFF' : 'Turn ATR Radar ON'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                    radarOn ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Live AI Monitor Master Switch */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <Sparkles className={`w-3.5 h-3.5 ${aiMonitorOn ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span>AI Monitor</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {aiMonitorOn ? 'Sentinel Active' : 'Paused'}
                </span>
              </div>
              <button
                id="switch-ai-monitor-toggle"
                onClick={handleToggleAiMonitor}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  aiMonitorOn ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
                title={aiMonitorOn ? 'Turn Live AI Monitor OFF' : 'Turn Live AI Monitor ON'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                    aiMonitorOn ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Audio Sound Alerts Switch */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  {soundAlertsOn ? (
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>Audio Chimes</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {soundAlertsOn ? 'Alerts ON' : 'Muted'}
                </span>
              </div>
              <button
                id="switch-sound-toggle"
                onClick={handleToggleSound}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  soundAlertsOn ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
                title={soundAlertsOn ? 'Mute Audio Alerts' : 'Enable Audio Alerts'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                    soundAlertsOn ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Manual Scan Radar Button */}
            <button
              id="btn-scan-radar-now"
              onClick={() => onRefreshRadar()}
              disabled={isLoadingReport}
              className="px-3.5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-cyan-500/10"
              title="Rescan ATR volatility metrics across all monitored assets"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReport ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Scan Now</span>
            </button>
          </div>
        </div>

        {/* Audio Toast Feedback banner */}
        {audioFeedbackMessage && (
          <div className="mt-3 py-1 px-3 bg-cyan-950/80 border border-cyan-800 rounded-lg text-[11px] font-mono text-cyan-300 flex items-center justify-between animate-in fade-in">
            <span>🔊 {audioFeedbackMessage}</span>
            <span className="text-[10px] text-slate-400">Web Audio Synthesizer</span>
          </div>
        )}
      </div>

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Volatile Shares Found */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold">Volatile Shares</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black font-mono text-amber-300">
              {alertsList.length}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              / {volatilityReport?.totalMonitored || allAssets.length} tracked
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">
            {extremeSurgeCount} extreme {extremeSurgeCount === 1 ? 'anomaly' : 'anomalies'} (≥60%)
          </div>
        </div>

        {/* Metric 2: Market Volatility Regime */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold">Market Regime</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-sm sm:text-base font-bold font-mono ${
                volatilityReport?.marketRegime === 'VOLATILITY_EXPANSION'
                  ? 'text-amber-400'
                  : 'text-slate-300'
              }`}
            >
              {volatilityReport?.marketRegime === 'VOLATILITY_EXPANSION'
                ? 'EXPANSION'
                : 'NORMAL'}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Avg +{volatilityReport?.averageSurgePercent || 0}%
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">
            ATR &gt; 20-day Moving Average
          </div>
        </div>

        {/* Metric 3: Active Buy Signals */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold">AI Buy Signals</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
              {buySignalsCount}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              immediate entries
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">
            Confluence + Volatility confirmation
          </div>
        </div>

        {/* Metric 4: Sound Alert Testing */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold">Audio Verification</span>
            <Volume2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={handleTestBuySound}
              className="px-2 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Test Buy Signal Sound"
            >
              <Play className="w-2.5 h-2.5" /> Buy Sound
            </button>
            <button
              onClick={handleTestSellSound}
              className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Test Sell Signal Sound"
            >
              <Play className="w-2.5 h-2.5" /> Sell Alarm
            </button>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">
            Zero-latency browser synthesizer
          </div>
        </div>
      </div>

      {/* 3. Filter & Controls Toolbar */}
      <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left Filter Group: Exchange & Severity */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Exchange Filter */}
          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 font-mono text-[11px]">
            {(['ALL', 'JSE', 'US'] as const).map(ex => (
              <button
                key={ex}
                onClick={() => setMarketFilter(ex)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  marketFilter === ex
                    ? 'bg-cyan-600 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {ex === 'ALL' ? 'All Exchanges' : ex}
              </button>
            ))}
          </div>

          {/* Severity Filter */}
          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 font-mono text-[11px]">
            <button
              onClick={() => setSeverityFilter('ALL')}
              className={`px-2 py-1 rounded transition-colors ${
                severityFilter === 'ALL'
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Surges
            </button>
            <button
              onClick={() => setSeverityFilter('HIGH_EXTREME')}
              className={`px-2 py-1 rounded transition-colors ${
                severityFilter === 'HIGH_EXTREME'
                  ? 'bg-amber-600 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              High (≥35%)
            </button>
            <button
              onClick={() => setSeverityFilter('EXTREME_ONLY')}
              className={`px-2 py-1 rounded transition-colors ${
                severityFilter === 'EXTREME_ONLY'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Extreme (≥60%)
            </button>
          </div>

          {/* AI Signal Filter */}
          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 font-mono text-[11px]">
            <button
              onClick={() => setSignalFilter('ALL')}
              className={`px-2 py-1 rounded transition-colors ${
                signalFilter === 'ALL'
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Signals
            </button>
            <button
              onClick={() => setSignalFilter('BUY_ONLY')}
              className={`px-2 py-1 rounded transition-colors ${
                signalFilter === 'BUY_ONLY'
                  ? 'bg-emerald-600 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Buy Only
            </button>
            <button
              onClick={() => setSignalFilter('SELL_ONLY')}
              className={`px-2 py-1 rounded transition-colors ${
                signalFilter === 'SELL_ONLY'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sell Only
            </button>
          </div>
        </div>

        {/* Right Filter Group: Search & Sort */}
        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search ticker..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-32 sm:w-44 font-mono"
            />
          </div>

          {/* Sort selector */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500"
          >
            <option value="SURGE">Sort: ATR Surge %</option>
            <option value="CONFIDENCE">Sort: AI Confidence</option>
            <option value="CHANGE">Sort: Day Change %</option>
          </select>
        </div>
      </div>

      {/* 4. ATR Volatility Status Banner if Radar is turned OFF */}
      {!radarOn && (
        <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-950 border border-amber-700 text-amber-400">
              <Power className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-amber-200">
                ATR Radar Surveillance is currently Switched OFF
              </div>
              <div className="text-xs text-amber-400/80">
                Automatic 30-second ATR background polling is paused. Cached telemetry is displayed below.
              </div>
            </div>
          </div>
          <button
            onClick={handleToggleRadar}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer transition-colors shrink-0"
          >
            Switch ATR Radar ON
          </button>
        </div>
      )}

      {/* 5. Live Volatile Shares & AI Monitor Grid */}
      {filteredAlerts.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <Radio className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-200 mb-1">
            No Volatile Shares Match Filters
          </h3>
          <p className="text-xs text-slate-400 max-w-md mb-4">
            Currently no equities exceed the selected ATR surge thresholds or search terms. The radar monitors for ATR(14) expanding above its 20-day moving average.
          </p>
          <button
            onClick={() => {
              setMarketFilter('ALL');
              setSeverityFilter('ALL');
              setSignalFilter('ALL');
              setSearchQuery('');
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-mono transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredAlerts.map(alert => {
            const signalData = assetSignals[alert.symbol];
            const liveAlert = signalData?.alert;
            const indicators = signalData?.indicators;
            const isEvaluatingThis = evaluatingSymbols[alert.symbol];

            // Severity styling
            const isExtreme = alert.severity === 'EXTREME_ANOMALY';
            const isHigh = alert.severity === 'HIGH';

            return (
              <div
                key={alert.id}
                className={`bg-slate-900/90 border rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 ${
                  isExtreme
                    ? 'border-purple-800/80 shadow-lg shadow-purple-950/20'
                    : isHigh
                    ? 'border-amber-700/70 shadow-md shadow-amber-950/10'
                    : 'border-slate-800/90'
                }`}
              >
                {/* Top Section: Volatile Share Metadata & ATR Surge Metrics */}
                <div>
                  {/* Symbol, Name, Exchange & Market Session */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base sm:text-lg font-black font-mono text-white tracking-tight">
                          {alert.symbol}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {alert.exchange}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                            alert.marketStatus === 'OPEN'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-slate-800/80 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {alert.marketStatus}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 truncate max-w-xs mt-0.5">
                        {alert.name}
                      </div>
                    </div>

                    {/* Price & Day Change */}
                    <div className="text-right">
                      <div className="text-base font-black font-mono text-white">
                        {alert.currencySymbol}
                        {alert.currentPrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      <div
                        className={`text-xs font-mono font-bold flex items-center justify-end gap-0.5 ${
                          alert.priceChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {alert.priceChangePercent >= 0 ? '+' : ''}
                        {alert.priceChangePercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* ATR Radar Metrics Ribbon */}
                  <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 mb-3.5">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-bold text-slate-200">
                          ATR Volatility Expansion
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold flex items-center gap-1 ${
                          isExtreme
                            ? 'bg-purple-950 text-purple-300 border border-purple-800 animate-pulse'
                            : isHigh
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {alert.severity.replace('_', ' ')}: +{alert.surgePercent.toFixed(1)}%
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono">
                      <div className="bg-slate-900/90 p-1.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400">Current ATR(14)</div>
                        <div className="font-bold text-amber-300">
                          {alert.currencySymbol}
                          {alert.currentAtr.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-slate-900/90 p-1.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400">20d ATR MA</div>
                        <div className="font-bold text-slate-300">
                          {alert.currencySymbol}
                          {alert.atrMa20.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-slate-900/90 p-1.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400">ATR / Price</div>
                        <div className="font-bold text-cyan-300">
                          {((alert.currentAtr / alert.currentPrice) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Live AI Sentinel Monitor for this Volatile Share */}
                  {aiMonitorOn ? (
                    <div className="bg-slate-950/90 border border-slate-800/90 rounded-xl p-3.5 mb-3">
                      {/* AI Header: Verdict & Confidence */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-mono font-extrabold flex items-center gap-1 ${
                              liveAlert?.verdict === 'BUY_NOW'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 shadow-sm shadow-emerald-900/40'
                                : liveAlert?.verdict === 'SELL_NOW'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800 shadow-sm shadow-rose-900/40'
                                : liveAlert?.verdict === 'ACCUMULATE'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {liveAlert?.verdict === 'BUY_NOW' && <ArrowUpRight className="w-3.5 h-3.5" />}
                            {liveAlert?.verdict === 'SELL_NOW' && <TrendingDown className="w-3.5 h-3.5" />}
                            {liveAlert?.verdict || 'EVALUATING...'}
                          </span>

                          {liveAlert?.urgency && (
                            <span className="text-[10px] font-mono text-slate-400">
                              [{liveAlert.urgency}]
                            </span>
                          )}
                        </div>

                        {liveAlert && (
                          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-300">
                            <span className="text-slate-400">Confidence:</span>
                            <span className="font-bold text-cyan-300">{liveAlert.confidenceScore}%</span>
                          </div>
                        )}
                      </div>

                      {/* AI Signal Headline */}
                      <div className="text-xs font-semibold text-slate-200 mb-2.5">
                        {liveAlert?.signalHeadline || 'Analyzing indicators for ATR volatility confirmation...'}
                      </div>

                      {/* Suggested Entry, Stop Loss & Target Levels */}
                      {liveAlert && (
                        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-mono mb-2.5 bg-slate-900/90 p-2 rounded-lg border border-slate-800/80">
                          <div>
                            <div className="text-slate-400">Trigger</div>
                            <div className="font-bold text-white">
                              {alert.currencySymbol}{liveAlert.suggestedTriggerPrice.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-rose-400">Stop Loss</div>
                            <div className="font-bold text-rose-300">
                              {alert.currencySymbol}{liveAlert.suggestedStopLoss.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-emerald-400">Target</div>
                            <div className="font-bold text-emerald-300">
                              {alert.currencySymbol}{liveAlert.suggestedTargetPrice.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-cyan-400">R:R</div>
                            <div className="font-bold text-cyan-300">
                              {liveAlert.rewardToRisk}:1
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Live 4-Indicator Mini-HUD */}
                      {indicators && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono mb-2 text-slate-300">
                          <div className="bg-slate-900 p-1 rounded border border-slate-800 truncate">
                            <span className="text-slate-400">RSI(14): </span>
                            <span className="font-bold text-white">{indicators.rsi14}</span>
                          </div>
                          <div className="bg-slate-900 p-1 rounded border border-slate-800 truncate">
                            <span className="text-slate-400">EMA: </span>
                            <span className={indicators.emaAlignment === 'BULLISH_STACK' ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                              {indicators.emaAlignment === 'BULLISH_STACK' ? 'Bull Stack' : 'Bearish'}
                            </span>
                          </div>
                          <div className="bg-slate-900 p-1 rounded border border-slate-800 truncate">
                            <span className="text-slate-400">200 SMA: </span>
                            <span className={indicators.trendRegime === 'BULL_MARKET' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              {indicators.trendRegime === 'BULL_MARKET' ? 'Bull Market' : 'Bearish'}
                            </span>
                          </div>
                          <div className="bg-slate-900 p-1 rounded border border-slate-800 truncate">
                            <span className="text-slate-400">Volume: </span>
                            <span className="font-bold text-cyan-300">{indicators.volumeRatio20}x</span>
                          </div>
                        </div>
                      )}

                      {/* Key Reasons / Quant Rationale */}
                      {liveAlert?.keyReasons && liveAlert.keyReasons.length > 0 && (
                        <ul className="space-y-1 text-[11px] text-slate-400">
                          {liveAlert.keyReasons.slice(0, 2).map((reason, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-cyan-400 shrink-0">▸</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 mb-3 text-center">
                      <div className="text-xs text-slate-400 mb-1">
                        AI Live Monitor is Switched OFF
                      </div>
                      <button
                        onClick={handleToggleAiMonitor}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-cyan-300 transition-colors"
                      >
                        Turn AI Monitor ON for {alert.symbol}
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom Card Action Footer */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    {/* Test Audio Button for this asset */}
                    <button
                      onClick={() => {
                        if (liveAlert?.verdict === 'SELL_NOW') {
                          playSellAlertSound();
                          showAudioMessage(`Played SELL warning chime for ${alert.symbol}`);
                        } else {
                          playBuyAlertSound();
                          showAudioMessage(`Played BUY alert chime for ${alert.symbol}`);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
                      title="Play signal alert chime"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Manual Re-evaluate AI */}
                    <button
                      onClick={() => handleReevaluateAsset(alert.symbol)}
                      disabled={isEvaluatingThis}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                      title="Force immediate AI live indicator re-evaluation"
                    >
                      <RefreshCw className={`w-3 h-3 ${isEvaluatingThis ? 'animate-spin' : ''}`} />
                      <span>Scan AI</span>
                    </button>
                  </div>

                  {/* Open in Interactive Analyzer */}
                  <button
                    onClick={() => onSelectAssetForAnalyzer(alert.symbol)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm shadow-cyan-500/20"
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>Open in Analyzer</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Technical Framework Note */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-slate-200 mb-0.5">
            Institutional ATR Volatility &amp; AI Sentinel Framework
          </div>
          <p className="leading-relaxed">
            The ATR Radar continuously measures whether the 14-period Average True Range expands above its 20-day moving average.
            Elevated volatility (≥15%), High surge (≥35%), and Extreme anomalies (≥60%) signal institutional capital deployment.
            The AI Sentinel evaluates whether the volatility expansion aligns with directional EMA 9/21 momentum and volume before issuing a BUY NOW verdict.
          </p>
        </div>
      </div>
    </div>
  );
}
