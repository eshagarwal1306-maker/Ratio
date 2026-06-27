import { type Claim, type FirmMemoryResult } from "../schemas";

// Mocked firm memory corpus — in production this would be vector search over
// the firm's ingested matters, opinions, and precedent documents.

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
  {
    trigger: {
      regulations: ["CDPA", "Copyright, Designs and Patents Act", "copyright"],
      keywords: ["employee", "employment", "course of employment", "employer"],
    },
    record: {
      date: "November 2023",
      matter: "IP Ownership Dispute — MediaCo v Former Employee",
      partner: "S. Patel",
      position:
        "CDPA s.11(2) vests copyright in the employer where the work is created in the course of employment. However, 'course of employment' is construed narrowly — works created outside working hours or without use of employer resources may remain with the employee. Confirm factual matrix carefully.",
    },
  },
  {
    trigger: {
      regulations: ["Patents Act", "patents"],
      keywords: ["employee", "invention", "renumeration", "remuneration", "compensation", "s.40", "s40", "section 40"],
    },
    record: {
      date: "June 2023",
      matter: "Employee Inventions — PharmaTech Ltd",
      partner: "R. Osei",
      position:
        "Patents Act 1977 s.40 compensation claims face an exceptionally high threshold. The invention must have been of 'outstanding benefit' to the employer, and courts have rarely awarded compensation. Advise clients that s.40 claims are high-risk litigation with uncertain prospects.",
    },
  },
  {
    trigger: {
      regulations: ["GDPR", "UK GDPR", "Data Protection Act"],
      keywords: ["data", "personal data", "processing", "controller", "processor"],
    },
    record: {
      date: "January 2024",
      matter: "Data Protection Audit — RetailGroup plc",
      partner: "L. Chen",
      position:
        "Post-Brexit, UK entities are subject to UK GDPR (not EU GDPR) for UK-established processing. EU GDPR continues to apply where the entity processes EU residents' data from outside the UK. Distinguish the two regimes carefully — they differ on SCCs, DPIAs, and enforcement.",
    },
  },
];

export function runFirmMemory(claim: Claim): FirmMemoryResult {
  const claimLower = claim.text.toLowerCase();
  const regLower = (claim.regulation ?? "").toLowerCase();

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
