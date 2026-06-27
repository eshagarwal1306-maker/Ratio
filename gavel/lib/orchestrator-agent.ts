// GAVEL Orchestrator — Claude Opus as pure agentic brain
// Singleton ToolLoopAgent used with createAgentUIStreamResponse for streaming UI.
// Opus decides what to call, when, and why — no fixed workflow.

import { anthropic } from "@ai-sdk/anthropic";
import { ToolLoopAgent, tool, isStepCount } from "ai";
import { z } from "zod";
import { extractClaims } from "./claim-extractor";
import { runSourcer } from "./agents/sourcer";
import { runJurisdictionist } from "./agents/jurisdictionist";
import { runDevilsAdvocate } from "./agents/devils-advocate";
import { runHistorian } from "./agents/historian";
import { runFirmMemory } from "./agents/firm-memory";
import { runScraper } from "./agents/scraper";
import { computeGavelScore } from "./scorer";
import {
  ClaimSchema,
  SourcerResultSchema,
  JurisdictionistResultSchema,
  DevilsAdvocateResultSchema,
  HistorianResultSchema,
  FirmMemoryResultSchema,
} from "./schemas";

export const gravelOrchestrator = new ToolLoopAgent({
  model: anthropic("claude-opus-4-8"),
  providerOptions: {
    anthropic: {
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
    },
  },
  instructions: `You are GAVEL's orchestrator — the intelligent brain coordinating a legal AI reasoning audit.

You have specialist sub-agents as tools. You decide what to call, when, and in what order — based on your judgment about each claim.

YOUR TOOLS:
- extractClaims: parse the document into structured legal claims (ALWAYS call this first)
- runSourcer: verify a citation against EU Cellar primary source text
- runJurisdictionist: check if the regulation actually applies to the entity — CRITICAL for UK firms post-Brexit
- runHistorian: check if the cited regulation is current law and if article numbers are correct
- runDevilsAdvocate: find real counter-authorities via Bailii case law search and web scraping
- runFirmMemory: check for contradictions with the firm's past legal positions
- deepResearch: ScraperAgent — searches Bailii, scrapes EBA docs, scrapes specific URLs. Use when you want REAL case law
- reportClaim: commit your completed audit for one claim — MUST call for every claim you analyse

HOW TO REASON:
1. Call extractClaims first
2. For each claim, think about what the highest-value checks are:
   - UK entity + EU regulation → runJurisdictionist FIRST (could be fatal WRONG_JURISDICTION)
   - Specific article cited → runSourcer to get verbatim text
   - Known CELEX → runHistorian (DORA article numbers changed between draft and final OJ)
   - Substantive legal argument → runDevilsAdvocate
   - Case name mentioned → deepResearch to find it on Bailii
   - Always → runFirmMemory
3. Call deepResearch proactively if the claim needs real precedent backing, not just your training knowledge
4. Once you have enough evidence, call reportClaim — it commits the structured result and computes the score
5. After all claims, write a brief summary of your most important findings

JUDGMENT NOTES:
- WRONG_JURISDICTION is a fatal finding — flag it prominently in your summary
- NOT_FOUND from Sourcer means the claim has no evidentiary basis
- Use deepResearch aggressively — real Bailii case law is more credible than your training knowledge
- Don't skip agents mechanically; think about what each claim actually needs`,

  tools: {
    extractClaims: tool({
      description: "Parse the document into structured legal claims. Always call first.",
      inputSchema: z.object({ documentText: z.string() }),
      execute: async ({ documentText }) => {
        const claims = await extractClaims(documentText);
        return { claims, count: claims.length };
      },
    }),

    runSourcer: tool({
      description:
        "Fetch verbatim article text from EU Cellar and compare against the AI claim. Returns CITED / INFERRED / NOT_FOUND.",
      inputSchema: z.object({ claim: ClaimSchema }),
      execute: async ({ claim }) => runSourcer(claim),
    }),

    runJurisdictionist: tool({
      description:
        "Check if the regulation applies to the entity — fetches scope article from EU Cellar. Returns APPLICABLE / WRONG_JURISDICTION / UNCLEAR. Critical for UK firms.",
      inputSchema: z.object({ claim: ClaimSchema, entityDescription: z.string() }),
      execute: async ({ claim, entityDescription }) =>
        runJurisdictionist(claim, entityDescription),
    }),

    runHistorian: tool({
      description:
        "Query EU Cellar SPARQL for amendment history. Catches outdated article numbers — DORA final OJ differs from drafts.",
      inputSchema: z.object({ claim: ClaimSchema }),
      execute: async ({ claim }) => runHistorian(claim),
    }),

    runDevilsAdvocate: tool({
      description:
        "Find real counter-authorities via Bailii + web search. Returns counter_authority, why_it_undermines, strength.",
      inputSchema: z.object({ claim: ClaimSchema }),
      execute: async ({ claim }) => {
        const timeout = AbortSignal.timeout(25_000);
        return Promise.race([
          runDevilsAdvocate(claim),
          new Promise<{ counter_authority: string; why_it_undermines: string; strength: "low" }>(
            (resolve) => timeout.addEventListener("abort", () =>
              resolve({ counter_authority: "Timeout", why_it_undermines: "Devil's Advocate timed out after 25s — Bailii/Firecrawl too slow.", strength: "low" })
            )
          ),
        ]);
      },
    }),

    runFirmMemory: tool({
      description:
        "Check for contradictions with the firm's past legal positions. Returns any conflict with matter reference.",
      inputSchema: z.object({ claim: ClaimSchema }),
      execute: ({ claim }) => Promise.resolve(runFirmMemory(claim)),
    }),

    deepResearch: tool({
      description:
        "ScraperAgent: searches Bailii for case law, scrapes EBA/ECB documents, scrapes any URL via Firecrawl. Use for real precedents.",
      inputSchema: z.object({
        task: z.string().describe(
          "Specific research task e.g. 'Find UK cases on DORA territorial scope' or 'Scrape EBA/GL/2019/02'"
        ),
      }),
      execute: async ({ task }) => {
        const timeout = AbortSignal.timeout(30_000);
        return Promise.race([
          runScraper(task),
          new Promise<string>((resolve) =>
            timeout.addEventListener("abort", () =>
              resolve("Deep research timed out after 30s — Firecrawl unavailable or too slow.")
            )
          ),
        ]);
      },
    }),

    reportClaim: tool({
      description:
        "Commit the completed audit for one claim. Computes the GAVEL score. MUST call once per claim after gathering evidence.",
      inputSchema: z.object({
        claim: ClaimSchema,
        sourcer: SourcerResultSchema,
        jurisdictionist: JurisdictionistResultSchema,
        historian: HistorianResultSchema,
        devils_advocate: DevilsAdvocateResultSchema,
        firm_memory: FirmMemoryResultSchema,
        orchestrator_reasoning: z.string().describe(
          "Your 1-2 sentence reasoning: what you found notable, which agents you prioritised and why"
        ),
      }),
      execute: async ({
        claim, sourcer, jurisdictionist, historian, devils_advocate, firm_memory, orchestrator_reasoning,
      }) => {
        const score = computeGavelScore(sourcer, jurisdictionist, historian, devils_advocate, firm_memory);
        return { claim, sourcer, jurisdictionist, historian, devils_advocate, firm_memory, score, orchestrator_reasoning };
      },
    }),
  },

  stopWhen: isStepCount(50),
});
