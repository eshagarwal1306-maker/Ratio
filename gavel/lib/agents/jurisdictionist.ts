import { anthropic } from "@ai-sdk/anthropic";
import { ToolLoopAgent, Output, isStepCount } from "ai";
import { fetchCellarArticleTool } from "../tools";
import { JurisdictionistResultSchema, type Claim, type JurisdictionistResult } from "../schemas";

// Agent 2 — The Jurisdictionist
// Fetches the actual scope provision from the regulation and determines whether
// the entity is inside or outside scope. Post-Brexit UK-only firms are the key demo case.
const jurisdictionistAgent = new ToolLoopAgent({
  model: anthropic("claude-sonnet-4-6"),
  instructions: `You are a jurisdiction specialist with deep expertise in EU regulatory scope.

Your job: determine whether the cited regulation actually applies to the described entity.

Process:
1. Use fetchCellarArticle to retrieve Article 2 (scope) of the cited regulation
2. Analyse whether the entity matches any listed category of in-scope entities
3. Pay particular attention to post-Brexit applicability:
   - Post-Brexit, UK-incorporated entities are NOT EU-regulated entities
   - UK firms need a separate EU authorisation or EU branch/subsidiary to be in scope
   - UK-only operations with no EU establishment = OUTSIDE DORA scope
4. Produce your structured jurisdiction verdict

Be decisive. A wrong jurisdiction finding is the most important finding GAVEL makes.`,
  tools: { fetchCellarArticle: fetchCellarArticleTool },
  output: Output.object({ schema: JurisdictionistResultSchema }),
  stopWhen: isStepCount(4),
});

export async function runJurisdictionist(
  claim: Claim,
  entityDescription: string
): Promise<JurisdictionistResult> {
  try {
    const { output } = await jurisdictionistAgent.generate({
      prompt: `Assess whether ${claim.regulation} applies to this entity.

ENTITY: ${entityDescription}
REGULATION CLAIMED TO APPLY: ${claim.regulation} ${claim.article}
JURISDICTION STATED IN CLAIM: ${claim.jurisdiction}
CELEX: ${claim.celex || "32022R2554"}

Use fetchCellarArticle to get the scope/application article (Article 2 for DORA), then determine:
- status: APPLICABLE / WRONG_JURISDICTION / UNCLEAR
- confidence: 0-100
- reason: plain English explanation a partner would understand
- article_reference: the scope provision that determines applicability`,
    });
    return output ?? { status: "UNCLEAR", confidence: 0, reason: "No output generated", article_reference: "" };
  } catch {
    return { status: "UNCLEAR", confidence: 0, reason: "Jurisdictionist could not complete analysis.", article_reference: "" };
  }
}
