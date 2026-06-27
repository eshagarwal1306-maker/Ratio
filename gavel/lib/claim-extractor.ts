import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { z } from "zod";
import { ClaimSchema, type Claim } from "./schemas";

export async function extractClaims(documentText: string): Promise<Claim[]> {
  const { output } = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    output: Output.array({ element: ClaimSchema }),
    instructions:
      "You are a legal document analyst. Extract every verifiable legal claim from the document — statements that cite a specific law, regulation, article, or case as authority. Be precise and literal.",
    prompt: `Extract every verifiable legal claim from this document.

A legal claim = a statement citing a specific law, regulation, or case as authority.

For each claim:
- text: the exact sentence making the claim
- regulation: which regulation/law is cited (e.g. "DORA", "GDPR")
- article: specific article if mentioned (e.g. "Article 30(3)") — use "" if none
- celex: CELEX number if identifiable (e.g. "32022R2554" for DORA) — use "" if unknown
- jurisdiction: what jurisdiction this applies to (e.g. "EU", "UK", "Global")

DOCUMENT:
${documentText}`,
  });

  return output ?? [];
}
