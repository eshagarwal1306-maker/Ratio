import { anthropic } from "@ai-sdk/anthropic";
import { ToolLoopAgent, Output, isStepCount } from "ai";
import { checkAmendmentsTool, sparqlQueryTool } from "../tools";
import { HistorianResultSchema, type Claim, type HistorianResult } from "../schemas";

// Agent 4 — The Historian
// Checks the EU Cellar API itself for amendment history and in-force status.
// Also reasons about whether the cited article number matches the current consolidated text.
const historianAgent = new ToolLoopAgent({
  model: anthropic("claude-sonnet-4-6"),
  instructions: `You are a legal currency expert. Your job is to determine whether a cited regulation is current law and whether the cited article number is correct.

You have access to:
- checkAmendments: query EU Cellar for amendment history and in-force status
- sparqlQuery: run custom SPARQL queries against EU Cellar for deeper research

Process:
1. Use checkAmendments to get the real in-force status and amendment list from EU Cellar
2. Reason about whether the article numbering is accurate:
   - DORA (32022R2554) entered into force 17 January 2025
   - Draft versions of DORA had different article numbering than the final OJ text
   - AI models trained on pre-publication drafts may cite wrong article numbers
3. If amendments are found, use sparqlQuery to find more details if needed
4. Produce your structured currency assessment

Be specific about article number discrepancies — this is the key finding for DORA claims.`,
  tools: {
    checkAmendments: checkAmendmentsTool,
    sparqlQuery: sparqlQueryTool,
  },
  output: Output.object({ schema: HistorianResultSchema }),
  stopWhen: isStepCount(4),
});

export async function runHistorian(claim: Claim): Promise<HistorianResult> {
  if (!claim.celex) {
    return {
      status: "UNKNOWN",
      in_force: false,
      amendments: [],
      note: "No CELEX identifier — cannot check amendment history.",
    };
  }

  try {
    const { output } = await historianAgent.generate({
      prompt: `Assess the legal currency of this citation.

REGULATION: ${claim.regulation}
ARTICLE CITED: ${claim.article || "not specified"}
CELEX: ${claim.celex}

Use checkAmendments to get the real in-force status and amendment list from EU Cellar.
Then reason about whether the cited article number reflects the current consolidated text.

Known context: DORA (32022R2554) entered into force 17 January 2025.
Article numbering in the final OJ text differs from pre-publication drafts.

Return:
- status: CURRENT / AMENDED / UNKNOWN
- in_force: boolean
- amendments: list of amending act IDs
- note: 1-2 sentences a lawyer reads to understand the currency situation`,
    });
    return output ?? { status: "UNKNOWN", in_force: false, amendments: [], note: "Could not determine currency." };
  } catch {
    return { status: "UNKNOWN", in_force: false, amendments: [], note: "Historian could not access EU Cellar amendment data." };
  }
}
