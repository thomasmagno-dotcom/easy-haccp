/**
 * 4×4 Risk Assessment Matrix for HACCP Hazard Analysis
 *
 * Severity levels (impact if the hazard occurs):
 *   1 = Negligible — No injury or illness expected
 *   2 = Minor      — Minor injury, minor illness, no lasting effects
 *   3 = Major      — Serious injury/illness, hospitalization possible
 *   4 = Critical   — Life-threatening, death, or widespread illness
 *
 * Likelihood levels (probability of occurrence):
 *   1 = Rare            — Virtually never occurs; no history
 *   2 = Unlikely        — Could occur but not expected; rare history
 *   3 = Likely          — Has occurred; expected to happen
 *   4 = Almost Certain  — Occurs frequently; expected in normal operation
 *
 * Risk Score = Severity × Likelihood (range 1-16)
 *
 * Risk Categories:
 *   1-3   = Low Risk       (green)  — Not significant
 *   4-6   = Medium Risk    (yellow) — Not significant
 *   8-9   = High Risk      (orange) — SIGNIFICANT
 *   12-16 = Critical Risk  (red)    — SIGNIFICANT
 *
 * Significance threshold: score >= 8 is automatically significant.
 * Scores 4-6 are borderline — user can override to significant if justified.
 */

export const SEVERITY_LEVELS = [
  { value: "1", label: "Negligible", description: "No injury or illness expected", color: "text-green-700 bg-green-50" },
  { value: "2", label: "Minor", description: "Minor injury/illness, no lasting effects", color: "text-yellow-700 bg-yellow-50" },
  { value: "3", label: "Major", description: "Serious injury/illness, hospitalization", color: "text-orange-700 bg-orange-50" },
  { value: "4", label: "Critical", description: "Life-threatening, death, widespread illness", color: "text-red-700 bg-red-50" },
] as const;

export const LIKELIHOOD_LEVELS = [
  { value: "1", label: "Rare", description: "Virtually never occurs", color: "text-green-700 bg-green-50" },
  { value: "2", label: "Unlikely", description: "Could occur but not expected", color: "text-yellow-700 bg-yellow-50" },
  { value: "3", label: "Likely", description: "Has occurred, expected to happen", color: "text-orange-700 bg-orange-50" },
  { value: "4", label: "Almost Certain", description: "Occurs frequently", color: "text-red-700 bg-red-50" },
] as const;

export type RiskCategory = "low" | "medium" | "high" | "critical";

export interface RiskAssessment {
  severity: number;
  likelihood: number;
  score: number;
  category: RiskCategory;
  isSignificant: boolean;
  label: string;
}

export function computeRiskScore(severityStr: string | null, likelihoodStr: string | null): RiskAssessment {
  const severity = parseInt(severityStr || "0", 10);
  const likelihood = parseInt(likelihoodStr || "0", 10);

  if (severity < 1 || severity > 4 || likelihood < 1 || likelihood > 4) {
    return {
      severity: 0,
      likelihood: 0,
      score: 0,
      category: "low",
      isSignificant: false,
      label: "Not assessed",
    };
  }

  const score = severity * likelihood;

  let category: RiskCategory;
  let label: string;
  let isSignificant: boolean;

  if (score >= 12) {
    category = "critical";
    label = "Critical Risk";
    isSignificant = true;
  } else if (score >= 8) {
    category = "high";
    label = "High Risk";
    isSignificant = true;
  } else if (score >= 4) {
    category = "medium";
    label = "Medium Risk";
    isSignificant = false;
  } else {
    category = "low";
    label = "Low Risk";
    isSignificant = false;
  }

  return { severity, likelihood, score, category, isSignificant, label };
}

export const RISK_COLORS: Record<RiskCategory, string> = {
  low: "bg-green-100 text-green-800 border-green-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  critical: "bg-red-100 text-red-800 border-red-300",
};

export const RISK_CELL_COLORS: Record<RiskCategory, string> = {
  low: "bg-green-100",
  medium: "bg-yellow-100",
  high: "bg-orange-200",
  critical: "bg-red-200",
};

/** Returns the risk category for a given cell in the 4x4 grid */
export function getCellCategory(severity: number, likelihood: number): RiskCategory {
  const score = severity * likelihood;
  if (score >= 12) return "critical";
  if (score >= 8) return "high";
  if (score >= 4) return "medium";
  return "low";
}

/**
 * Maps old 3-level values to new 4-level values for backward compatibility.
 * "low" → "1", "medium" → "2", "high" → "4"
 */
export function migrateOldLevel(old: string | null): string | null {
  if (!old) return null;
  const map: Record<string, string> = { low: "1", medium: "2", high: "4" };
  return map[old] ?? old;
}
