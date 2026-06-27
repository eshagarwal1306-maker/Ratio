// GAVEL Orchestrator — parallel-agent legal audit
// Uses Sonnet for fast orchestration; calls all 5 specialist agents simultaneously per claim.

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
  model: anthropic("claude-sonnet-4-6"),
  instructions: `You are GAVEL's orchestrator — an AI legal citation auditor.

SPEED IS CRITICAL. You must audit claims as fast as possible. Follow this exact workflow:

STEP 1: Call extractClaims once to get the list of claims (already capped to the 8 most important).

STEP 2: For EVERY claim, call ALL FIVE agents in a single step — put all five tool calls in one response:
  - runSourcer
  - runJurisdictionist
  - runHistorian
  - runDevilsAdvocate
  - runFirmMemory
DO NOT call them one at a time. Call ALL FIVE simultaneously for each claim.

STEP 3: Once you have all five results for a claim, call reportClaim immediately.

STEP 4: Repeat Steps 2-3 for the next claim (you can also batch multiple claims together).

RULES:
- Never call just one or two agents and wait — always batch all five at once
- Skip deepResearch unless a claim explicitly names a court case (saves time)
- After all reportClaim calls, write a one-sentence summary of the most critical finding`,

  tools: {
    extractClaims: tool({
      description: "Parse the document into structured legal claims (capped at 8 most important). Always call first.",
      inputSchema: z.object({ documentText: z.string() }),
      execute: async ({ documentText }) => {
        const claims = await extractClaims(documentText);
        return { claims, count: claims.length };
      },
    }),

    runSourcer: tool({
      description:
        "Fetch verbatim article text from EU Cellar and compare against the claim. Returns CITED / INFERRED / NOT_FOUND.",
      inputSchema: z.object({ claim: ClaimSchema }),
      execute: async ({ claim }) => runSourcer(claim),
    }),

    runJurisdictionist: tool({
      description:
        "Check if the regulation applies to the entity — CRITICAL for UK firms post-Brexit. Returns APPLICABLE / WRONG_JURISDICTION / UNCLEAR.",
      inputSchema: z.object({ claim: ClaimSchema, entityDescription: z.string() }),
      execute: async ({ claim, entityDescription }) =>
        runJurisdictionist(claim, entityDescription),
    }),

    runHistorian: tool({
      description:
        "Check amendment history — catches outdated article numbers. Returns CURRENT / AMENDED / UNKNOWN.",
      inputSchema: z.object({ claim: ClaimSchema }),
      execute: async ({ claim }) => runHistorian(claim),
    }),

    runDevilsAdvocate: tool({
      description:
        "Find counter-authorities. Returns counter_authority, why_it_undermines, strength (high/medium/low).",
      inputSchema: z.object({ claim: ClaimSchema }),
      execute: async ({ claim }) => {
        const timeout = AbortSignal.timeout(20_000);
        return Promise.race([
          runDevilsAdvocate(claim),
          new Promise<{ counter_authority: string; why_it_undermines: string; strength: "low" }>(
            (resolve) => timeout.addEventListener("abort", () =>
              resolve({ counter_authority: "Timeout", why_it_undermines: "Devil's Advocate timed out — Bailii unavailable.", strength: "low" })
            )
          ),
        ]);
      },
    }),

    runFirmMemory: tool({
      description:
        "Check for contradictions with the firm's past legal positions. Returns CONTRADICTION_FOUND / NO_CONFLICT.",
      inputSchema: z.object({ claim: ClaimSchema }),
      execute: ({ claim }) => Promise.resolve(runFirmMemory(claim)),
    }),

    deepResearch: tool({
      description:
        "Use ONLY when a claim names a specific court case. Searches Bailii for real precedents.",
      inputSchema: z.object({
        task: z.string().describe("Specific research task, e.g. 'Find Lloyds v HMRC on jurisdiction'"),
      }),
      execute: async ({ task }) => {
        const timeout = AbortSignal.timeout(25_000);
        return Promise.race([
          runScraper(task),
          new Promise<string>((resolve) =>
            timeout.addEventListener("abort", () =>
              resolve("Deep research timed out after 25s.")
            )
          ),
        ]);
      },
    }),

    reportClaim: tool({
      description:
        "Commit the completed audit for one claim. Computes GAVEL score. MUST call once per claim after gathering all five agent results.",
      inputSchema: z.object({
        claim: ClaimSchema,
        sourcer: SourcerResultSchema,
        jurisdictionist: JurisdictionistResultSchema,
        historian: HistorianResultSchema,
        devils_advocate: DevilsAdvocateResultSchema,
        firm_memory: FirmMemoryResultSchema,
        orchestrator_reasoning: z.string().describe(
          "One sentence: your key finding for this claim."
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

  stopWhen: isStepCount(60),
});
