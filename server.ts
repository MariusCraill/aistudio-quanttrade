import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy initialization of Gemini Client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim() === '' || key.length < 10) {
    return null;
  }
  if (!geminiClient) {
    try {
      geminiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch (err) {
      console.warn('Could not initialize GoogleGenAI client:', err);
    }
  }
  return geminiClient;
}

// In-memory cache for market data (TTL in milliseconds)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_CANDLES = 3 * 60 * 1000; // 3 minutes
const CACHE_TTL_STATUS = 15 * 1000; // 15 seconds

/**
 * Calculates current trading status for JSE (SAST UTC+2) and US (ET)
 */
export function getExchangeStatus(exchange: 'JSE' | 'US') {
  const now = new Date();

  if (exchange === 'JSE') {
    // South Africa Standard Time (SAST) is UTC+2
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const sastHours = (utcHours + 2) % 24;
    const sastMinutes = utcMinutes;
    const dayOfWeek = now.getUTCDay(); // 0 is Sunday, 6 is Saturday

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const totalMinutes = sastHours * 60 + sastMinutes;
    const openMinutes = 9 * 60; // 09:00 SAST
    const closeMinutes = 17 * 60; // 17:00 SAST

    const isOpen = !isWeekend && totalMinutes >= openMinutes && totalMinutes < closeMinutes;
    const timeStr = `${String(sastHours).padStart(2, '0')}:${String(sastMinutes).padStart(2, '0')} SAST`;

    return {
      exchange: 'JSE' as const,
      exchangeName: 'Johannesburg Stock Exchange',
      isOpen,
      statusText: isOpen ? 'Market is Open' : 'Market is Closed',
      timezone: 'SAST (UTC+2)',
      localTime: timeStr,
      tradingHours: 'Mon–Fri 09:00 to 17:00 SAST',
      message: isOpen
        ? 'Live JSE trading session active (09:00 - 17:00 SAST).'
        : isWeekend
        ? 'JSE is closed for the weekend. Next trading session opens Monday at 09:00 SAST. Displaying official closing prices.'
        : totalMinutes < openMinutes
        ? `JSE is closed (pre-market). Today's trading session opens at 09:00 SAST (${timeStr} now). Displaying previous close.`
        : `JSE trading session closed at 17:00 SAST (${timeStr} now). Next session opens tomorrow at 09:00 SAST. Displaying official closing prices.`,
    };
  } else {
    // US Markets (NYSE / NASDAQ, America/New_York)
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
        weekday: 'short',
      });
      const parts = formatter.formatToParts(now);
      const hourPart = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
      const minPart = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
      const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Wed';

      const isWeekend = weekday === 'Sat' || weekday === 'Sun';
      const totalMinutes = hourPart * 60 + minPart;
      const openMinutes = 9 * 60 + 30; // 09:30 ET
      const closeMinutes = 16 * 60; // 16:00 ET

      const isOpen = !isWeekend && totalMinutes >= openMinutes && totalMinutes < closeMinutes;
      const timeStr = `${String(hourPart).padStart(2, '0')}:${String(minPart).padStart(2, '0')} ET`;

      return {
        exchange: 'US' as const,
        exchangeName: 'US Markets (NYSE / NASDAQ)',
        isOpen,
        statusText: isOpen ? 'Market is Open' : 'Market is Closed',
        timezone: 'ET (New York)',
        localTime: timeStr,
        tradingHours: 'Mon–Fri 09:30 to 16:00 ET',
        message: isOpen
          ? 'Regular US trading session active (09:30 - 16:00 ET).'
          : isWeekend
          ? 'US Markets are closed for the weekend. Regular trading opens Monday at 09:30 ET. Displaying official closing prices.'
          : totalMinutes < openMinutes
          ? `US Markets are closed (pre-market). Regular trading opens at 09:30 ET (${timeStr} now). Displaying previous close.`
          : `US Markets closed at 16:00 ET (${timeStr} now). Next regular session opens tomorrow at 09:30 ET. Displaying official closing prices.`,
      };
    } catch (e) {
      return {
        exchange: 'US' as const,
        exchangeName: 'US Markets (NYSE / NASDAQ)',
        isOpen: false,
        statusText: 'Market is Closed',
        timezone: 'ET',
        localTime: 'Closed',
        tradingHours: 'Mon–Fri 09:30 to 16:00 ET',
        message: 'US Markets are currently closed.',
      };
    }
  }
}

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 2. Market Status Endpoint
app.get('/api/market/status', (req, res) => {
  const jse = getExchangeStatus('JSE');
  const us = getExchangeStatus('US');
  res.json({ jse, us, serverTime: new Date().toISOString() });
});

