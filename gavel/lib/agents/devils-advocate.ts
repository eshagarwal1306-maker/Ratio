import { anthropic } from "@ai-sdk/anthropic";
import { ToolLoopAgent, Output, isStepCount } from "ai";
import { webSearchTool, sparqlQueryTool } from "../tools";
import { DevilsAdvocateResultSchema, type Claim, type DevilsAdvocateResult } from "../schemas";

// Agent 3 — The Devil's Advocate
// Searches for real counter-authorities using Perplexity web search and EU Cellar SPARQL.
const devilsAdvocateAgent = new ToolLoopAgent({
  model: anthropic("claude-sonnet-4-6"),
  instructions: `You are a devil's advocate legal analyst. Your job is to find the STRONGEST real legal counter-argument that undermines the given claim.

You have access to:
- webSearch: search for real cases, EBA/FCA/ECB guidance, regulatory publications, academic commentary
- sparqlQuery: query EU Cellar SPARQL for related EU legislative acts in the same regulatory chain

Strategy:
1. Use webSearch to find cases or regulatory guidance narrowing or qualifying the cited provision
2. Use sparqlQuery if you need to find related EU acts (e.g. sibling regulations, implementing measures)
3. Pick the single strongest counter-authority and return it

CRITICAL: Only cite REAL, verifiable legal instruments found through your research.
Never invent authorities. If you cannot find a strong counter-authority, set strength to "low".`,
  tools: {
    webSearch: webSearchTool,
    sparqlQuery: sparqlQueryTool,
  },
  output: Output.object({ schema: DevilsAdvocateResultSchema }),
  stopWhen: isStepCount(5),
});

export async function runDevilsAdvocate(claim: Claim): Promise<DevilsAdvocateResult> {
  try {
    const { output } = await devilsAdvocateAgent.generate({
      prompt: `Find the strongest real legal counter-argument to this claim.

CLAIM: "${claim.text}"
REGULATION: ${claim.regulation} ${claim.article}

Use webSearch to find:
- Cases that narrow or qualify the cited provision
- EBA/ECB/FCA regulatory guidance giving a different interpretation
- Academic commentary raising legitimate counter-arguments
- Implementing regulations or delegated acts that modify scope

Return the single strongest counter-authority:
- counter_authority: exact name (e.g. "EBA/GL/2019/02 §45", "FSMA 2023 s.12")
- why_it_undermines: clear explanation of the counter-argument
- strength: high / medium / low`,
    });
    return output ?? { counter_authority: "No counter-authority identified", why_it_undermines: "No output generated", strength: "low" };
  } catch {
    return { counter_authority: "Research unavailable", why_it_undermines: "Devil's Advocate could not complete research.", strength: "low" };
  }
}
