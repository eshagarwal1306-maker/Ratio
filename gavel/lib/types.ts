export interface ClaimResult {
  claim: { text: string; regulation: string; article: string; jurisdiction: string };
  sourcer: { status: "CITED" | "INFERRED" | "NOT_FOUND"; discrepancy?: string; verbatim_quote?: string; match?: boolean };
  jurisdictionist: { status: "APPLICABLE" | "WRONG_JURISDICTION" | "UNCLEAR"; confidence: number; reason: string };
  historian: { status: "CURRENT" | "AMENDED" | "UNKNOWN"; note: string };
  devils_advocate: { counter_authority: string; why_it_undermines: string; strength: "high" | "medium" | "low" };
  firm_memory: { status: "CONTRADICTION_FOUND" | "NO_CONFLICT"; reference?: { matter: string; date: string; position: string } };
  score: number;
  orchestrator_reasoning: string;
}

export interface GeneratedCitation {
  type: "legislation" | "case_law" | "practitioners_guide" | "academic";
  title: string;
  reference: string;
  relevance: string;
  claim_context: string;
}
