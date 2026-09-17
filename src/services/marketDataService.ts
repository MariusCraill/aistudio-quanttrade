import { CandleData, MarketStatusInfo, TradeSetup } from '../types';
import { REAL_MARKET_ASSETS, RealMarketAsset } from '../data/realMarketData';
import { analyzeCandleSetup } from './scannerService';

export interface MarketUniverseItem {
  symbol: string;
  name: string;
  exchange: 'JSE' | 'US';
  sector: string;
  currency: 'ZAR' | 'ZAc' | 'USD';
  currencySymbol: string;
  description: string;
}

export const PRESET_UNIVERSE: MarketUniverseItem[] = [
  // JSE (Johannesburg Stock Exchange) Equities
  {
    symbol: 'NPN.JO',
    name: 'Naspers Ltd',
    exchange: 'JSE',
    sector: 'Consumer Tech & Media',
    currency: 'ZAR',
    currencySymbol: 'R',
    description: 'JSE blue-chip technology holding company with Tencent equity stake',
  },
  {
    symbol: 'SOL.JO',
    name: 'Sasol Ltd',
    exchange: 'JSE',
    sector: 'Energy & Chemicals',
    currency: 'ZAR',
    currencySymbol: 'R',
    description: 'Integrated energy and chemical company based in Sandton, Johannesburg',
  },
  {
    symbol: 'PRX.JO',
    name: 'Prosus N.V.',
    exchange: 'JSE',
    sector: 'Global Internet',
    currency: 'ZAR',
    currencySymbol: 'R',
    description: 'Global consumer internet group listed on Euronext Amsterdam and JSE',
  },
  {
    symbol: 'FSR.JO',
    name: 'FirstRand Ltd',
    exchange: 'JSE',
    sector: 'Banking & Financials',
    currency: 'ZAR',
    currencySymbol: 'R',
    description: 'South Africa’s premier financial services conglomerate (FNB, RMB, WesBank)',
  },
  {
    symbol: 'CPI.JO',
    name: 'Capitec Bank Holdings',
    exchange: 'JSE',
    sector: 'Retail Banking',
    currency: 'ZAR',
    currencySymbol: 'R',
    description: 'Fast-growing South African retail banking and digital financial services',
  },
  {
    symbol: 'AGL.JO',
    name: 'Anglo American plc',
    exchange: 'JSE',
    sector: 'Diversified Mining',
    currency: 'ZAR',
    currencySymbol: 'R',
    description: 'Global mining company producing diamonds, copper, platinum group metals',
  },
  {
    symbol: 'GFI.JO',
    name: 'Gold Fields Ltd',
    exchange: 'JSE',
    sector: 'Gold Mining',
    currency: 'ZAR',
    currencySymbol: 'R',
    description: 'Globally diversified gold producer with operations across SA, Australia, Americas',
  },
  {
    symbol: 'SHP.JO',
    name: 'Shoprite Holdings',
    exchange: 'JSE',
    sector: 'Food Retail',
    currency: 'ZAR',
    currencySymbol: 'R',
    description: 'Africa’s largest food retailer operating over 3,000 stores across 11 countries',
  },
  {
    symbol: 'SBK.JO',
    name: 'Standard Bank Group',
    exchange: 'JSE',
    sector: 'Banking & Financials',
    currency: 'ZAR',
    currencySymbol: 'R',
    description: 'Africa’s largest bank by assets with extensive footprint across 20 African nations',
  },
  {
    symbol: 'MTN.JO',
    name: 'MTN Group Ltd',
    exchange: 'JSE',
    sector: 'Telecommunications',
    currency: 'ZAR',
    currencySymbol: 'R',
    description: 'Pan-African telecommunications provider with over 290 million subscribers',
  },

  // US Equities
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corp',
    exchange: 'US',
    sector: 'Semiconductors & AI',
    currency: 'USD',
    currencySymbol: '$',
    description: 'Global leader in GPU architecture, high-performance computing and AI chips',
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc',
    exchange: 'US',
    sector: 'Consumer Technology',
    currency: 'USD',
    currencySymbol: '$',
    description: 'World’s premier consumer electronics and software ecosystem platform',
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corp',
    exchange: 'US',
    sector: 'Enterprise Cloud & AI',
    currency: 'USD',
    currencySymbol: '$',
    description: 'Enterprise cloud computing, Azure infrastructure, productivity software, and AI',
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc',
    exchange: 'US',
    sector: 'Electric Vehicles & Robotics',
    currency: 'USD',
    currencySymbol: '$',
    description: 'Electric vehicles, battery energy storage systems, and autonomous driving',
  },
  {
    symbol: 'AMD',
    name: 'Advanced Micro Devices',
    exchange: 'US',
    sector: 'Semiconductors',
    currency: 'USD',
    currencySymbol: '$',
    description: 'High-performance computing and graphics solutions for data centers and clients',
  },
];

