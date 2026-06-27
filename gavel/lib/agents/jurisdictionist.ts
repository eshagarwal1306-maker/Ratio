import { anthropic } from "@ai-sdk/anthropic";
import { ToolLoopAgent, Output, isStepCount } from "ai";
import { fetchCellarArticleTool } from "../tools";
import { JurisdictionistResultSchema, type Claim, type JurisdictionistResult } from "../schemas";

// ── Regulation type classifier ────────────────────────────────────────────────

type RegType = "eu_regulation" | "uk_statute" | "eu_directive_post_brexit" | "other";

function classifyRegulation(claim: Claim): RegType {
  const reg = claim.regulation.toLowerCase();
  // EU Regulations have a CELEX number and the regulation itself is NOT a Directive
  if (claim.celex && !reg.includes("directive")) return "eu_regulation";
  // EU Directives post-Brexit: entity in UK cannot rely on directive directly
  if (reg.includes("directive") && claim.celex) return "eu_directive_post_brexit";
  // UK domestic statutes: contain "Act" + a year, or known UK statute names
  const ukMarkers = ["act 19", "act 20", "cdpa", "fsma", "companies act", "patents act",
    "trade marks act", "copyright act", "employment", "contract act", "sale of goods",
    "limitation act", "data protection act"];
  if (ukMarkers.some((m) => reg.includes(m)) || /act\s+(19|20)\d{2}/.test(reg)) return "uk_statute";
  // EU regulation by name even without CELEX
  const euMarkers = ["dora", "gdpr", "mifid", "aifmd", "ucits", "priips", "emir", "sfdr", "csrd"];
  if (euMarkers.some((m) => reg.includes(m))) return "eu_regulation";
  return "other";
}

// ── Agent (for EU regulations only) ──────────────────────────────────────────

const jurisdictionistAgent = new ToolLoopAgent({
  model: anthropic("claude-sonnet-4-6"),
  instructions: `You are a jurisdiction specialist with deep expertise in EU regulatory scope and post-Brexit applicability.

Your job: determine whether the cited EU regulation actually applies to the described entity.

Process:
1. Use fetchCellarArticle to retrieve the scope article (usually Article 2) of the cited regulation
2. Analyse whether the entity matches any listed category of in-scope entities
3. Apply post-Brexit analysis for UK entities:
   - Post-Brexit, UK-incorporated entities are NOT EU-regulated entities unless they hold EU authorisation
   - UK firms need a separate EU authorisation or EU branch/subsidiary to be in-scope for EU regulations
   - UK-only operations with no EU establishment = OUTSIDE scope of EU regulations like DORA, EMIR, etc.
4. Return your structured verdict

Be decisive. A wrong jurisdiction finding is the most important finding GAVEL makes.`,
  tools: { fetchCellarArticle: fetchCellarArticleTool },
  output: Output.object({ schema: JurisdictionistResultSchema }),
  stopWhen: isStepCount(4),
});

// ── Main export ───────────────────────────────────────────────────────────────

export async function runJurisdictionist(
  claim: Claim,
  entityDescription: string
): Promise<JurisdictionistResult> {
  const regType = classifyRegulation(claim);
  const entityLower = entityDescription.toLowerCase();

  // ── UK domestic statutes ──────────────────────────────────────────────────
  // These apply by territorial effect to UK entities — no EU Cellar lookup needed.
  if (regType === "uk_statute") {
    const entityIsUK = ["uk", "united kingdom", "england", "wales", "scotland", "northern ireland",
      "british", "english", "welsh", "scottish"].some((k) => entityLower.includes(k));
    // If entity is clearly UK-based, or no description given, the statute applies
    if (entityIsUK || !entityDescription.trim()) {
      return {
        status: "APPLICABLE",
        confidence: 93,
        reason: `${claim.regulation} is a UK domestic statute. ${entityIsUK ? "The entity is UK-based and" : "UK legislation"} falls within its territorial scope by default.`,
        article_reference: "Territorial scope — UK domestic legislation",
      };
    }
    // Non-UK entity + UK statute: probably not applicable
    return {
      status: "WRONG_JURISDICTION",
      confidence: 80,
      reason: `${claim.regulation} is a UK domestic statute but the entity does not appear to be UK-based. UK law typically requires a sufficient connection to the UK to apply.`,
      article_reference: "Territorial scope — UK domestic legislation",
    };
  }

  // ── EU Directives post-Brexit ─────────────────────────────────────────────
  // Directives don't directly apply in the UK post-Brexit; UK has retained equivalents.
  if (regType === "eu_directive_post_brexit") {
    const entityIsUKOnly = ["uk-only", "uk only", "uk firm", "no eu", "no european",
      "outside the eu", "post-brexit", "post brexit"].some((k) => entityLower.includes(k));
    if (entityIsUKOnly) {
      return {
        status: "WRONG_JURISDICTION",
        confidence: 85,
        reason: `${claim.regulation} is an EU Directive that no longer has direct effect in the UK post-Brexit. The UK implemented equivalent provisions domestically. The entity should rely on the UK implementation (e.g. via CDPA or UK SI) rather than the Directive itself.`,
        article_reference: "Post-Brexit — EU Directive inapplicable directly in UK",
      };
    }
    return {
      status: "UNCLEAR",
      confidence: 60,
      reason: `${claim.regulation} is an EU Directive. Post-Brexit it no longer applies directly in the UK, but the UK has retained equivalent domestic provisions. Whether the EU Directive itself or only the UK implementation applies depends on the entity's EU establishment status.`,
      article_reference: "Post-Brexit jurisdictional analysis required",
    };
  }

  // ── EU regulations: use LLM agent with EU Cellar lookup ──────────────────
  try {
    const { output } = await jurisdictionistAgent.generate({
      prompt: `Assess whether ${claim.regulation} applies to this entity.

ENTITY: ${entityDescription || "Not specified — assume a typical commercial entity"}
REGULATION: ${claim.regulation} ${claim.article}
STATED JURISDICTION: ${claim.jurisdiction}
CELEX: ${claim.celex}

Use fetchCellarArticle to retrieve the scope provision (Article 2 for most EU regulations), then determine:
- status: APPLICABLE / WRONG_JURISDICTION / UNCLEAR
- confidence: 0–100
- reason: plain English explanation a partner would understand, mentioning the specific scope article
- article_reference: the exact scope provision (e.g. "Article 2(1) DORA")

Remember: UK-only entities with no EU establishment are outside scope of EU regulations post-Brexit.`,
    });
    return output ?? {
      status: "UNCLEAR",
      confidence: 0,
      reason: "Jurisdictionist produced no output.",
      article_reference: "",
    };
  } catch {
    return {
      status: "UNCLEAR",
      confidence: 0,
      reason: "Jurisdictionist could not complete analysis.",
      article_reference: "",
    };
  }
}
