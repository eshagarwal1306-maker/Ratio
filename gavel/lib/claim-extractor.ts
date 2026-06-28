import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { z } from "zod";
import { ClaimSchema, type Claim } from "./schemas";

const MAX_CLAIMS = 3;

export async function extractClaims(documentText: string): Promise<Claim[]> {
  const { output } = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    output: Output.array({ element: ClaimSchema }),
    instructions:
      "You are a legal document analyst. Extract the most legally significant verifiable claims from the document — statements that cite a specific law, regulation, article, or case as authority.",
    prompt: `Extract the ${MAX_CLAIMS} most legally significant verifiable claims from this document. Only ${MAX_CLAIMS} — pick the highest-risk ones.

A legal claim = a statement citing a specific law, regulation, or case as authority.

PRIORITY ORDER (extract the highest-risk claims first):
1. Claims that may have jurisdiction issues (UK firm citing EU-only law)
2. Claims citing specific article numbers that may be wrong
3. Claims about regulatory deadlines or penalties
4. Claims about specific obligations or prohibitions
5. General regulatory references

Return AT MOST ${MAX_CLAIMS} claims — the ones most worth verifying.

For each claim:
- text: the exact sentence making the claim
- regulation: which regulation/law is cited (e.g. "DORA", "GDPR")
- article: specific article if mentioned (e.g. "Article 30(3)") — use "" if none
- celex: CELEX number if identifiable (e.g. "32022R2554" for DORA) — use "" if unknown
- jurisdiction: what jurisdiction this applies to (e.g. "EU", "UK", "Global")

DOCUMENT:
${documentText}`,
  });

  return (output ?? []).slice(0, MAX_CLAIMS);
}
