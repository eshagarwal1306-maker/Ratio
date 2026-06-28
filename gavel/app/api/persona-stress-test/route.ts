import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import type { ClaimResult } from "@/lib/types";

export const maxDuration = 120;

const PersonaResultSchema = z.object({
  verdict: z.enum(["PASSES", "RAISES CONCERNS", "REJECTS"]),
  quote: z.string().describe("A short first-person reaction in character, 1-2 sentences"),
  concerns: z.array(z.string()).describe("2-3 specific concerns or questions from this persona's perspective"),
  recommendation: z.string().describe("One sentence on what this persona would want done before proceeding"),
});

const PERSONAS = [
  {
    id: "judge",
    name: "High Court Judge",
    role: "Mr Justice Blackwell, Commercial Court",
    lens: `You are Mr Justice Blackwell of the Commercial Court. You are reviewing a legal memorandum for legal precision, quality of reasoning, and whether it would survive judicial scrutiny.

Focus on: whether cited provisions actually exist and say what the memo claims; whether the jurisdictional analysis is sound; whether the reasoning is internally consistent; and whether the arguments would hold up in court.

Be rigorous and demanding — a memo that would embarrass counsel in court must be identified.`,
  },
  {
    id: "opposing",
    name: "Opposing Counsel",
    role: "Senior Litigation Partner",
    lens: `You are a senior litigation partner acting for the opposing party. You are looking for weaknesses in this legal memo to exploit.

Focus on: jurisdictional errors you could attack; citations you could challenge; counter-authorities the memo ignores; logical gaps; and arguments you would make to undermine this advice entirely.

Be adversarial — your job is to find every weakness.`,
  },
  {
    id: "regulator",
    name: "FCA Regulator",
    role: "Senior Supervisor, Financial Conduct Authority",
    lens: `You are a senior supervisor at the Financial Conduct Authority reviewing compliance advice.

Focus on: whether the cited regulations are current; whether the regulatory interpretation is accurate; whether the memo correctly identifies who is in scope; and whether relying on this advice would expose the firm to regulatory action.

Be precise — regulatory errors have serious consequences.`,
  },
  {
    id: "partner",
    name: "Partner Risk Review",
    role: "Senior Partner & Head of Risk",
    lens: `You are the head of risk at a magic circle law firm. You are reviewing this memo before it leaves the firm.

Focus on: professional liability and indemnity exposure; whether any errors could support a negligence claim; reputational risk; and whether this should go out as drafted.

Be cautious — your job is to protect the firm.`,
  },
  {
    id: "incounsel",
    name: "In-House Counsel",
    role: "General Counsel, Client Company",
    lens: `You are the General Counsel of the client company receiving this advice.

Focus on: whether the advice is commercially actionable; what happens to the business if this advice turns out to be wrong; whether the caveats are reasonable or excessive; and whether you would rely on this memo to make a board decision.

Be pragmatic — you need advice you can actually use.`,
  },
];

function buildClaimSummary(claimResults: ClaimResult[]): string {
  if (!claimResults.length) return "No claim data available — this is a demonstration scenario.";
  return claimResults.map((r, i) =>
    `Claim ${i + 1} (reliability score: ${r.score}/100):\n` +
    `  "${r.claim.text.slice(0, 160)}"\n` +
    `  Regulation: ${r.claim.regulation} ${r.claim.article}\n` +
    `  Source verification: ${r.sourcer.status}${r.sourcer.discrepancy ? ` — ${r.sourcer.discrepancy}` : ""}\n` +
    `  Jurisdiction: ${r.jurisdictionist.status} (${r.jurisdictionist.confidence}% confidence) — ${r.jurisdictionist.reason}\n` +
    `  Currency: ${r.historian.status} — ${r.historian.note}\n` +
    `  Counter-authority: ${r.devils_advocate.strength} — ${r.devils_advocate.counter_authority}\n` +
    `  Firm conflicts: ${r.firm_memory.status}`
  ).join("\n\n");
}

interface CustomPersona {
  name: string;
  role: string;
  lens: string;
}

export async function POST(req: Request) {
  const {
    claimResults,
    documentText,
    customPersonas = [],
  }: {
    claimResults: ClaimResult[];
    documentText?: string;
    customPersonas?: CustomPersona[];
  } = await req.json();

  const claimSummary = buildClaimSummary(claimResults);

  // Build the review context — prefer document text when provided
  const reviewContext = documentText?.trim()
    ? `DOCUMENT UNDER REVIEW:\n\n${documentText.slice(0, 4000)}${documentText.length > 4000 ? "\n\n[Document truncated for length]" : ""}${claimResults.length > 0 ? `\n\n---\nAUDIT FINDINGS:\n\n${claimSummary}` : ""}`
    : `AUDIT FINDINGS:\n\n${claimSummary}`;

  // Merge standard + custom personas
  const allPersonas = [
    ...PERSONAS,
    ...customPersonas.map((cp, i) => ({
      id: `custom-${i}`,
      name: cp.name,
      role: cp.role,
      lens: cp.lens,
    })),
  ];

  const results = await Promise.all(
    allPersonas.map(async (persona) => {
      const result = await generateObject({
        model: anthropic("claude-haiku-4-5"),
        schema: PersonaResultSchema,
        prompt: `${persona.lens}

You are reviewing the following legal material:

${reviewContext}

Based on this material, respond as ${persona.role}.

Your verdict must be one of: PASSES (you have no significant objections), RAISES CONCERNS (there are issues that must be addressed), or REJECTS (this memo should not be sent or relied upon in its current state).

Keep your quote short and sharp, in character. Your concerns should be specific to what you found — not generic.`,
      });
      return {
        id: persona.id,
        name: persona.name,
        role: persona.role,
        ...result.object,
      };
    })
  );

  return Response.json({ personas: results });
}
