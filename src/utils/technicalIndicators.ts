import { CandleData, CalculatedIndicators, VolatilityAlert, VolatilityAlertSeverity, VolatilitySignalType } from '../types';

export function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      result.push(Number((sum / period).toFixed(2)));
    }
  }
  return result;
}

/**
 * Calculates 20-day Simple Moving Average of ATR(14)
 */
export function calculateATRMA20(atrValues: (number | null)[], period = 20): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < atrValues.length; i++) {
    // Check if we have at least `period` valid non-null consecutive ATR values ending at index i
    let hasNull = false;
    let sum = 0;
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    for (let j = 0; j < period; j++) {
      const val = atrValues[i - j];
      if (val === null || val === undefined || isNaN(val)) {
        hasNull = true;
        break;
      }
      sum += val;
    }
    if (hasNull) {
      result.push(null);
    } else {
      result.push(Number((sum / period).toFixed(2)));
    }
  }
  return result;
}

export function calculateATR(candles: CandleData[], period = 14): (number | null)[] {
  const result: (number | null)[] = [];
  const trueRanges: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trueRanges.push(candles[i].high - candles[i].low);
      result.push(null);
      continue;
    }
    const current = candles[i];
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prevClose),
      Math.abs(current.low - prevClose)
    );
    trueRanges.push(tr);

    if (i < period) {
      result.push(null);
    } else if (i === period) {
      const sum = trueRanges.slice(1, period + 1).reduce((a, b) => a + b, 0);
      result.push(Number((sum / period).toFixed(2)));
    } else {
      const prevATR = result[i - 1]!;
      const currentATR = (prevATR * (period - 1) + tr) / period;
      result.push(Number(currentATR.toFixed(2)));
    }
  }
  return result;
}

export function calculateRSI(candles: CandleData[], period = 14): (number | null)[] {
  const result: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      result.push(null);
      continue;
    }
    const change = candles[i].close - candles[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);

    if (i < period) {
      result.push(null);
    } else if (i === period) {
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(Number((100 - (100 / (1 + rs))).toFixed(2)));
      }
    } else {
      // Wilder's smoothing
      const prevIdx = i - 1;
      const currentGain = gains[gains.length - 1];
      const currentLoss = losses[losses.length - 1];
      
      // Calculate using previous window
      const sliceGains = gains.slice(i - period, i);
      const sliceLosses = losses.slice(i - period, i);
      const avgGain = sliceGains.reduce((a, b) => a + b, 0) / period;
      const avgLoss = sliceLosses.reduce((a, b) => a + b, 0) / period;

      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(Number((100 - (100 / (1 + rs))).toFixed(2)));
      }
    }
  }
  return result;
}

export function calculate20DayHigh(candles: CandleData[]): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < 20) {
      result.push(null);
    } else {
      // Look back 20 bars prior to current bar
      let maxHigh = -Infinity;
      for (let j = 1; j <= 20; j++) {
        const h = candles[i - j].high;
        if (h > maxHigh) maxHigh = h;
      }
      result.push(Number(maxHigh.toFixed(2)));
    }
  }
  return result;
}

export function calculateIndicators(candles: CandleData[]): CalculatedIndicators {
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const atr14 = calculateATR(candles, 14);
  const atrMa20 = calculateATRMA20(atr14, 20);

  return {
    sma20: calculateSMA(closes, 20),
    sma50: calculateSMA(closes, 50),
    sma200: calculateSMA(closes, 200),
    rsi14: calculateRSI(candles, 14),
    atr14,
    atrMa20,
    high20: calculate20DayHigh(candles),
    volSma20: calculateSMA(volumes, 20),
  };
}

/**
 * Finds the recent swing low in the past lookback bars (e.g. 10 bars)
 */
export function findRecentSwingLow(candles: CandleData[], currentIndex: number, lookback = 10): number {
  const start = Math.max(0, currentIndex - lookback);
  let minLow = Infinity;
  for (let i = start; i <= currentIndex; i++) {
    if (candles[i].low < minLow) {
      minLow = candles[i].low;
    }
  }
  return Number(minLow.toFixed(2));
}

/**
 * Quantifies Trend Quality (0 to 100)
 */
