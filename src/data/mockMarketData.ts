import { CandleData } from '../types';

export interface MarketAsset {
  symbol: string;
  name: string;
  sector: string;
  defaultSetup: 'MOMENTUM_BREAKOUT' | 'MEAN_REVERSION_PULLBACK';
  description: string;
  data: CandleData[];
}

/**
 * Deterministic PRNG to generate consistent, realistic market data
 */
function pseudoRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

/**
 * Generates realistic daily OHLCV candles
 */
export function generateCandles(
  basePrice: number,
  volatility: number,
  drift: number,
  bars = 260,
  seed = 42,
  triggerType?: 'MOMENTUM_BREAKOUT' | 'MEAN_REVERSION_PULLBACK'
): CandleData[] {
  const candles: CandleData[] = [];
  const now = new Date('2026-09-15');
  let currentPrice = basePrice;
  let currentSeed = seed;

  // Generate date list backwards then reverse
  const dates: string[] = [];
  let d = new Date(now);
  while (dates.length < bars) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      dates.push(d.toISOString().split('T')[0]);
    }
    d.setDate(d.getDate() - 1);
  }
  dates.reverse();

  let avgVolume = 25000000;

  for (let i = 0; i < bars; i++) {
    const rand1 = pseudoRandom(currentSeed++);
    const rand2 = pseudoRandom(currentSeed++);
    const rand3 = pseudoRandom(currentSeed++);
    const rand4 = pseudoRandom(currentSeed++);

    // Market regime simulation: trending with pullback oscillations
    let currentDrift = drift;
    const progress = i / bars;

    // Structure market cycles
    if (progress > 0.85 && triggerType === 'MOMENTUM_BREAKOUT') {
      // Create a consolidation then clean breakout on the last 5 bars
      if (i >= bars - 5) {
        currentDrift = 0.015; // strong surge
      } else {
        currentDrift = -0.001; // tight consolidation
      }
    } else if (progress > 0.85 && triggerType === 'MEAN_REVERSION_PULLBACK') {
      // Strong uptrend followed by a 4-day pullback to 20/50 SMA with declining RSI
      if (i >= bars - 4) {
        currentDrift = -0.012; // pullback into SMA
      } else {
        currentDrift = 0.008; // structural uptrend
      }
    }

    const shock = (rand1 - 0.48) * volatility * 2;
    const pctChange = currentDrift + shock;
    const open = currentPrice;
    const close = Number((open * (1 + pctChange)).toFixed(2));
    const range = Math.abs(close - open);
    const wickHigh = range * rand2 * 0.8;
    const wickLow = range * rand3 * 0.8;

    const high = Number((Math.max(open, close) + wickHigh).toFixed(2));
    const low = Number((Math.min(open, close) - wickLow).toFixed(2));

    // Volume modeling
    let volumeMultiplier = 0.7 + rand4 * 0.6;
    if (i === bars - 1 && triggerType === 'MOMENTUM_BREAKOUT') {
      volumeMultiplier = 2.1; // 2.1x volume breakout trigger!
    } else if (i >= bars - 3 && triggerType === 'MEAN_REVERSION_PULLBACK') {
      volumeMultiplier = 0.85; // healthy lower volume on pullback
    }

    const volume = Math.round(avgVolume * volumeMultiplier);
    currentPrice = close;

    candles.push({
      time: dates[i],
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return candles;
}

// Pre-generated static universes
export const MARKET_ASSETS: MarketAsset[] = [
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    sector: 'Semiconductors / AI',
    defaultSetup: 'MOMENTUM_BREAKOUT',
    description: 'Breakout above 20-day resistance on 2.1x average volume. Clean SMA stacking.',
    data: generateCandles(112.5, 0.022, 0.0028, 260, 101, 'MOMENTUM_BREAKOUT'),
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    sector: 'Consumer Electronics',
    defaultSetup: 'MEAN_REVERSION_PULLBACK',
    description: 'Mean-reversion test of the 20-day/50-day SMA in ongoing primary uptrend. RSI cooling under 40.',
    data: generateCandles(215.0, 0.014, 0.0016, 260, 202, 'MEAN_REVERSION_PULLBACK'),
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    sector: 'Automotive / EV',
    defaultSetup: 'MOMENTUM_BREAKOUT',
    description: 'High ATR volatility breakout with strong confluence and heavy institutional volume.',
    data: generateCandles(228.0, 0.034, 0.0022, 260, 303, 'MOMENTUM_BREAKOUT'),
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    sector: 'Enterprise Software',
    defaultSetup: 'MEAN_REVERSION_PULLBACK',
    description: 'Structural uptrend holding key 50-day moving average support band.',
    data: generateCandles(418.0, 0.015, 0.0018, 260, 404, 'MEAN_REVERSION_PULLBACK'),
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    sector: 'E-Commerce & Cloud',
    defaultSetup: 'MOMENTUM_BREAKOUT',
    description: 'Cup & handle consolidation clearing 20-day high with explosive volume.',
    data: generateCandles(178.0, 0.021, 0.0024, 260, 505, 'MOMENTUM_BREAKOUT'),
  },
  {
    symbol: 'AMD',
    name: 'Advanced Micro Devices',
    sector: 'Semiconductors',
    defaultSetup: 'MEAN_REVERSION_PULLBACK',
    description: 'RSI reset to 38.5 near ascending 20-day SMA support level.',
    data: generateCandles(145.0, 0.028, 0.0021, 260, 606, 'MEAN_REVERSION_PULLBACK'),
  },
  {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust',
    sector: 'Tech Index Benchmark',
    defaultSetup: 'MOMENTUM_BREAKOUT',
    description: 'Macro tech index breaking multi-week resistance channel with low ATR compression.',
    data: generateCandles(468.0, 0.012, 0.0015, 260, 707, 'MOMENTUM_BREAKOUT'),
  },
  {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF',
    sector: 'Broad Market Benchmark',
    defaultSetup: 'MEAN_REVERSION_PULLBACK',
    description: 'Broad market benchmark showing structural higher-highs and higher-lows.',
    data: generateCandles(542.0, 0.009, 0.0012, 260, 808, 'MEAN_REVERSION_PULLBACK'),
  },
];