// 3. Historical Real Candles Endpoint
app.get('/api/market/candles/:symbol', async (req, res) => {
  try {
    const rawSymbol = req.params.symbol.trim();
    const isJSE = rawSymbol.toUpperCase().endsWith('.JO') || !rawSymbol.includes('.');
    // If JSE and symbol does not have .JO, we could normalize or use as-is
    const symbol = rawSymbol.toUpperCase();
    const cacheKey = `candles_${symbol}`;
    const forceRefresh = req.query.refresh === 'true' || req.query.force === 'true';

    const cached = cache.get(cacheKey);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_CANDLES) {
      return res.json(cached.data);
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Market data provider returned ${response.status}`,
        symbol,
      });
    }

    const data: any = await response.json();
    const result = data?.chart?.result?.[0];

    if (!result || !result.timestamp) {
      return res.status(404).json({ error: 'No market candle data found for symbol', symbol });
    }

    const meta = result.meta || {};
    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const isJseStock = symbol.endsWith('.JO') || meta.currency === 'ZAc' || meta.currency === 'ZAR';

    // In Yahoo Finance, JSE equities are quoted in cents (ZAc).
    // Convert cents to Rands (ZAR) by dividing by 100 for clear technical analysis.
    const divisor = isJseStock && meta.currency === 'ZAc' ? 100 : 1;

    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = quote.open[i];
      const h = quote.high[i];
      const l = quote.low[i];
      const c = quote.close[i];
      const v = quote.volume[i];

      if (o != null && h != null && l != null && c != null) {
        const d = new Date(timestamps[i] * 1000);
        candles.push({
          time: d.toISOString().split('T')[0],
          open: Math.round((o / divisor) * 100) / 100,
          high: Math.round((h / divisor) * 100) / 100,
          low: Math.round((l / divisor) * 100) / 100,
          close: Math.round((c / divisor) * 100) / 100,
          volume: v || 0,
        });
      }
    }

    const exchange = isJseStock ? 'JSE' : 'US';
    const marketStatus = getExchangeStatus(exchange);

    const payload = {
      symbol,
      name: meta.shortName || meta.longName || symbol,
      exchange,
      exchangeName: meta.fullExchangeName || (isJseStock ? 'Johannesburg Stock Exchange' : 'US Markets'),
      currency: isJseStock ? 'ZAR' : (meta.currency || 'USD'),
      currencySymbol: isJseStock ? 'R' : '$',
      rawCurrency: meta.currency,
      regularMarketPrice: Math.round(((meta.regularMarketPrice || candles[candles.length - 1]?.close || 0) / divisor) * 100) / 100,
      regularMarketChange: meta.fulldayChange ? meta.fulldayChange / divisor : 0,
      regularMarketChangePercent: meta.regularMarketChangePercent || 0,
      candles,
      marketStatus,
    };

    cache.set(cacheKey, { data: payload, timestamp: Date.now() });
    res.json(payload);
  } catch (error: any) {
    console.error('Error fetching candles:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch real market data' });
  }
});

// 4. Real Quote Endpoint
app.get('/api/market/quote/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.trim().toUpperCase();
    const isJseStock = symbol.endsWith('.JO');
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Quote not found' });
    }

    const data: any = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;

    if (!meta) {
      return res.status(404).json({ error: 'No quote data available' });
    }

    const divisor = (isJseStock || meta.currency === 'ZAc') ? 100 : 1;
    const exchange = (isJseStock || meta.exchangeName === 'JNB') ? 'JSE' : 'US';
    const status = getExchangeStatus(exchange);

    res.json({
      symbol,
      name: meta.shortName || meta.longName || symbol,
      exchange,
      currency: exchange === 'JSE' ? 'ZAR' : (meta.currency || 'USD'),
      currencySymbol: exchange === 'JSE' ? 'R' : '$',
      price: Math.round(((meta.regularMarketPrice || 0) / divisor) * 100) / 100,
      change: meta.fulldayChange ? Math.round((meta.fulldayChange / divisor) * 100) / 100 : 0,
      changePercent: meta.regularMarketChangePercent || 0,
      high: meta.regularMarketDayHigh ? Math.round((meta.regularMarketDayHigh / divisor) * 100) / 100 : null,
      low: meta.regularMarketDayLow ? Math.round((meta.regularMarketDayLow / divisor) * 100) / 100 : null,
      volume: meta.regularMarketVolume || 0,
      marketStatus: status,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Helper for computing 14-period ATR and 20-day ATR moving average on server
function computeAtrMetricsFromCandles(candles: any[]) {
  if (!candles || candles.length < 35) return null;
  const trueRanges: number[] = [];
  const atrs: (number | null)[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trueRanges.push(candles[i].high - candles[i].low);
      atrs.push(null);
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

    if (i < 14) {
      atrs.push(null);
    } else if (i === 14) {
      const sum = trueRanges.slice(1, 15).reduce((a, b) => a + b, 0);
      atrs.push(sum / 14);
    } else {
      const prevAtr = atrs[i - 1]!;
      const currentAtr = (prevAtr * 13 + tr) / 14;
      atrs.push(currentAtr);
    }
  }

  // Calculate 20-day Simple Moving Average of ATR(14)
  const atrMa20: (number | null)[] = [];
  for (let i = 0; i < atrs.length; i++) {
    if (i < 33) {
      atrMa20.push(null);
      continue;
    }
    let sum = 0;
    let hasNull = false;
    for (let j = 0; j < 20; j++) {
      const v = atrs[i - j];
      if (v == null) {
        hasNull = true;
        break;
      }
      sum += v;
    }
    atrMa20.push(hasNull ? null : sum / 20);
  }

  const lastIdx = candles.length - 1;
  const currentAtr = atrs[lastIdx];
  const currentMa = atrMa20[lastIdx];

  if (currentAtr == null || currentMa == null || currentMa === 0) return null;

  const surgeRatio = Number((currentAtr / currentMa).toFixed(2));
  const surgePercent = Number((((currentAtr - currentMa) / currentMa) * 100).toFixed(1));
  const isSurgeActive = currentAtr > currentMa;

  return {
    currentAtr: Number(currentAtr.toFixed(2)),
    atrMa20: Number(currentMa.toFixed(2)),
    surgeRatio,
    surgePercent,
    isSurgeActive,
  };
}

const MONITORED_VOLATILITY_UNIVERSE = [
  'NPN.JO', 'SOL.JO', 'PRX.JO', 'FSR.JO', 'CPI.JO', 'AGL.JO', 'GFI.JO', 'SHP.JO', 'SBK.JO', 'MTN.JO',
  'NVDA', 'AAPL', 'MSFT', 'AMD', 'AMZN', 'TSLA',
];

// 4.5. Real-Time Volatility Alert Radar Endpoint
// Detects when an asset's current ATR exceeds its 20-day moving average
app.get('/api/market/volatility-alerts', async (req, res) => {
  try {
    const rawSymbols = req.query.symbols as string | undefined;
    const forceRefresh = req.query.refresh === 'true' || req.query.force === 'true';
    const symbols = rawSymbols
      ? rawSymbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      : MONITORED_VOLATILITY_UNIVERSE;

    const alerts: any[] = [];
    let totalMonitored = 0;

    for (const sym of symbols) {
      try {
        const cacheKey = `candles_${sym}`;
        let candlesData = !forceRefresh ? cache.get(cacheKey)?.data : undefined;

        if (!candlesData) {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1y`;
          const resp = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'application/json',
            },
          });
          if (resp.ok) {
            const data: any = await resp.json();
            const result = data?.chart?.result?.[0];
            if (result && result.timestamp) {
              const meta = result.meta || {};
              const timestamps = result.timestamp || [];
              const quote = result.indicators?.quote?.[0] || {};
              const isJseStock = sym.endsWith('.JO') || meta.currency === 'ZAc' || meta.currency === 'ZAR';
              const divisor = isJseStock && meta.currency === 'ZAc' ? 100 : 1;
              const candles = [];
              for (let i = 0; i < timestamps.length; i++) {
                const o = quote.open[i];
                const h = quote.high[i];
                const l = quote.low[i];
                const c = quote.close[i];
                const v = quote.volume[i];
                if (o != null && h != null && l != null && c != null) {
                  candles.push({
                    time: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
                    open: Math.round((o / divisor) * 100) / 100,
                    high: Math.round((h / divisor) * 100) / 100,
                    low: Math.round((l / divisor) * 100) / 100,
                    close: Math.round((c / divisor) * 100) / 100,
                    volume: v || 0,
                  });
                }
              }
              const exchange = isJseStock ? 'JSE' : 'US';
              candlesData = {
                symbol: sym,
                name: meta.shortName || meta.longName || sym,
                exchange,
                currencySymbol: isJseStock ? 'R' : '$',
                regularMarketPrice: Math.round(((meta.regularMarketPrice || candles[candles.length - 1]?.close || 0) / divisor) * 100) / 100,
                regularMarketChangePercent: meta.regularMarketChangePercent || 0,
                candles,
              };
              cache.set(cacheKey, { data: candlesData, timestamp: Date.now() });
            }
          }
        }

        if (candlesData && candlesData.candles && candlesData.candles.length >= 35) {
          totalMonitored++;
          const metrics = computeAtrMetricsFromCandles(candlesData.candles);
          if (metrics && metrics.isSurgeActive) {
            const currentCandle = candlesData.candles[candlesData.candles.length - 1];
            const prevCandle = candlesData.candles[candlesData.candles.length - 2] ?? currentCandle;
            const priceChangePercent = Number((((currentCandle.close - prevCandle.close) / prevCandle.close) * 100).toFixed(2));

            // Determine Severity
            let severity = 'ELEVATED';
            if (metrics.surgeRatio >= 1.35) severity = 'EXTREME_ANOMALY';
            else if (metrics.surgeRatio >= 1.18) severity = 'HIGH';

            // Determine Signal Type
            let signalType = 'BULLISH_BREAKOUT_VOLATILITY';
            let signalTitle = '';
            let signalDescription = '';
            if (priceChangePercent >= 0.8) {
              signalType = 'BULLISH_BREAKOUT_VOLATILITY';
              signalTitle = 'Bullish Volatility Breakout Ignited';
              signalDescription = `ATR (${candlesData.currencySymbol}${metrics.currentAtr.toFixed(2)}) surged +${metrics.surgePercent}% over its 20-day moving average with positive price movement (+${priceChangePercent}%). High probability momentum continuation.`;
            } else if (priceChangePercent <= -1.2) {
              signalType = 'BEARISH_EXPANSION_VOLATILITY';
              signalTitle = 'Bearish Volatility Expansion / Downward Shock';
              signalDescription = `ATR expanded +${metrics.surgePercent}% above 20-day moving average accompanied by negative price pressure (${priceChangePercent}%). Risk warning.`;
            } else {
              signalType = 'VOLATILITY_ANOMALY';
              signalTitle = 'Anomalous Volatility Expansion';
              signalDescription = `Anomalous ATR expansion (+${metrics.surgePercent}% above 20d MA). Volatility range expansion preceding potential breakout ignition.`;
            }

            alerts.push({
              id: `VOL-${sym}-${currentCandle.time}`,
              symbol: sym,
              name: candlesData.name,
              exchange: candlesData.exchange,
              currencySymbol: candlesData.currencySymbol,
              currentPrice: currentCandle.close,
              priceChangePercent,
              currentAtr: metrics.currentAtr,
              atrMa20: metrics.atrMa20,
              surgeRatio: metrics.surgeRatio,
              surgePercent: metrics.surgePercent,
              severity,
              signalType,
              signalTitle,
              signalDescription,
              isBreakout: priceChangePercent >= 1.0,
              isAnomaly: metrics.surgeRatio >= 1.35,
              detectedAt: currentCandle.time,
              marketStatus: getExchangeStatus(candlesData.exchange).statusText,
            });
          }
        }
      } catch (assetErr) {
        console.warn(`Error computing volatility for ${sym}:`, assetErr);
      }
    }

    // Sort by surgePercent descending
    alerts.sort((a, b) => b.surgePercent - a.surgePercent);

    const activeSurgeCount = alerts.length;
    const avgSurge = activeSurgeCount > 0
      ? Number((alerts.reduce((acc, curr) => acc + curr.surgePercent, 0) / activeSurgeCount).toFixed(1))
      : 0;

    const isExpansionRegime = activeSurgeCount >= Math.max(2, Math.floor(totalMonitored * 0.3));

    res.json({
      timestamp: new Date().toISOString(),
      totalMonitored: totalMonitored || symbols.length,
      activeSurgeCount,
      averageSurgePercent: avgSurge,
      marketRegime: isExpansionRegime ? 'VOLATILITY_EXPANSION' : 'NORMAL',
      regimeSummary: isExpansionRegime
        ? `Market-wide Volatility Expansion: ${activeSurgeCount} of ${totalMonitored} assets (${Math.round((activeSurgeCount / (totalMonitored || 1)) * 100)}%) are experiencing ATR expansion above their 20-day average.`
        : `Normal Volatility Regime: ${activeSurgeCount} asset(s) currently exhibiting ATR surges above their 20-day average.`,
      topAnomaly: alerts[0] || null,
      alerts,
    });
  } catch (err: any) {
    console.error('Error in volatility-alerts route:', err);
    res.status(500).json({ error: err.message || 'Failed to scan volatility alerts' });
  }
});

