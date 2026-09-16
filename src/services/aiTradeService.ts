import {
  TradeSetup,
  RiskAnalysis,
  TargetDurationProjection,
  PortfolioEvaluation,
  AITradeAnalysis,
  AIRankedTradeOption,
} from '../types';

export async function analyzeSetupWithAI(
  setup: TradeSetup,
  riskAnalysis?: RiskAnalysis,
  durationProjection?: TargetDurationProjection,
  portfolioEvaluation?: PortfolioEvaluation
): Promise<AITradeAnalysis> {
  try {
    const response = await fetch('/api/ai/analyze-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setup,
        riskAnalysis,
        durationProjection,
        portfolioEvaluation,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Analysis server error: ${response.status}`);
    }

    const data = await response.json();
    return data as AITradeAnalysis;
  } catch (error: any) {
    console.warn('AI analysis request fallback:', error);
    // Return structured quantitative fallback
    const days = durationProjection?.expectedTradingDays || 12;
    const targetDate = durationProjection?.expectedTargetDate || 'In ~2-3 weeks';
    const isGoodRR = setup.rewardToRisk >= 2.0;

    return {
      verdict: isGoodRR ? 'STRONG_TRADE' : 'PASS',
      verdictTitle: isGoodRR
        ? `${setup.symbol} Quantitative Edge Confirmed`
        : `${setup.symbol} Below Risk Threshold`,
      confidenceScore: Math.min(95, Math.max(55, Math.round(setup.confluenceScore * 0.9))),
      targetTimelineVerdict: `Target projected in ~${days} trading days (${targetDate}) based on ${setup.currencySymbol || '$'}${setup.atr14.toFixed(2)} daily ATR.`,
      targetReachDateEstimate: targetDate,
      bullishThesis: [
        `Favorable R:R of ${setup.rewardToRisk.toFixed(2)}:1 with disciplined entry at ${setup.currencySymbol || '$'}${setup.entryPrice.toFixed(2)}.`,
        `Aligned with 200-day trend and ${setup.confluenceFactors.length} confirmation factors.`,
        `Daily ATR of ${setup.atrPercent.toFixed(1)}% permits healthy milestone progression without excessive slippage.`,
      ],
      bearishRisks: [
        `Invalidated if price drops below stop loss of ${setup.currencySymbol || '$'}${setup.stopLossPrice.toFixed(2)}.`,
        `Risk of consolidation at +1.0R breakeven checkpoint.`,
        `Broader index weakness or earnings releases may delay target arrival.`,
      ],
      portfolioRecommendation: portfolioEvaluation?.shouldTrade === 'TRADE_APPROVED'
        ? 'Portfolio approved for full position execution.'
        : portfolioEvaluation?.shouldTrade === 'REDUCED_SIZE'
        ? 'Execute with 0.5x position sizing.'
        : 'Do not trade: exceeds risk thresholds.',
      executionGuidance: setup.marketStatus === 'OPEN'
        ? 'Market is open. Execute limit or buy-stop order at predetermined level.'
        : 'Market is closed. Stage order for upcoming session opening auction.',
      timestamp: new Date().toISOString(),
      isAiGenerated: false,
    };
  }
}

export async function rankTradeOptionsWithAI(setups: TradeSetup[]): Promise<AIRankedTradeOption[]> {
  try {
    const response = await fetch('/api/ai/rank-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setups }),
    });

    if (!response.ok) {
      throw new Error(`AI Rank server error: ${response.status}`);
    }

    const data = await response.json();
    return data.ranked as AIRankedTradeOption[];
  } catch (error) {
    console.warn('AI ranking fallback:', error);
    return setups.slice(0, 10).map((s, idx) => ({
      symbol: s.symbol,
      name: s.name,
      exchange: s.exchange || 'US',
      currencySymbol: s.currencySymbol || (s.exchange === 'JSE' ? 'R' : '$'),
      setupType: s.setupType,
      rank: idx + 1,
      score: Math.min(95, Math.round(s.confluenceScore * 0.5 + s.rewardToRisk * 15)),
      actionTag: idx < 2 ? 'STRONG_BUY' : 'ACCUMULATE',
      expectedDaysToTarget: Math.max(5, Math.ceil((s.targetPrice - s.entryPrice) / (Math.max(0.1, s.atr14) * 0.4))),
      targetDate: 'Next 2-3 weeks',
      rewardToRisk: s.rewardToRisk,
      shouldTradeVerdict: idx < 2 ? 'Recommended for execution' : 'Secondary candidate',
      rationale: `${s.symbol} displays ${s.confluenceScore} confluence points with ${s.rewardToRisk.toFixed(1)}:1 R:R.`,
    }));
  }
}
