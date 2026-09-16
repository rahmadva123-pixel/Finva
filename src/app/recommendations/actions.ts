"use server";

import { generateInvestmentRecommendations, type InvestmentRecommendationInput, type InvestmentRecommendationOutput } from "@/ai/flows/generate-investment-recommendations";
import { z } from "zod";

const InvestmentRecommendationInputSchema = z.object({
  riskTolerance: z.enum(["Conservative", "Moderate", "Aggressive"]),
  financialGoals: z.enum(["Retirement", "Saving for a home", "General wealth building"]),
  investmentTimeline: z.enum(["Short term", "Medium term", "Long term"]),
  investmentAmount: z.coerce.number().min(100, "Investment amount must be at least $100."),
});

type State = {
  message?: string | null;
  errors?: {
    riskTolerance?: string[];
    financialGoals?: string[];
    investmentTimeline?: string[];
    investmentAmount?: string[];
  } | null;
  data?: InvestmentRecommendationOutput | null;
};

export async function getRecommendations(
  prevState: State,
  formData: FormData
): Promise<State> {
  const validatedFields = InvestmentRecommendationInputSchema.safeParse({
    riskTolerance: formData.get("riskTolerance"),
    financialGoals: formData.get("financialGoals"),
    investmentTimeline: formData.get("investmentTimeline"),
    investmentAmount: formData.get("investmentAmount"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing Fields. Failed to Get Recommendations.",
      data: null,
    };
  }

  const inputData: InvestmentRecommendationInput = validatedFields.data;

  try {
    const recommendations = await generateInvestmentRecommendations(inputData);
    return {
      message: "Successfully generated recommendations.",
      data: recommendations,
      errors: null,
    };
  } catch (error) {
    return {
      message: "An error occurred while generating recommendations. Please try again.",
      data: null,
      errors: null,
    };
  }
}