// Helper for wrapping external promises with a timeout (default 15s for LLM generation)
function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

// 5. AI Trade Setup & Target Duration Analysis
app.post('/api/ai/analyze-setup', async (req, res) => {
  try {
    const { setup, riskAnalysis, durationProjection, portfolioEvaluation } = req.body;

    if (!setup) {
      return res.status(400).json({ error: 'Missing trade setup data' });
    }

    const ai = getGeminiClient();

    if (ai) {
      try {
        const prompt = `Analyze this live trade setup:
- Asset: ${setup.symbol} (${setup.name}) on ${setup.exchange || 'JSE/US'}
- Setup Type: ${setup.setupType} (${setup.horizon || 'SWING'})
- Price Levels: Entry = ${setup.entryPrice}, Stop Loss = ${setup.stopLossPrice}, Target = ${setup.targetPrice}
- Reward-to-Risk: ${setup.rewardToRisk.toFixed(2)}:1, Expected Value: ${riskAnalysis?.expectedValue?.toFixed(2) || 'N/A'}
- Daily Volatility (ATR-14): ${setup.atr14?.toFixed(2)} (${setup.atrPercent?.toFixed(1)}% of price)
- Mathematical Duration Estimate: ~${durationProjection?.expectedTradingDays || 10} trading days (Expected target date: ${durationProjection?.expectedTargetDate || 'Next 2 weeks'})
- Trend Score: ${setup.trendQualityScore}/100, Confluence: ${setup.confluenceScore}/100
- Confluence Factors: ${setup.confluenceFactors?.join(', ') || '20d Breakout'}
- Current Market Session: ${setup.marketStatus === 'OPEN' ? 'Live Open' : 'Closed / Pre-market'}
- Portfolio Context: Risk budget = ${portfolioEvaluation?.tradeRiskPercent || 1}% of portfolio, Current portfolio risk heat = ${portfolioEvaluation?.currentOpenRiskPercent || 0}%, Max risk limit = ${portfolioEvaluation?.maxPortfolioRiskPercent || 5}%

Provide:
1. Direct verdict ('STRONG_TRADE', 'MODERATE_TRADE', 'WAIT_PULLBACK', or 'PASS')
2. A punchy headline title
3. Conviction confidence score (1-100)
4. Realistic evaluation of the target arrival timeline based on daily ATR movement and overhead resistance
5. Specific target arrival window date
6. 3 key bullish catalysts/thesis points
7. 3 bearish risks or invalidation triggers
8. Clear portfolio recommendation on whether the user should take this trade or pass
9. Concrete execution guidance (especially if the market is closed or opening with a gap)`;

        const aiResponse = await withTimeout(
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              systemInstruction: 'You are an elite quantitative hedge fund trade analyst and portfolio risk manager. Analyze equity trade setups with rigorous risk discipline, assess when profit targets will be met based on daily ATR volatility, and determine whether the portfolio should execute the trade.',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  verdict: {
                    type: Type.STRING,
                    description: 'STRONG_TRADE | MODERATE_TRADE | WAIT_PULLBACK | PASS',
                  },
                  verdictTitle: { type: Type.STRING },
                  confidenceScore: { type: Type.INTEGER },
                  targetTimelineVerdict: { type: Type.STRING },
                  targetReachDateEstimate: { type: Type.STRING },
                  bullishThesis: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  bearishRisks: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  portfolioRecommendation: { type: Type.STRING },
                  executionGuidance: { type: Type.STRING },
                },
                required: [
                  'verdict',
                  'verdictTitle',
                  'confidenceScore',
                  'targetTimelineVerdict',
                  'targetReachDateEstimate',
                  'bullishThesis',
                  'bearishRisks',
                  'portfolioRecommendation',
                  'executionGuidance',
                ],
              },
            },
          }),
          15000
        );

        const parsed = JSON.parse(aiResponse.text || '{}');
        return res.json({
          ...parsed,
          timestamp: new Date().toISOString(),
          isAiGenerated: true,
        });
      } catch (geminiErr: any) {
        const errMsg = geminiErr?.message || String(geminiErr);
        console.warn('Gemini analyze-setup notice, applying quantitative fallback:', errMsg);
        // Fall through to quantitative fallback below
      }
    }

    // Fallback if GEMINI_API_KEY is not configured: high-precision quantitative rule synthesis
    const isGoodRR = (setup.rewardToRisk || 0) >= 2.0;
    const isHighTrend = (setup.trendQualityScore || 0) >= 70;
    const days = durationProjection?.expectedTradingDays || 12;
    const targetDate = durationProjection?.expectedTargetDate || 'In ~2-3 weeks';

    const fallbackVerdict = (isGoodRR && isHighTrend)
      ? 'STRONG_TRADE'
      : isGoodRR
      ? 'MODERATE_TRADE'
      : 'PASS';

    return res.json({
      verdict: fallbackVerdict,
      verdictTitle: fallbackVerdict === 'STRONG_TRADE'
        ? `High Probability ${setup.setupType === 'MOMENTUM_BREAKOUT' ? 'Breakout' : 'Pullback'} Setup`
        : fallbackVerdict === 'MODERATE_TRADE'
        ? `Calculated Swing Opportunity with Controlled Risk`
        : `Below Risk Threshold — Pass on Trade`,
      confidenceScore: Math.min(92, Math.max(50, Math.round((setup.confluenceScore || 65) * 0.9 + 10))),
      targetTimelineVerdict: `At an average daily true range of ${setup.currencySymbol || '$'}${setup.atr14?.toFixed(2) || '1.50'}, the target distance is achievable within approximately ${days} trading sessions assuming normal momentum persistence.`,
      targetReachDateEstimate: targetDate,
      bullishThesis: [
        `Strong Reward-to-Risk ratio of ${setup.rewardToRisk?.toFixed(2) || '2.50'}:1 with positive mathematical expectancy.`,
        `Confluence alignment across ${setup.confluenceFactors?.length || 3} technical factors with 200 SMA structural support.`,
        `Favorable volatility profile with daily ATR at ${setup.atrPercent?.toFixed(1) || '2.5'}% of price.`,
      ],
      bearishRisks: [
        `Immediate invalidation if price breaks structural swing low / ATR stop at ${setup.currencySymbol || '$'}${setup.stopLossPrice?.toFixed(2)}.`,
        `Broader exchange market regime or earnings announcements could disrupt projected ${days}-day holding duration.`,
        `Potential volume exhaustion near the +1.0R breakeven trail milestone.`,
      ],
      portfolioRecommendation: portfolioEvaluation?.shouldTrade === 'TRADE_APPROVED'
        ? `Approved for portfolio execution. Allocate standard ${riskAnalysis?.riskPercent || 1}% risk capital (${setup.currencySymbol || '$'}${riskAnalysis?.riskDollars || 500}).`
        : portfolioEvaluation?.shouldTrade === 'REDUCED_SIZE'
        ? `Execute with 0.5x size (${setup.currencySymbol || '$'}${Math.round((riskAnalysis?.riskDollars || 500) * 0.5)}) due to moderate volatility or existing portfolio risk heat.`
        : `Do not execute: setup does not meet strict portfolio risk capital preservation standards.`,
      executionGuidance: setup.marketStatus === 'OPEN'
        ? `Market is currently open. Enter with a buy-stop limit order at ${setup.currencySymbol || '$'}${setup.entryPrice?.toFixed(2)} with hard stop pre-programmed at ${setup.currencySymbol || '$'}${setup.stopLossPrice?.toFixed(2)}.`
        : `Market is currently closed. Stage a pre-market or on-open limit order for the next trading session. Confirm morning open does not gap beyond 1.5x ATR before execution.`,
      timestamp: new Date().toISOString(),
      isAiGenerated: false,
    });
  } catch (err: any) {
    console.error('AI analyze error:', err);
    res.status(500).json({ error: err.message || 'AI analysis failed' });
  }
});

