import { anthropic } from "@ai-sdk/anthropic";
import { ToolLoopAgent, Output, isStepCount, tool } from "ai";
import { z } from "zod";
import { webSearchTool, sparqlQueryTool } from "../tools";
import { scraperAgent } from "./scraper";
import { DevilsAdvocateResultSchema, type Claim, type DevilsAdvocateResult } from "../schemas";

// Subagent tool: delegates deep case law research to the ScraperAgent
// The ScraperAgent searches Bailii and web sources, returns a summary
const researchCaseLawTool = tool({
  description:
    "Research real case law and legal authorities on Bailii and the web. Use this to find actual precedents, EBA guidelines, ECJ decisions, or academic commentary that counter or qualify the claim. Returns a summary of what was found.",
  inputSchema: z.object({
    task: z
      .string()
      .describe(
        "Research task, e.g. 'Find UK and EU cases narrowing DORA ICT sub-outsourcing scope' or 'Find EBA guidelines that define ICT outsourcing more narrowly than DORA Article 30'"
      ),
  }),
  execute: async ({ task }, { abortSignal }) => {
    const result = await scraperAgent.generate({ prompt: task, abortSignal });
    return result.text;
  },
});

// Agent 3 — The Devil's Advocate
// Actively searches Bailii, web sources, and EU Cellar for counter-authorities.
// The ScraperAgent does the heavy Bailii/Firecrawl work; this agent decides what to search for.
const devilsAdvocateAgent = new ToolLoopAgent({
  model: anthropic("claude-sonnet-4-6"),
  instructions: `You are a devil's advocate legal analyst. Your job is to find the STRONGEST real legal counter-argument that undermines the given claim.

You have access to:
- researchCaseLaw: delegates to a specialist scraper that searches Bailii (UK/EU case law), EBA guidelines, and legal commentary
- webSearch: direct web search for legal sources
- sparqlQuery: query EU Cellar SPARQL for related EU legislative acts

Strategy:
1. Use researchCaseLaw to search Bailii for relevant cases or guidelines
2. Use webSearch for regulatory guidance, EBA/ECB publications, or academic views
3. Use sparqlQuery if you need to find related EU acts in the legislative chain

CRITICAL: Only cite REAL, verifiable legal instruments found through your research.
Never invent authorities. If you cannot find a strong counter-authority, set strength to "low".`,
  tools: {
    researchCaseLaw: researchCaseLawTool,
    webSearch: webSearchTool,
    sparqlQuery: sparqlQueryTool,
  },
  output: Output.object({ schema: DevilsAdvocateResultSchema }),
  stopWhen: isStepCount(6),
});

export async function runDevilsAdvocate(claim: Claim): Promise<DevilsAdvocateResult> {
  try {
    const { output } = await devilsAdvocateAgent.generate({
      prompt: `Find the strongest real legal counter-argument to this claim.

CLAIM: "${claim.text}"
REGULATION: ${claim.regulation} ${claim.article}

Research using researchCaseLaw and webSearch to find:
- Cases that narrow or qualify the cited provision
- Regulatory guidance that gives a different interpretation
- EBA/ECB/FCA guidance that qualifies the scope
- Academic commentary raising legitimate counter-arguments

Return the single strongest counter-authority:
- counter_authority: exact name (e.g. "EBA/GL/2019/02 §45", "Sullivan & Cromwell [2024] EWHC 123")
- why_it_undermines: clear explanation of the counter-argument
- strength: high / medium / low`,
    });
    return output ?? { counter_authority: "No counter-authority identified", why_it_undermines: "No output generated", strength: "low" };
  } catch {
    return { counter_authority: "Research unavailable", why_it_undermines: "Devil's Advocate could not complete research.", strength: "low" };
  }
}