export function evaluateTrendQuality(
  price: number,
  sma20: number | null,
  sma50: number | null,
  sma200: number | null
): { score: number; verdict: string; details: string[] } {
  let score = 30; // base score
  const details: string[] = [];

  if (sma200 && price > sma200) {
    score += 25;
    details.push('Price above 200 SMA (Structural macro bull regime)');
  } else if (sma200) {
    details.push('Price below 200 SMA (Macro headwind)');
  }

  if (sma50 && price > sma50) {
    score += 20;
    details.push('Price above 50 SMA (Medium-term institutional trend positive)');
  }

  if (sma20 && price > sma20) {
    score += 15;
    details.push('Price above 20 SMA (Short-term momentum active)');
  }

  if (sma20 && sma50 && sma20 > sma50) {
    score += 10;
    details.push('Bullish moving average alignment: 20 SMA > 50 SMA');
  }

  score = Math.min(100, Math.max(0, score));
  let verdict = 'Poor / Neutral';
  if (score >= 80) verdict = 'Institutional Quality Uptrend';
  else if (score >= 60) verdict = 'Solid Bullish Structure';
  else if (score >= 40) verdict = 'Consolidation / Rangebound';

  return { score, verdict, details };
}

/**
 * Evaluates Confluence based on multiple criteria
 */
export function evaluateConfluence(params: {
  isBreakout: boolean;
  isPullback: boolean;
  volRatio: number; // current volume / 20d avg volume
  trendScore: number;
  rsi: number;
  atrPercent: number;
}): { score: number; factors: string[] } {
  const { isBreakout, isPullback, volRatio, trendScore, rsi, atrPercent } = params;
  let score = 20;
  const factors: string[] = [];

  if (isBreakout) {
    factors.push('20-Day High Breakout Trigger');
    score += 25;
  }
  if (isPullback) {
    factors.push('Mean-Reversion Pullback with RSI Reset');
    score += 25;
  }

  if (volRatio >= 1.5) {
    factors.push(`Institutional Volume Surge: ${(volRatio).toFixed(1)}x of 20-Day Average`);
    score += 25;
  } else if (volRatio >= 1.2) {
    factors.push(`Above Average Volume: ${(volRatio).toFixed(1)}x`);
    score += 15;
  }

  if (trendScore >= 75) {
    factors.push('Strong Trend Alignment across 20/50/200 SMAs');
    score += 15;
  }

  if (rsi >= 30 && rsi <= 55) {
    factors.push(`Healthy Momentum Base: RSI at ${rsi.toFixed(0)}`);
    score += 10;
  }

  if (atrPercent <= 3.5) {
    factors.push(`Controlled Volatility: ATR is ${atrPercent.toFixed(1)}% of price`);
    score += 5;
  }

  return { score: Math.min(100, score), factors };
}

/**
 * Real-Time Volatility Alert Evaluator:
 * Compares current 14-period ATR against its 20-day moving average (ATR MA20).
 * Signals potential breakouts, anomalies, or volatility compression releases.
 */
