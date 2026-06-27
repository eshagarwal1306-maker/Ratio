import { anthropic } from "@ai-sdk/anthropic";
import { ToolLoopAgent, Output, isStepCount } from "ai";
import { checkAmendmentsTool, sparqlQueryTool } from "../tools";
import { HistorianResultSchema, type Claim, type HistorianResult } from "../schemas";

// ── EU Cellar historian (for EU regulations with CELEX) ───────────────────────

const euHistorianAgent = new ToolLoopAgent({
  model: anthropic("claude-sonnet-4-6"),
  instructions: `You are a legal currency expert specialising in EU legislation. Your job: determine whether a cited EU regulation is current law and whether the cited article number is correct in the consolidated text.

You have access to:
- checkAmendments: query EU Cellar for amendment history and in-force status
- sparqlQuery: run custom SPARQL queries for deeper research

Process:
1. Use checkAmendments to get the real in-force status and amendment history from EU Cellar
2. Reason about article numbering accuracy:
   - DORA (32022R2554) entered into force 17 January 2025
   - AI models trained on pre-publication drafts may cite wrong article numbers
   - Check whether the cited article exists in the current consolidated text
3. Return your structured currency assessment

Be specific about article number discrepancies — this is a key finding for EU regulatory claims.`,
  tools: {
    checkAmendments: checkAmendmentsTool,
    sparqlQuery: sparqlQueryTool,
  },
  output: Output.object({ schema: HistorianResultSchema }),
  stopWhen: isStepCount(4),
});

// ── Training-knowledge historian (for UK domestic statutes) ───────────────────

const ukHistorianAgent = new ToolLoopAgent({
  model: anthropic("claude-sonnet-4-6"),
  instructions: `You are a legal currency expert specialising in UK domestic legislation. Your job: determine whether the cited UK statute is current law, and whether the cited section number is correct.

Use your deep knowledge of UK statutes including:
- Copyright, Designs and Patents Act 1988 (CDPA) — current; amended by various SIs; in force
- Patents Act 1977 — current; amended; in force
- Trade Marks Act 1994 — current; in force
- Companies Act 2006 — current; in force
- Financial Services and Markets Act 2000 (FSMA) — current; substantially amended by FSMA 2023
- Employment Rights Act 1996 — current; in force
- Consumer Rights Act 2015 — current; in force

Return:
- status: CURRENT if the statute and section are current and accurate
- status: AMENDED if the section has been materially amended or renumbered
- status: UNKNOWN only if you genuinely cannot determine the currency
- in_force: boolean
- amendments: list of key amending instruments (by name/year, not CELEX)
- note: 1-2 sentences explaining the currency situation`,
  tools: {},
  output: Output.object({ schema: HistorianResultSchema }),
  stopWhen: isStepCount(2),
});

// ── Main export ───────────────────────────────────────────────────────────────

export async function runHistorian(claim: Claim): Promise<HistorianResult> {
  // ── EU regulation with CELEX: use live EU Cellar ─────────────────────────
  if (claim.celex) {
    try {
      const { output } = await euHistorianAgent.generate({
        prompt: `Assess the legal currency of this EU regulatory citation.

REGULATION: ${claim.regulation}
ARTICLE CITED: ${claim.article || "not specified"}
CELEX: ${claim.celex}

Use checkAmendments to get the real in-force status and amendment history.
Then reason about whether the cited article number reflects the current consolidated text.

Known context: DORA (32022R2554) entered into force 17 January 2025.
Article numbering in the final OJ text may differ from pre-publication drafts.

Return:
- status: CURRENT / AMENDED / UNKNOWN
- in_force: boolean
- amendments: list of amending act CELEX IDs
- note: 1-2 sentences a lawyer reads to understand the currency situation`,
      });
      return output ?? {
        status: "UNKNOWN",
        in_force: false,
        amendments: [],
        note: "Could not determine currency.",
      };
    } catch {
      return {
        status: "UNKNOWN",
        in_force: false,
        amendments: [],
        note: "Historian could not access EU Cellar amendment data.",
      };
    }
  }

  // ── UK domestic statute (no CELEX): use training knowledge ───────────────
  try {
    const { output } = await ukHistorianAgent.generate({
      prompt: `Assess the legal currency of this UK statutory citation.

REGULATION: ${claim.regulation}
SECTION CITED: ${claim.article || "not specified"}

This is a UK domestic statute. Use your knowledge of UK law to:
1. Confirm whether this statute is current law and in force
2. Identify whether the cited section has been amended or renumbered
3. Note any significant amendments that affect the cited provision

Return:
- status: CURRENT (statute and section are accurate and current) / AMENDED (section materially changed) / UNKNOWN
- in_force: boolean (almost always true for major UK statutes unless repealed)
- amendments: list of significant amending instruments by name
- note: plain English summary of the currency and accuracy of the citation`,
    });
    return output ?? {
      status: "UNKNOWN",
      in_force: false,
      amendments: [],
      note: "Could not assess currency of this UK statute.",
    };
  } catch {
    return {
      status: "UNKNOWN",
      in_force: false,
      amendments: [],
      note: "Historian could not assess currency of this UK statutory reference.",
    };
  }
}
