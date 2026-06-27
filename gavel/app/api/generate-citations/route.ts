import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 60;

const ResponseSchema = z.object({
  citations: z.array(z.object({
    type: z.enum(["legislation", "case_law", "practitioners_guide", "academic"]),
    title: z.string(),
    reference: z.string(),
    relevance: z.string(),
    claim_context: z.string(),
  })),
  enriched_document: z.string(),
});

export async function POST(req: Request) {
  const { documentText } = await req.json();

  const result = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: ResponseSchema,
    prompt: `You are a senior legal researcher specialising in EU and UK law. Analyse this legal document and identify every claim or assertion that requires a citation.

For each claim, find the most appropriate source from:
1. LEGISLATION — EU Regulations, Directives, UK statutes (with precise article numbers)
2. CASE LAW — CJEU, ECHR, UK Supreme Court, Court of Appeal decisions (proper citation format)
3. PRACTITIONERS GUIDES — EBA guidelines, FCA guidance papers, FRC guidance (with document reference)
4. ACADEMIC — Influential articles or textbooks if particularly relevant

Return:
- A list of citations (up to 12 total, prioritise quality over quantity)
- An "enriched_document" — the original document text with inline citation markers like [1], [2] etc. inserted at the precise point where each citation supports the text. Add a "References" section at the end listing all citations.

Document:
${documentText}`,
  });

  return Response.json(result.object);
}