export function evaluateVolatilitySurge(
  candles: CandleData[],
  symbol: string,
  name: string,
  exchange: 'JSE' | 'US',
  currencySymbol = '$',
  marketStatus: 'OPEN' | 'CLOSED' = 'OPEN'
): {
  alert: VolatilityAlert | null;
  currentAtr: number;
  atrMa20: number;
  surgeRatio: number;
  surgePercent: number;
  isSurgeActive: boolean;
  history: { time: string; atr: number; atrMa20: number; isSurge: boolean }[];
} {
  if (candles.length < 35) {
    return {
      alert: null,
      currentAtr: 0,
      atrMa20: 0,
      surgeRatio: 1,
      surgePercent: 0,
      isSurgeActive: false,
      history: [],
    };
  }

  const indicators = calculateIndicators(candles);
  const { atr14, atrMa20 } = indicators;
  const lastIdx = candles.length - 1;
  const currentCandle = candles[lastIdx];
  const prevCandle = candles[lastIdx - 1] ?? currentCandle;

  // Find latest valid ATR and ATR MA20
  let currentAtr = atr14[lastIdx] ?? 0;
  let currentAtrMa20 = atrMa20[lastIdx] ?? 0;

  // If last bar doesn't have ATR MA20, search backwards up to 3 bars
  if (!currentAtr || !currentAtrMa20) {
    for (let k = lastIdx; k >= Math.max(0, lastIdx - 5); k--) {
      if (atr14[k] && atrMa20[k]) {
        currentAtr = atr14[k]!;
        currentAtrMa20 = atrMa20[k]!;
        break;
      }
    }
  }

  // If still missing, fallback gracefully
  if (!currentAtr || !currentAtrMa20 || currentAtrMa20 === 0) {
    return {
      alert: null,
      currentAtr: currentAtr || 1,
      atrMa20: currentAtr || 1,
      surgeRatio: 1,
      surgePercent: 0,
      isSurgeActive: false,
      history: [],
    };
  }

  const surgeRatio = Number((currentAtr / currentAtrMa20).toFixed(2));
  const surgePercent = Number((((currentAtr - currentAtrMa20) / currentAtrMa20) * 100).toFixed(1));
  const isSurgeActive = currentAtr > currentAtrMa20;

  // Build historical chart series for past 30 bars
  const history: { time: string; atr: number; atrMa20: number; isSurge: boolean }[] = [];
  const startIdx = Math.max(0, candles.length - 30);
  for (let i = startIdx; i < candles.length; i++) {
    const a = atr14[i];
    const m = atrMa20[i];
    if (a !== null && m !== null) {
      history.push({
        time: candles[i].time,
        atr: a,
        atrMa20: m,
        isSurge: a > m,
      });
    }
  }

  const priceChange = currentCandle.close - prevCandle.close;
  const priceChangePercent = Number(((priceChange / prevCandle.close) * 100).toFixed(2));
  const high20 = indicators.high20[lastIdx];

  // Determine Signal Type & Severity
  let severity: VolatilityAlertSeverity = 'ELEVATED';
  if (surgeRatio >= 1.35) {
    severity = 'EXTREME_ANOMALY';
  } else if (surgeRatio >= 1.18) {
    severity = 'HIGH';
  } else {
    severity = 'ELEVATED';
  }

  let signalType: VolatilitySignalType = 'BULLISH_BREAKOUT_VOLATILITY';
  let signalTitle = '';
  let signalDescription = '';
  const isBreakout = high20 !== null && currentCandle.close >= high20 * 0.99;
  const isAnomaly = surgeRatio >= 1.35;

  if (isSurgeActive) {
    if (priceChangePercent >= 1.0 || isBreakout) {
      signalType = 'BULLISH_BREAKOUT_VOLATILITY';
      signalTitle = 'Bullish Volatility Breakout Ignited';
      signalDescription = `ATR (${currencySymbol}${currentAtr.toFixed(2)}) surged +${surgePercent}% above its 20-day average (${currencySymbol}${currentAtrMa20.toFixed(2)}) alongside positive price momentum (+${priceChangePercent}%). High probability breakout expansion.`;
    } else if (priceChangePercent <= -1.2) {
      signalType = 'BEARISH_EXPANSION_VOLATILITY';
      signalTitle = 'Bearish Volatility Expansion / Downward Shock';
      signalDescription = `ATR expanded +${surgePercent}% above 20d moving average with downward price pressure (${priceChangePercent}%). Invalidate long entries and protect downside.`;
    } else {
      signalType = 'VOLATILITY_ANOMALY';
      signalTitle = 'Anomalous Volatility Expansion Detected';
      signalDescription = `Anomalous expansion (+${surgePercent}% over 20-day mean ATR). Range expansion underway before directional consensus; monitor for imminent breakout trigger.`;
    }
  } else {
    signalType = 'COMPRESSION';
    signalTitle = 'Volatility Compression Regime';
    signalDescription = `ATR (${currencySymbol}${currentAtr.toFixed(2)}) is operating below its 20-day average (${currencySymbol}${currentAtrMa20.toFixed(2)}). Low-volatility compression.`;
  }

  const alert: VolatilityAlert | null = isSurgeActive
    ? {
        id: `VOL-${symbol}-${currentCandle.time}`,
        symbol,
        name,
        exchange,
        currencySymbol,
        currentPrice: currentCandle.close,
        priceChangePercent,
        currentAtr,
        atrMa20: currentAtrMa20,
        surgeRatio,
        surgePercent,
        severity,
        signalType,
        signalTitle,
        signalDescription,
        isBreakout,
        isAnomaly,
        detectedAt: currentCandle.time,
        marketStatus,
      }
    : null;

  return {
    alert,
    currentAtr,
    atrMa20: currentAtrMa20,
    surgeRatio,
    surgePercent,
    isSurgeActive,
    history,
  };
}
