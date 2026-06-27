import { anthropic } from "@ai-sdk/anthropic";
import { ToolLoopAgent, Output, isStepCount } from "ai";
import { fetchCellarArticleTool } from "../tools";
import { SourcerResultSchema, type Claim, type SourcerResult } from "../schemas";

// ── Detect whether EU Cellar can source this regulation ──────────────────────

function isEUCellarSourceable(claim: Claim): boolean {
  if (claim.celex) return true; // Has CELEX = EU publication
  const reg = claim.regulation.toLowerCase();
  const euMarkers = ["dora", "gdpr", "mifid", "aifmd", "ucits", "priips", "emir", "sfdr", "csrd",
    "regulation (eu)", "directive (eu)", "eu regulation", "eu directive"];
  return euMarkers.some((m) => reg.includes(m));
}

// ── EU Cellar sourcer (for EU regulations only) ───────────────────────────────

const euSourcerAgent = new ToolLoopAgent({
  model: anthropic("claude-sonnet-4-6"),
  instructions: `You are a legal citation verifier with access to the EU Publications Office Cellar API.

Your job: determine whether an AI-generated claim accurately reflects the actual EU source text.

Process:
1. Use fetchCellarArticle to retrieve the verbatim article text from EU Cellar
2. Compare the AI claim against the actual text carefully
3. Return your structured verdict

Be precise. Note exact discrepancies. If the article cannot be fetched, mark as NOT_FOUND.
Never mark something as CITED unless you have verified it verbatim against the source.`,
  tools: { fetchCellarArticle: fetchCellarArticleTool },
  output: Output.object({ schema: SourcerResultSchema }),
  stopWhen: isStepCount(4),
});

// ── Training-knowledge sourcer (for UK domestic law and non-EU sources) ───────

const knowledgeSourcerAgent = new ToolLoopAgent({
  model: anthropic("claude-sonnet-4-6"),
  instructions: `You are an expert legal citation verifier specialising in UK domestic legislation.

Your job: verify whether an AI-generated claim accurately reflects the cited UK statute or regulation.

You cannot access EU Cellar for UK domestic law — instead use your deep knowledge of UK statutes including:
- Copyright, Designs and Patents Act 1988 (CDPA)
- Patents Act 1977
- Trade Marks Act 1994
- Companies Act 2006
- Financial Services and Markets Act 2000 (FSMA)
- Employment Rights Act 1996
- Sale of Goods Act 1979
- And other UK primary and secondary legislation

Process:
1. Recall the exact text of the cited section from the UK statute
2. Compare it carefully to the claim
3. Return your structured verdict

Verdicts:
- CITED: the claim accurately restates the statutory text (verbatim or near-verbatim)
- INFERRED: the claim is a reasonable but paraphrased/extrapolated interpretation of the statute
- NOT_FOUND: the cited provision does not exist or the claim materially misrepresents the statute`,
  tools: {},
  output: Output.object({ schema: SourcerResultSchema }),
  stopWhen: isStepCount(2),
});

// ── Main export ───────────────────────────────────────────────────────────────

export async function runSourcer(claim: Claim): Promise<SourcerResult> {
  if (isEUCellarSourceable(claim)) {
    // ── EU regulation: use live EU Cellar fetch ──────────────────────────────
    try {
      const { output } = await euSourcerAgent.generate({
        prompt: `Verify this AI claim against the actual EU regulatory source text.

AI CLAIM: "${claim.text}"
REGULATION: ${claim.regulation}
ARTICLE CITED: ${claim.article || "not specified"}
CELEX: ${claim.celex}

Use fetchCellarArticle to get the verbatim text, then assess:
- status: CITED if accurate; INFERRED if paraphrased; NOT_FOUND if unsupported or article is missing
- match: whether the claim is materially accurate
- discrepancy: what differs (empty string if none)
- verbatim_quote: the exact relevant quote from the source (empty string if not found)`,
      });
      return output ?? {
        status: "NOT_FOUND",
        match: false,
        discrepancy: "No output generated",
        verbatim_quote: "",
      };
    } catch {
      return {
        status: "INFERRED",
        match: false,
        discrepancy: "Sourcer could not access EU Cellar — treating as inferred.",
        verbatim_quote: "",
      };
    }
  } else {
    // ── UK domestic statute or non-EU source: use training knowledge ─────────
    try {
      const { output } = await knowledgeSourcerAgent.generate({
        prompt: `Verify this legal claim against the cited UK statute using your knowledge of the law.

AI CLAIM: "${claim.text}"
REGULATION: ${claim.regulation}
SECTION CITED: ${claim.article || "not specified"}

This is a UK domestic statute, not an EU regulation. Use your knowledge of ${claim.regulation} to:
1. Recall what ${claim.article || "this provision"} actually says
2. Compare it to the claim
3. Assess accuracy

Return:
- status: CITED if accurate / INFERRED if paraphrased / NOT_FOUND if the provision doesn't exist or is materially wrong
- match: boolean
- discrepancy: any difference between the claim and the actual statutory text
- verbatim_quote: the actual statutory text from your knowledge (or empty string if uncertain)`,
      });
      return output ?? {
        status: "INFERRED",
        match: false,
        discrepancy: "Could not verify UK statute from training knowledge",
        verbatim_quote: "",
      };
    } catch {
      return {
        status: "INFERRED",
        match: false,
        discrepancy: "Sourcer could not verify this UK statutory reference — treating as inferred.",
        verbatim_quote: "",
      };
    }
  }
}
