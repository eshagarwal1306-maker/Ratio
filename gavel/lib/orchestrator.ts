import { extractClaims } from "./claim-extractor";
import { runSourcer } from "./agents/sourcer";
import { runJurisdictionist } from "./agents/jurisdictionist";
import { runDevilsAdvocate } from "./agents/devils-advocate";
import { runHistorian } from "./agents/historian";
import { runFirmMemory } from "./agents/firm-memory";
import { computeGavelScore } from "./scorer";
import { buildReasoningTrace } from "./trace";
import type { ClaimAuditResult, GavelReport } from "./schemas";

export async function runGavel(
  documentText: string,
  entityDescription: string
): Promise<GavelReport> {
  // Step 1: Extract atomic legal claims from the document
  const claims = await extractClaims(documentText);

  if (claims.length === 0) {
    return {
      claims: [],
      overall_score: 100,
      reasoning_trace: "No verifiable legal claims found in the document.",
    };
  }

  // Step 2: Run all 5 agents in parallel for each claim
  // Each agent calls its own tools — no pre-fetching needed here
  const claimResults: ClaimAuditResult[] = await Promise.all(
    claims.map(async (claim) => {
      const [sourcer, jurisdictionist, devils_advocate, historian, firm_memory] =
        await Promise.all([
          runSourcer(claim),
          runJurisdictionist(claim, entityDescription),
          runDevilsAdvocate(claim),
          runHistorian(claim),
          Promise.resolve(runFirmMemory(claim)),
        ]);

      const score = computeGavelScore(
        sourcer,
        jurisdictionist,
        historian,
        devils_advocate,
        firm_memory
      );

      return { claim, sourcer, jurisdictionist, devils_advocate, historian, firm_memory, score };
    })
  );

  // Step 3: Overall score + trace
  const overall_score = Math.round(
    claimResults.reduce((sum, r) => sum + r.score, 0) / claimResults.length
  );

  return {
    claims: claimResults,
    overall_score,
    reasoning_trace: buildReasoningTrace(claimResults),
  };
}
