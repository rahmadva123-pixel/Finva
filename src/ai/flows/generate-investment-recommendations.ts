
'use server';

import { z } from 'zod';

const InvestmentRecommendationInputSchema = z.object({
  riskTolerance: z.enum(['Conservative', 'Moderate', 'Aggressive']),
  financialGoals: z.enum(['Retirement', 'Saving for a home', 'General wealth building']),
  investmentTimeline: z.enum(['Short term', 'Medium term', 'Long term']),
  investmentAmount: z.number(),
});

export type InvestmentRecommendationInput = z.infer<typeof InvestmentRecommendationInputSchema>;

const InvestmentRecommendationOutputSchema = z.object({
  recommendations: z.array(
    z.object({
      assetClass: z.string(),
      allocationPercentage: z.number(),
      rationale: z.string(),
    })
  ),
  summary: z.string(),
});

export type InvestmentRecommendationOutput = z.infer<typeof InvestmentRecommendationOutputSchema>;

type Recommendation = InvestmentRecommendationOutput['recommendations'][number];

function buildRecommendations(input: InvestmentRecommendationInput): Recommendation[] {
  const goalText =
    input.financialGoals === 'Retirement'
      ? 'long-term retirement growth with some stability'
      : input.financialGoals === 'Saving for a home'
        ? 'capital preservation and easier access to funds for a future home purchase'
        : 'balanced long-term wealth building';

  const strategies: Record<InvestmentRecommendationInput['riskTolerance'], Record<InvestmentRecommendationInput['investmentTimeline'], Recommendation[]>> = {
    Conservative: {
      'Short term': [
        { assetClass: 'Government Bonds', allocationPercentage: 50, rationale: `Provides stability and lower volatility for ${goalText}.` },
        { assetClass: 'Cash Equivalents', allocationPercentage: 30, rationale: 'Keeps a meaningful portion liquid for near-term needs.' },
        { assetClass: 'Dividend Stocks', allocationPercentage: 20, rationale: 'Adds moderate growth potential without taking excessive risk.' },
      ],
      'Medium term': [
        { assetClass: 'Bonds', allocationPercentage: 45, rationale: `Supports dependable returns while staying aligned with ${goalText}.` },
        { assetClass: 'Index Funds', allocationPercentage: 30, rationale: 'Adds diversified market exposure for measured growth.' },
        { assetClass: 'Cash Equivalents', allocationPercentage: 15, rationale: 'Preserves flexibility for planned expenses.' },
        { assetClass: 'Real Estate Funds', allocationPercentage: 10, rationale: 'Introduces diversification through income-focused property exposure.' },
      ],
      'Long term': [
        { assetClass: 'Bonds', allocationPercentage: 35, rationale: 'Acts as the stability anchor in the portfolio.' },
        { assetClass: 'Index Funds', allocationPercentage: 35, rationale: 'Provides broad diversified growth over a longer horizon.' },
        { assetClass: 'Dividend Stocks', allocationPercentage: 20, rationale: 'Adds income and moderate upside potential.' },
        { assetClass: 'Real Estate Funds', allocationPercentage: 10, rationale: 'Improves diversification for long-term holdings.' },
      ],
    },
    Moderate: {
      'Short term': [
        { assetClass: 'Short-Term Bonds', allocationPercentage: 35, rationale: 'Reduces volatility while still targeting modest returns.' },
        { assetClass: 'Index Funds', allocationPercentage: 35, rationale: 'Maintains balanced exposure to market growth.' },
        { assetClass: 'Cash Equivalents', allocationPercentage: 15, rationale: 'Keeps part of the funds accessible if needed soon.' },
        { assetClass: 'Real Estate Funds', allocationPercentage: 15, rationale: 'Adds an income-oriented diversification layer.' },
      ],
      'Medium term': [
        { assetClass: 'Index Funds', allocationPercentage: 45, rationale: 'Forms the core growth engine for a balanced investor.' },
        { assetClass: 'Bonds', allocationPercentage: 25, rationale: 'Offsets equity swings with more stable holdings.' },
        { assetClass: 'Real Estate Funds', allocationPercentage: 15, rationale: 'Adds diversification and potential income.' },
        { assetClass: 'Dividend Stocks', allocationPercentage: 15, rationale: 'Blends growth and income for a moderate profile.' },
      ],
      'Long term': [
        { assetClass: 'Index Funds', allocationPercentage: 50, rationale: 'Captures broad market growth over a longer period.' },
        { assetClass: 'Growth Stocks', allocationPercentage: 20, rationale: 'Adds extra upside potential for long-term compounding.' },
        { assetClass: 'Bonds', allocationPercentage: 20, rationale: 'Maintains balance during market volatility.' },
        { assetClass: 'Real Estate Funds', allocationPercentage: 10, rationale: 'Enhances diversification across asset classes.' },
      ],
    },
    Aggressive: {
      'Short term': [
        { assetClass: 'Index Funds', allocationPercentage: 40, rationale: 'Targets higher upside while remaining diversified.' },
        { assetClass: 'Growth Stocks', allocationPercentage: 30, rationale: 'Increases return potential for an aggressive profile.' },
        { assetClass: 'Cash Equivalents', allocationPercentage: 15, rationale: 'Provides a small buffer for short-term uncertainty.' },
        { assetClass: 'Real Estate Funds', allocationPercentage: 15, rationale: 'Adds diversification outside pure equities.' },
      ],
      'Medium term': [
        { assetClass: 'Growth Stocks', allocationPercentage: 45, rationale: 'Focuses on stronger capital appreciation potential.' },
        { assetClass: 'Index Funds', allocationPercentage: 30, rationale: 'Keeps the portfolio diversified while staying growth-oriented.' },
        { assetClass: 'Real Estate Funds', allocationPercentage: 15, rationale: 'Adds non-equity diversification with income potential.' },
        { assetClass: 'Bonds', allocationPercentage: 10, rationale: 'Softens overall portfolio swings slightly.' },
      ],
      'Long term': [
        { assetClass: 'Growth Stocks', allocationPercentage: 55, rationale: 'Maximizes long-term growth potential for risk-tolerant investors.' },
        { assetClass: 'Index Funds', allocationPercentage: 25, rationale: 'Provides diversified market exposure around the core growth holdings.' },
        { assetClass: 'International Equity Funds', allocationPercentage: 10, rationale: 'Expands diversification across global markets.' },
        { assetClass: 'Real Estate Funds', allocationPercentage: 10, rationale: 'Adds exposure to a different return source over time.' },
      ],
    },
  };

  return strategies[input.riskTolerance][input.investmentTimeline];
}

export async function generateInvestmentRecommendations(
  input: InvestmentRecommendationInput
): Promise<InvestmentRecommendationOutput> {
  const parsedInput = InvestmentRecommendationInputSchema.parse(input);
  const recommendations = buildRecommendations(parsedInput);

  const summary = `For a ${parsedInput.riskTolerance.toLowerCase()} investor focused on ${parsedInput.financialGoals.toLowerCase()} over the ${parsedInput.investmentTimeline.toLowerCase()}, a diversified allocation of $${parsedInput.investmentAmount.toLocaleString()} can emphasize stability and growth without relying on any external AI service.`;

  return InvestmentRecommendationOutputSchema.parse({
    recommendations,
    summary,
  });
}
