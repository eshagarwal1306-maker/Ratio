import type {
  SourcerResult,
  JurisdictionistResult,
  DevilsAdvocateResult,
  HistorianResult,
  FirmMemoryResult,
} from "./schemas";

export function computeGavelScore(
  sourcer: SourcerResult,
  jurisdictionist: JurisdictionistResult,
  historian: HistorianResult,
  devils: DevilsAdvocateResult,
  memory: FirmMemoryResult
): number {
  let score = 0;

  // Sourcer
  if (sourcer.status === "CITED") score += 25;
  else if (sourcer.status === "INFERRED") score += 5;
  else score -= 30; // NOT_FOUND

  // Jurisdictionist
  if (jurisdictionist.status === "WRONG_JURISDICTION") score -= 40;
  else if (jurisdictionist.status === "UNCLEAR") score -= 15;
  // APPLICABLE: +0

  // Historian
  if (historian.status === "AMENDED") score -= 15;
  // CURRENT or UNKNOWN: +0

  // Devil's Advocate
  if (devils.strength === "high") score -= 20;
  else if (devils.strength === "medium") score -= 10;
  // low: +0

  // Firm Memory
  if (memory.status === "CONTRADICTION_FOUND") score -= 35;

  // Normalise to 0–100 (base 50)
  return Math.max(0, Math.min(100, score + 50));
}
