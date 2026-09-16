import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  LineStyle,
  IChartApi,
  ISeriesApi,
} from 'lightweight-charts';
import { CandleData, TradeSetup } from '../types';
import { calculateIndicators, findRecentSwingLow } from '../utils/technicalIndicators';
import { Layers, Eye, EyeOff, Maximize2 } from 'lucide-react';

interface TradingViewChartProps {
  candles: CandleData[];
  setup: TradeSetup | null;
  height?: number;
  currencySymbol?: string;
}

export default function TradingViewChart({
  candles,
  setup,
  height = 480,
  currencySymbol,
}: TradingViewChartProps) {
  const currSym = currencySymbol || setup?.currencySymbol || '$';
  const isMarketClosed = setup?.marketStatus === 'CLOSED';
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const entryLineRef = useRef<any>(null);
  const stopLineRef = useRef<any>(null);
  const targetLineRef = useRef<any>(null);

  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showSMA200, setShowSMA200] = useState(true);
  const [showBreakoutLevel, setShowBreakoutLevel] = useState(true);
  const [showRsiSubchart, setShowRsiSubchart] = useState(true);

  // Indicators state for live hover display
  const [hoverData, setHoverData] = useState<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    // Clean up previous instance
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' }, // deep slate
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.45)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.45)' },
      },
      crosshair: {
        vertLine: {
          color: '#38bdf8',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#0284c7',
        },
        horzLine: {
          color: '#38bdf8',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#0284c7',
        },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: {
          top: 0.1,
          bottom: showRsiSubchart ? 0.28 : 0.18,
        },
      },
    });

    chartInstanceRef.current = chart;

    // 1. Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candleSeries;

    const formattedCandles = candles.map(c => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(formattedCandles);

    // Calculate Indicators
    const indicators = calculateIndicators(candles);

    // 2. Volume Series (Histogram at bottom)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    const volumeData = candles.map((c, i) => {
      const isUp = i === 0 || c.close >= candles[i - 1].close;
      return {
        time: c.time,
        value: c.volume,
        color: isUp ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)',
      };
    });
    volumeSeries.setData(volumeData);

    // 3. Moving Averages
    if (showSMA20) {
      const sma20Series = chart.addSeries(LineSeries, {
        color: '#06b6d4', // Cyan
        lineWidth: 2,
        title: '20 SMA',
      });
      const sma20Data = candles
        .map((c, i) => ({ time: c.time, value: indicators.sma20[i] }))
        .filter((d): d is { time: string; value: number } => d.value !== null);
      sma20Series.setData(sma20Data);
    }

    if (showSMA50) {
      const sma50Series = chart.addSeries(LineSeries, {
        color: '#f59e0b', // Amber
        lineWidth: 2,
        title: '50 SMA',
      });
      const sma50Data = candles
        .map((c, i) => ({ time: c.time, value: indicators.sma50[i] }))
        .filter((d): d is { time: string; value: number } => d.value !== null);
      sma50Series.setData(sma50Data);
    }

    if (showSMA200) {
      const sma200Series = chart.addSeries(LineSeries, {
        color: '#a855f7', // Purple
        lineWidth: 2,
        title: '200 SMA',
      });
      const sma200Data = candles
        .map((c, i) => ({ time: c.time, value: indicators.sma200[i] }))
        .filter((d): d is { time: string; value: number } => d.value !== null);
      sma200Series.setData(sma200Data);
    }

    // 4. 20-Day High Breakout Line
    if (showBreakoutLevel) {
      const high20Series = chart.addSeries(LineSeries, {
        color: '#38bdf8', // Light blue
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: '20d High',
      });
      const high20Data = candles
        .map((c, i) => ({ time: c.time, value: indicators.high20[i] }))
        .filter((d): d is { time: string; value: number } => d.value !== null);
      high20Series.setData(high20Data);
    }

    // 5. Active Trade Setup Lines (Entry, Stop Loss, Target)
    if (setup && candleSeries) {
      // Entry line
      entryLineRef.current = candleSeries.createPriceLine({
        price: setup.entryPrice,
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `ENTRY ${currSym} ${setup.entryPrice.toFixed(2)}`,
      });

      // Stop Loss line
      stopLineRef.current = candleSeries.createPriceLine({
        price: setup.stopLossPrice,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `STOP (-1.0R) ${currSym} ${setup.stopLossPrice.toFixed(2)}`,
      });

      // Target line
      targetLineRef.current = candleSeries.createPriceLine({
        price: setup.targetPrice,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `TARGET (+${setup.rewardToRisk.toFixed(1)}R) ${currSym} ${setup.targetPrice.toFixed(2)}`,
      });
    }

    // Crosshair listener for HUD
    chart.subscribeCrosshairMove(param => {
      if (!param || !param.time || !param.seriesData) {
        setHoverData(null);
        return;
      }
      const candle = param.seriesData.get(candleSeries) as any;
      if (candle) {
        setHoverData({
          date: String(param.time),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candles.find(c => c.time === param.time)?.volume ?? 0,
        });
      }
    });

    // Fit content
    chart.timeScale().fitContent();

    // Resize observer
    const handleResize = () => {
      if (container && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: container.clientWidth,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [candles, setup, showSMA20, showSMA50, showSMA200, showBreakoutLevel, showRsiSubchart, height]);

  const lastCandle = candles[candles.length - 1];
  const activeCandle = hoverData || lastCandle;
  const isUp = activeCandle ? activeCandle.close >= activeCandle.open : true;
  const priceChange = activeCandle ? activeCandle.close - activeCandle.open : 0;
  const priceChangePct = activeCandle && activeCandle.open > 0 ? (priceChange / activeCandle.open) * 100 : 0;

  const indicators = calculateIndicators(candles);
  const currentRSI = indicators.rsi14[indicators.rsi14.length - 1] ?? 50;
  const currentATR = indicators.atr14[indicators.atr14.length - 1] ?? 0;

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Top Header / OHLCV HUD & Quick Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-950/80 border-b border-slate-800/80 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-100">{setup?.symbol ?? 'ASSET'}</span>
            <span className="text-slate-400 font-sans text-xs hidden sm:inline">{setup?.name ?? 'Market Feed'}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
              {setup?.exchange === 'JSE' ? '🇿🇦 JSE' : '🇺🇸 US'}
            </span>
            {isMarketClosed ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800/80 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                Market is Closed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/80 shadow-sm animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Market is Open
              </span>
            )}
          </div>

          {activeCandle && (
            <div className="flex flex-wrap items-center gap-2.5 text-slate-300">
              <span>
                <span className="text-slate-500">O:</span> {currSym}{activeCandle.open.toFixed(2)}
              </span>
              <span>
                <span className="text-slate-500">H:</span> {currSym}{activeCandle.high.toFixed(2)}
              </span>
              <span>
                <span className="text-slate-500">L:</span> {currSym}{activeCandle.low.toFixed(2)}
              </span>
              <span>
                <span className="text-slate-500">C:</span>{' '}
                <span className={isUp ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {currSym}{activeCandle.close.toFixed(2)}
                </span>
              </span>
              <span className={isUp ? 'text-emerald-400' : 'text-rose-400'}>
                {priceChange >= 0 ? '+' : ''}
                {priceChange.toFixed(2)} ({priceChangePct.toFixed(2)}%)
              </span>
              <span className="hidden md:inline">
                <span className="text-slate-500">Vol:</span> {(activeCandle.volume / 1_000_000).toFixed(2)}M
              </span>
            </div>
          )}
        </div>

        {/* Indicator Toggles */}
        <div className="flex items-center gap-2 text-xs">
          <button
            id="toggle-sma20"
            onClick={() => setShowSMA20(!showSMA20)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
              showSMA20
                ? 'bg-cyan-950/60 border-cyan-700/60 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
            20 SMA
          </button>

          <button
            id="toggle-sma50"
            onClick={() => setShowSMA50(!showSMA50)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
              showSMA50
                ? 'bg-amber-950/60 border-amber-700/60 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            50 SMA
          </button>

          <button
            id="toggle-sma200"
            onClick={() => setShowSMA200(!showSMA200)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
              showSMA200
                ? 'bg-purple-950/60 border-purple-700/60 text-purple-300'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
            200 SMA
          </button>

          <button
            id="toggle-breakout-level"
            onClick={() => setShowBreakoutLevel(!showBreakoutLevel)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
              showBreakoutLevel
                ? 'bg-sky-950/60 border-sky-700/60 text-sky-300'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
            }`}
          >
            <span className="w-2 h-0.5 border-t border-dashed border-sky-400 inline-block" />
            20d High
          </button>

          <button
            id="reset-chart-zoom"
            title="Reset Zoom / Fit"
            onClick={() => chartInstanceRef.current?.timeScale().fitContent()}
            className="p-1.5 rounded border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Lightweight Chart Canvas */}
      <div className="relative w-full" style={{ height: `${height}px` }}>
        <div ref={chartContainerRef} className="w-full h-full" />

        {/* Live Setup Overlay Banner on Chart */}
        {setup && (
          <div className="absolute top-3 left-3 pointer-events-none flex flex-wrap gap-2">
            <div className="bg-slate-950/90 backdrop-blur border border-slate-800 rounded-lg px-3 py-1.5 text-xs shadow-lg flex items-center gap-3">
              <span className="flex items-center gap-1 text-slate-300 font-mono">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Entry: <strong className="text-white">{currSym}{setup.entryPrice.toFixed(2)}</strong>
              </span>
              <span className="flex items-center gap-1 text-slate-300 font-mono">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Stop: <strong className="text-rose-300">{currSym}{setup.stopLossPrice.toFixed(2)}</strong>
              </span>
              <span className="flex items-center gap-1 text-slate-300 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Target: <strong className="text-emerald-300">{currSym}{setup.targetPrice.toFixed(2)}</strong>
              </span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800/80 text-cyan-300 font-bold font-mono text-[11px]">
                {setup.rewardToRisk.toFixed(1)}:1 R:R
              </span>
            </div>

            {isMarketClosed && (
              <div className="bg-rose-950/90 backdrop-blur border border-rose-800/80 rounded-lg px-2.5 py-1.5 text-xs shadow-lg flex items-center gap-1.5 text-rose-300 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>Market Closed • Official Session Close</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Secondary Indicator Strip (RSI-14 & ATR-14 Volatility gauge) */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 bg-slate-950/90 border-t border-slate-800 text-xs font-mono">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">RSI (14):</span>
            <span
              className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                currentRSI <= 40
                  ? 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-300'
                  : currentRSI >= 70
                  ? 'bg-rose-950/80 border border-rose-700/60 text-rose-300'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {currentRSI.toFixed(1)}
              {currentRSI <= 40 && ' (Pullback Signal <40)'}
              {currentRSI >= 70 && ' (Overbought >70)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">ATR (14):</span>
            <span className="text-slate-200 font-medium">
              ${currentATR.toFixed(2)} ({((currentATR / (lastCandle?.close || 1)) * 100).toFixed(2)}% volatility)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-slate-400 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
            2x ATR Stop: ${((lastCandle?.close ?? 100) - 2 * currentATR).toFixed(2)}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">
            Swing Low: ${findRecentSwingLow(candles, candles.length - 1, 10).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
