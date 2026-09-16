/**
 * Utilities for generating external financial portal links (Yahoo Finance, etc.)
 */

export function getYahooFinanceChartUrl(symbol: string): string {
  if (!symbol) return 'https://finance.yahoo.com';
  const clean = symbol.trim().toUpperCase();
  return `https://finance.yahoo.com/chart/${encodeURIComponent(clean)}`;
}

export function getYahooFinanceQuoteUrl(symbol: string): string {
  if (!symbol) return 'https://finance.yahoo.com';
  const clean = symbol.trim().toUpperCase();
  return `https://finance.yahoo.com/quote/${encodeURIComponent(clean)}`;
}
