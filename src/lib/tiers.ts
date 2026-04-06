import type { CompanyTier } from "@prisma/client";

/** Paid tiers only raise questionnaire count (per product plan). */
export function maxQuestionnairesForTier(tier: CompanyTier): number {
  switch (tier) {
    case "default":
      return 3;
    case "basic":
      return 25;
    case "pro":
      return 100;
    default:
      return 3;
  }
}
