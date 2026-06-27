import { type Claim, type FirmMemoryResult } from "../schemas";

// Mocked firm memory corpus — in production this would be FAISS vector search
// over the firm's ingested matters, opinions, and precedent documents
const FIRM_MEMORY_CORPUS: Array<{
  trigger: { regulations: string[]; keywords: string[] };
  record: { date: string; matter: string; partner: string; position: string };
}> = [
  {
    trigger: {
      regulations: ["DORA", "32022R2554"],
      keywords: ["UK", "United Kingdom", "British", "post-Brexit"],
    },
    record: {
      date: "March 2024",
      matter: "Client Advisory — TechFinance Ltd",
      partner: "J. Richardson",
      position:
        "UK-only firms are outside DORA scope absent EU establishment. Post-Brexit, UK entities must hold EU authorisation or operate via an EU branch to fall within DORA Article 2 scope.",
    },
  },
];

export function runFirmMemory(claim: Claim): FirmMemoryResult {
  const claimLower = claim.text.toLowerCase();
  const regLower = claim.regulation.toLowerCase();

  for (const entry of FIRM_MEMORY_CORPUS) {
    const regulationMatch = entry.trigger.regulations.some(
      (r) => regLower.includes(r.toLowerCase()) || claim.celex === r
    );
    const keywordMatch = entry.trigger.keywords.some((kw) =>
      claimLower.includes(kw.toLowerCase())
    );

    if (regulationMatch && keywordMatch) {
      return {
        status: "CONTRADICTION_FOUND",
        reference: entry.record,
        severity: "HIGH",
      };
    }
  }

  return { status: "NO_CONFLICT" };
}