// 6. AI Rank Trade Options Across Universe
app.post('/api/ai/rank-options', async (req, res) => {
  try {
    const { setups } = req.body;
    if (!Array.isArray(setups) || setups.length === 0) {
      return res.status(400).json({ error: 'No setups provided to rank' });
    }

    const ai = getGeminiClient();

    if (ai && setups.length > 0) {
      try {
        const simplifiedSetups = setups.slice(0, 8).map((s: any) => ({
          symbol: s.symbol,
          name: s.name,
          exchange: s.exchange,
          setupType: s.setupType,
          rewardToRisk: Number((s.rewardToRisk || 2).toFixed(2)),
          trendScore: s.trendQualityScore || 70,
          confluenceScore: s.confluenceScore || 70,
          atrPercent: Number((s.atrPercent || 2.5).toFixed(1)),
        }));

        const prompt = `Evaluate and rank these trade options from best to worst based on expected value, confluence, and risk management.
Options: ${JSON.stringify(simplifiedSetups)}

For each, provide:
1. Rank number (1 being best)
2. Score (0-100)
3. Action tag ('STRONG_BUY', 'ACCUMULATE', 'WATCH_DIP', or 'PASS')
4. Expected trading days to target
5. Target calendar date estimate
6. Verdict on whether the portfolio should trade it
7. Concise 1-sentence rationale`;

        const aiResponse = await withTimeout(
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              systemInstruction: 'You are an elite quantitative portfolio manager ranking trade options based on expected value, trend quality, and risk management.',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    symbol: { type: Type.STRING },
                    rank: { type: Type.INTEGER },
                    score: { type: Type.INTEGER },
                    actionTag: { type: Type.STRING, description: 'STRONG_BUY | ACCUMULATE | WATCH_DIP | PASS' },
                    expectedDaysToTarget: { type: Type.INTEGER },
                    targetDate: { type: Type.STRING },
                    shouldTradeVerdict: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                  },
                  required: ['symbol', 'rank', 'score', 'actionTag', 'expectedDaysToTarget', 'targetDate', 'shouldTradeVerdict', 'rationale'],
                },
              },
            },
          }),
          15000
        );

        const parsed = JSON.parse(aiResponse.text || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
          const setupMap = new Map(setups.map((s: any) => [s.symbol, s]));
          const enriched = parsed.map((item: any) => {
            const orig = setupMap.get(item.symbol);
            return {
              ...item,
              name: orig?.name || item.symbol,
              exchange: orig?.exchange || 'US',
              currencySymbol: orig?.currencySymbol || (orig?.exchange === 'JSE' ? 'R' : '$'),
              setupType: orig?.setupType || 'PULLBACK_SUPPORT',
              rewardToRisk: orig?.rewardToRisk || 2.0,
            };
          });
          return res.json({ ranked: enriched, isAiGenerated: true });
        }
      } catch (geminiErr: any) {
        const errMsg = geminiErr?.message || String(geminiErr);
        console.warn('Gemini rank-options notice, applying quantitative fallback:', errMsg);
        // Fall through to quantitative fallback below
      }
    }

    // Quantitative fallback ranking
    const sorted = [...setups]
      .sort((a, b) => {
        const scoreA = (a.rewardToRisk || 0) * 20 + (a.confluenceScore || 0) * 0.4 + (a.trendQualityScore || 0) * 0.4;
        const scoreB = (b.rewardToRisk || 0) * 20 + (b.confluenceScore || 0) * 0.4 + (b.trendQualityScore || 0) * 0.4;
        return scoreB - scoreA;
      })
      .slice(0, 10)
      .map((s, idx) => {
        const score = Math.min(98, Math.max(50, Math.round((s.confluenceScore || 65) * 0.5 + (s.rewardToRisk || 2) * 15)));
        const tag = idx < 2 && s.rewardToRisk >= 2.2 ? 'STRONG_BUY' : s.rewardToRisk >= 2.0 ? 'ACCUMULATE' : 'WATCH_DIP';
        const days = Math.max(5, Math.min(25, Math.ceil((s.targetPrice - s.entryPrice) / (Math.max(0.01, s.atr14) * 0.4))));
        const now = new Date();
        now.setDate(now.getDate() + Math.ceil(days * 1.4));
        const targetDate = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        return {
          symbol: s.symbol,
          name: s.name,
          exchange: s.exchange,
          currencySymbol: s.currencySymbol || (s.exchange === 'JSE' ? 'R' : '$'),
          setupType: s.setupType,
          rank: idx + 1,
          score,
          actionTag: tag,
          expectedDaysToTarget: days,
          targetDate,
          rewardToRisk: s.rewardToRisk,
          shouldTradeVerdict: tag === 'STRONG_BUY' ? 'Approved — Top Universe Pick' : tag === 'ACCUMULATE' ? 'Approved with Standard Sizing' : 'Hold / Wait for Better Entry',
          rationale: `${s.symbol} presents a ${s.rewardToRisk.toFixed(1)}:1 R:R with ${s.confluenceScore} confluence points. Projected target in ~${days} trading days.`,
        };
      });

    return res.json({ ranked: sorted, isAiGenerated: false });
  } catch (err: any) {
    console.error('AI ranking error:', err);
    res.status(500).json({ error: err.message || 'AI ranking failed' });
  }
});

// Start server with Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} at http://0.0.0.0:${PORT}`);
  });
}

startServer();
