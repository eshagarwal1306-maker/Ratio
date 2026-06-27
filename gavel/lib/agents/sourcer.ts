import { anthropic } from "@ai-sdk/anthropic";
import { ToolLoopAgent, Output, isStepCount } from "ai";
import { fetchCellarArticleTool } from "../tools";
import { SourcerResultSchema, type Claim, type SourcerResult } from "../schemas";

// Agent 1 — The Sourcer
// Given a claim, the agent fetches the actual article text from EU Cellar itself
// and compares it against what the AI said.
const sourcerAgent = new ToolLoopAgent({
  model: anthropic("claude-sonnet-4-6"),
  instructions: `You are a legal citation verifier with access to the EU Publications Office Cellar API.

Your job: determine whether an AI-generated claim accurately reflects the actual source text.

Process:
1. Use the fetchCellarArticle tool to retrieve the verbatim article text
2. Compare the AI claim against the actual text carefully
3. Produce your structured verdict

Be precise. Note exact discrepancies. Never guess — if the article text is missing, mark as NOT_FOUND.`,
  tools: { fetchCellarArticle: fetchCellarArticleTool },
  output: Output.object({ schema: SourcerResultSchema }),
  stopWhen: isStepCount(4), // fetch + verify in up to 4 steps
});

export async function runSourcer(claim: Claim): Promise<SourcerResult> {
  try {
    const { output } = await sourcerAgent.generate({
      prompt: `Verify this AI claim against the actual EU regulatory source text.

AI CLAIM: "${claim.text}"
REGULATION: ${claim.regulation}
ARTICLE CITED: ${claim.article || "not specified"}
CELEX: ${claim.celex || "32022R2554"}

Use the fetchCellarArticle tool to get the verbatim text, then assess:
- status: CITED if accurate; INFERRED if paraphrased/extrapolated; NOT_FOUND if unsupported
- match: whether the claim is materially accurate
- discrepancy: what differs (empty if none)
- verbatim_quote: the exact relevant quote from the source`,
    });
    return output ?? { status: "NOT_FOUND", match: false, discrepancy: "No output generated", verbatim_quote: "" };
  } catch {
    return { status: "INFERRED", match: false, discrepancy: "Sourcer could not verify — treating as inferred.", verbatim_quote: "" };
  }
}
