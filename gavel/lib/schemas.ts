import { z } from "zod";

// A single atomic legal claim extracted from a document
export const ClaimSchema = z.object({
  text: z.string().describe("The exact sentence making the legal claim"),
  regulation: z.string().describe("Which regulation/law is cited, e.g. 'DORA'"),
  article: z.string().describe("Specific article if mentioned, e.g. 'Article 30(3)'"),
  celex: z.string().describe("CELEX number if identifiable, e.g. '32022R2554' for DORA"),
  jurisdiction: z.string().describe("What jurisdiction this claim applies to"),
});

export type Claim = z.infer<typeof ClaimSchema>;

// Agent 1 — Sourcer
export const SourcerResultSchema = z.object({
  status: z.enum(["CITED", "INFERRED", "NOT_FOUND"]),
  match: z.boolean().describe("Whether the AI claim accurately reflects the source"),
  discrepancy: z.string().describe("What is different, if anything"),
  verbatim_quote: z.string().describe("Exact quote from the actual source text"),
});

export type SourcerResult = z.infer<typeof SourcerResultSchema>;

// Agent 2 — Jurisdictionist
export const JurisdictionistResultSchema = z.object({
  status: z.enum(["APPLICABLE", "WRONG_JURISDICTION", "UNCLEAR"]),
  confidence: z.number().min(0).max(100),
  reason: z.string().describe("Plain English explanation"),
  article_reference: z.string().describe("Which scope article applies"),
});

export type JurisdictionistResult = z.infer<typeof JurisdictionistResultSchema>;

// Agent 3 — Devil's Advocate
export const DevilsAdvocateResultSchema = z.object({
  counter_authority: z.string().describe("Name of the counter-authority (case, regulation, guideline)"),
  why_it_undermines: z.string().describe("Why this counter-authority weakens the claim"),
  strength: z.enum(["high", "medium", "low"]),
});

export type DevilsAdvocateResult = z.infer<typeof DevilsAdvocateResultSchema>;

// Agent 4 — Historian
export const HistorianResultSchema = z.object({
  status: z.enum(["CURRENT", "AMENDED", "UNKNOWN"]),
  in_force: z.boolean(),
  amendments: z.array(z.string()).describe("CELEX IDs of amending acts"),
  note: z.string().describe("Human-readable summary of the version/currency situation"),
});

export type HistorianResult = z.infer<typeof HistorianResultSchema>;

// Agent 5 — Firm Memory
export const FirmMemoryResultSchema = z.object({
  status: z.enum(["CONTRADICTION_FOUND", "NO_CONFLICT"]),
  reference: z
    .object({
      date: z.string(),
      matter: z.string(),
      partner: z.string(),
      position: z.string(),
    })
    .optional(),
  severity: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
});

export type FirmMemoryResult = z.infer<typeof FirmMemoryResultSchema>;

// Full result for a single claim across all agents
export const ClaimAuditResultSchema = z.object({
  claim: ClaimSchema,
  sourcer: SourcerResultSchema,
  jurisdictionist: JurisdictionistResultSchema,
  devils_advocate: DevilsAdvocateResultSchema,
  historian: HistorianResultSchema,
  firm_memory: FirmMemoryResultSchema,
  score: z.number().min(0).max(100),
});

export type ClaimAuditResult = z.infer<typeof ClaimAuditResultSchema>;

// Final GAVEL report
export const GavelReportSchema = z.object({
  claims: z.array(ClaimAuditResultSchema),
  overall_score: z.number().min(0).max(100),
  reasoning_trace: z.string(),
});

export type GavelReport = z.infer<typeof GavelReportSchema>;
