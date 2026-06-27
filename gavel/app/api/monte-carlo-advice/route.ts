import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import type { ClaimResult } from "@/lib/types";

export const maxDuration = 60;

const AdviceSchema = z.object({
  summary: z.string(),
  flagged_areas: z.array(z.object({
    claim_snippet: z.string(),
    issue: z.string(),
    suggestion: z.string(),
    recommended_sources: z.array(z.string()),
  })),
  overall_recommendation: z.string(),
});

export async function POST(req: Request) {
  const { claimResults, meanScore }: { claimResults: ClaimResult[]; meanScore: number } = await req.json();

  const claimSummary = claimResults.map((r, i) =>
    `Claim ${i + 1} (score: ${r.score}/100):\n` +
    `  Text: "${r.claim.text.slice(0, 150)}"\n` +
    `  Regulation: ${r.claim.regulation} ${r.claim.article}\n` +
    `  Citation status: ${r.sourcer.status}\n` +
    `  Jurisdiction: ${r.jurisdictionist.status} (${r.jurisdictionist.confidence}% confidence)\n` +
    `  Historian: ${r.historian.status} — ${r.historian.note}\n` +
    `  Counter-authority strength: ${r.devils_advocate.strength}\n` +
    `  Firm memory: ${r.firm_memory.status}`
  ).join("\n\n");

  const result = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: AdviceSchema,
    prompt: `You are a senior legal reviewer analysing the output of an AI verification audit. The Monte Carlo simulation produced a mean RATIO score of ${meanScore.toFixed(1)}/100, indicating the legal document needs strengthening.

Review these claim analysis results and provide actionable guidance for the lawyer:

${claimSummary}

For each problematic claim (score < 70 or issues detected):
1. Identify the specific problem (wrong jurisdiction, missing citation, outdated law, strong counter-authority, etc.)
2. Suggest how to fix it
3. Recommend specific sources the lawyer should look up (real legislation, case law, EBA guidelines etc.)

Be specific with your recommended sources — name actual regulations with article numbers, real court cases with citations, or real regulatory documents by name.`,
  });

  return Response.json(result.object);
}