/**
 * Calculates current market status client-side
 */
export function calculateMarketStatus(exchange: 'JSE' | 'US'): MarketStatusInfo {
  const now = new Date();

  if (exchange === 'JSE') {
    // SAST is UTC+2
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
      exchange: 'JSE',
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
    // US Markets (NYSE / NASDAQ)
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
        exchange: 'US',
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
    } catch {
      return {
        exchange: 'US',
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

/**
 * Fetches real, non-simulated market candles from backend or fallback dataset
 */
export async function fetchAssetCandles(symbol: string, refresh = false): Promise<{
  candles: CandleData[];
  symbol: string;
  name: string;
  exchange: 'JSE' | 'US';
  currency: 'ZAR' | 'ZAc' | 'USD';
  currencySymbol: string;
  marketStatus: MarketStatusInfo;
  isRealTime: boolean;
}> {
  const normSymbol = symbol.trim().toUpperCase();
  const isJSE = normSymbol.endsWith('.JO');
  const exchange = isJSE ? 'JSE' : 'US';
  const localStatus = calculateMarketStatus(exchange);

  try {
    const url = `/api/market/candles/${encodeURIComponent(normSymbol)}${refresh ? '?refresh=true' : ''}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.candles && data.candles.length > 0) {
        return {
          candles: data.candles,
          symbol: data.symbol,
          name: data.name,
          exchange: data.exchange,
          currency: data.currency,
          currencySymbol: data.currencySymbol,
          marketStatus: data.marketStatus || localStatus,
          isRealTime: true,
        };
      }
    }
  } catch (err) {
    console.warn(`Live fetch for ${normSymbol} failed, falling back to real local dataset`, err);
  }

  // Fallback to real recorded exchange data in REAL_MARKET_ASSETS
  const match = REAL_MARKET_ASSETS.find(
    a => a.symbol.toUpperCase() === normSymbol || a.symbol.toUpperCase() === `${normSymbol}.JO`
  );

  if (match) {
    return {
      candles: match.data,
      symbol: match.symbol,
      name: match.name,
      exchange: match.exchange,
      currency: match.currency,
      currencySymbol: match.currencySymbol,
      marketStatus: localStatus,
      isRealTime: false,
    };
  }

  // Default to first asset if not found
  const fallback = REAL_MARKET_ASSETS[0];
  return {
    candles: fallback.data,
    symbol: fallback.symbol,
    name: fallback.name,
    exchange: fallback.exchange,
    currency: fallback.currency,
    currencySymbol: fallback.currencySymbol,
    marketStatus: calculateMarketStatus(fallback.exchange),
    isRealTime: false,
  };
}

/**
 * Builds all trade setups from real market assets
 */
export function buildRealMarketSetups(assets: RealMarketAsset[] = REAL_MARKET_ASSETS): TradeSetup[] {
  const list: TradeSetup[] = [];

  for (const asset of assets) {
    const status = calculateMarketStatus(asset.exchange);
    const setup = analyzeCandleSetup(
      asset.symbol,
      asset.name,
      asset.data,
      'ATR_2X',
      'SWING',
      2.5
    );

    if (setup) {
      const fullSetup: TradeSetup = {
        ...setup,
        exchange: asset.exchange,
        currency: asset.currency,
        currencySymbol: asset.currencySymbol,
        marketStatus: status.isOpen ? 'OPEN' : 'CLOSED',
        marketStatusText: status.statusText,
        marketHours: status.tradingHours,
        marketMessage: status.message,
      };
      list.push(fullSetup);
    }
  }

  return list;
}
