import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
  headers: {
    "HTTP-Referer": "https://ratio.law",
    "X-Title": "RATIO Legal Auditor",
  },
});

const NEMOTRON = openrouter("nvidia/llama-3.1-nemotron-70b-instruct");

export const maxDuration = 120;

// ── Dimension definitions ─────────────────────────────────────────────────────

const STANCES = {
  strict_textual: {
    label: "Strict Textual",
    instruction:
      "Apply a strict textualist interpretation. Focus exclusively on the literal words of the judgment. Do not infer purpose, policy, or legislative intent beyond what is explicitly stated in the text.",
  },
  purposive: {
    label: "Purposive",
    instruction:
      "Apply a purposive interpretation. Consider the underlying purpose and policy objectives the court was trying to achieve. Look beyond the literal words to the broader legislative or judicial intent.",
  },
  commercially_pragmatic: {
    label: "Commercially Pragmatic",
    instruction:
      "Apply a commercially pragmatic interpretation. Consider how a reasonable businessperson or commercial court would understand the ratio. Prioritise practical commercial certainty and workability over theoretical precision.",
  },
} as const;

const FRAMINGS = {
  narrow: {
    label: "Narrow",
    instruction:
      "Evaluate the proposition only against the narrowest possible reading of the case facts — those that closely mirror the specific circumstances actually before the court.",
  },
  standard: {
    label: "Standard",
    instruction:
      "Evaluate the proposition against the facts as normally understood, using ordinary legal reasoning about the scope of the holding.",
  },
  broad: {
    label: "Broad",
    instruction:
      "Evaluate the proposition against the broadest reasonable factual reading — consider how far the principle might extend beyond the immediate facts.",
  },
} as const;

type Stance = keyof typeof STANCES;
type Framing = keyof typeof FRAMINGS;
type Angle = "direct" | "ratio_first";
type Verdict = "supports" | "partially_supports" | "does_not_support";

const RunResultSchema = z.object({
  verdict: z.enum(["supports", "partially_supports", "does_not_support"]),
  reasoning: z.string().describe("1-2 sentence explanation of this verdict"),
  key_limitation: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined)
    .describe(
      "The main reason the proposition fails or is qualified, if any. E.g. 'Established in commercial context, not consumer context'"
    ),
});

// ── Single run ─────────────────────────────────────────────────────────────────

async function runSingle(
  caseName: string,
  caseText: string,
  proposition: string,
  stance: Stance,
  framing: Framing,
  angle: Angle
): Promise<{ stance: Stance; framing: Framing; angle: Angle; verdict: Verdict; reasoning: string; key_limitation?: string }> {
  const stanceMeta = STANCES[stance];
  const framingMeta = FRAMINGS[framing];

  const ratioStep =
    angle === "ratio_first"
      ? "Step 1: Independently extract the ratio decidendi of the case. Step 2: Then assess whether that extracted ratio — not the case in general — supports the proposition below. This prevents confirmation bias from jumping directly to the proposition."
      : "Assess directly whether the case supports the proposition.";

  const prompt = `You are a precise legal analyst performing a proposition-matching assessment.

INTERPRETIVE STANCE: ${stanceMeta.instruction}

FACTUAL SCOPE: ${framingMeta.instruction}

ASSESSMENT METHOD: ${ratioStep}

---
CASE: ${caseName}
${caseText ? `\nCASE SUMMARY:\n${caseText.slice(0, 2000)}\n` : ""}
PROPOSITION: "${proposition}"
---

Deliver a structured verdict. Be concise and precise. Do not hedge — commit to a verdict.

Respond with ONLY a valid JSON object in this exact format (no markdown, no explanation outside the JSON):
{
  "verdict": "supports" | "partially_supports" | "does_not_support",
  "reasoning": "<1-2 sentence explanation>",
  "key_limitation": "<main reason proposition fails or is qualified, or null>"
}`;

  async function callModel(model: typeof NEMOTRON | ReturnType<typeof anthropic>) {
    const { text } = await generateText({ model, prompt });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON in response: ${text.slice(0, 200)}`);
    return RunResultSchema.parse(JSON.parse(jsonMatch[0]));
  }

  // Try Nemotron first, fall back to Claude Haiku if it fails
  let parsed: z.infer<typeof RunResultSchema>;
  try {
    parsed = await callModel(NEMOTRON);
  } catch (e) {
    console.warn("Nemotron failed, falling back to Claude:", e);
    parsed = await callModel(anthropic("claude-haiku-4-5-20251001"));
  }

  return {
    stance,
    framing,
    angle,
    verdict: parsed.verdict,
    reasoning: parsed.reasoning,
    key_limitation: parsed.key_limitation,
  };
}

// ── Aggregation ───────────────────────────────────────────────────────────────

interface StanceBreakdown {
  label: string;
  supports: number;
  partially: number;
  rejects: number;
  total: number;
}

interface AggregatedResult {
  confidence: number;
  stanceBreakdown: Record<Stance, StanceBreakdown>;
  factSensitivity: string;
  topFailureReasons: string[];
  allRuns: Array<{ stance: Stance; framing: Framing; angle: Angle; verdict: Verdict; reasoning: string; key_limitation?: string }>;
  runsCompleted: number;
  mode: "quick" | "full";
}

function aggregate(
  runs: Awaited<ReturnType<typeof runSingle>>[],
  mode: "quick" | "full"
): AggregatedResult {
  const total = runs.length;

  // Overall confidence: "supports" = 1.0, "partially_supports" = 0.5, "does_not_support" = 0.0
  const weightedScore = runs.reduce((s, r) => {
    if (r.verdict === "supports") return s + 1;
    if (r.verdict === "partially_supports") return s + 0.5;
    return s;
  }, 0);
  const confidence = Math.round((weightedScore / total) * 100);

  // Per-stance breakdown
  const stanceBreakdown = {} as Record<Stance, StanceBreakdown>;
  for (const stance of Object.keys(STANCES) as Stance[]) {
    const stanceRuns = runs.filter((r) => r.stance === stance);
    stanceBreakdown[stance] = {
      label: STANCES[stance].label,
      supports: stanceRuns.filter((r) => r.verdict === "supports").length,
      partially: stanceRuns.filter((r) => r.verdict === "partially_supports").length,
      rejects: stanceRuns.filter((r) => r.verdict === "does_not_support").length,
      total: stanceRuns.length,
    };
  }

  // Fact sensitivity — compare narrow vs broad
  const narrowRuns = runs.filter((r) => r.framing === "narrow");
  const broadRuns = runs.filter((r) => r.framing === "broad");
  const narrowConf = narrowRuns.length
    ? narrowRuns.reduce((s, r) => s + (r.verdict === "supports" ? 1 : r.verdict === "partially_supports" ? 0.5 : 0), 0) / narrowRuns.length
    : null;
  const broadConf = broadRuns.length
    ? broadRuns.reduce((s, r) => s + (r.verdict === "supports" ? 1 : r.verdict === "partially_supports" ? 0.5 : 0), 0) / broadRuns.length
    : null;

  let factSensitivity = "Conclusion is stable across factual framings.";
  if (narrowConf !== null && broadConf !== null) {
    const delta = Math.abs(narrowConf - broadConf);
    if (delta > 0.3) {
      factSensitivity =
        narrowConf > broadConf
          ? "Highly fact-sensitive: citation only holds on narrow facts closely mirroring the original case."
          : "Proposition generalises well: holds more strongly under broader factual readings.";
    } else if (delta > 0.15) {
      factSensitivity = "Moderately fact-sensitive: some dependency on how closely facts match the original case.";
    }
  }

  // Top failure reasons
  const limitations = runs
    .filter((r) => r.key_limitation)
    .map((r) => r.key_limitation as string);

  // Deduplicate loosely (take up to 3 unique-ish ones)
  const seen = new Set<string>();
  const topFailureReasons: string[] = [];
  for (const lim of limitations) {
    const key = lim.slice(0, 40).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      topFailureReasons.push(lim);
      if (topFailureReasons.length >= 3) break;
    }
  }

  return {
    confidence,
    stanceBreakdown,
    factSensitivity,
    topFailureReasons,
    allRuns: runs,
    runsCompleted: runs.length,
    mode,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const {
    caseName,
    caseText = "",
    proposition,
    mode = "quick",
  }: {
    caseName: string;
    caseText?: string;
    proposition: string;
    mode?: "quick" | "full";
  } = await req.json();

  const stances = Object.keys(STANCES) as Stance[];
  const framings = Object.keys(FRAMINGS) as Framing[];
  const angles: Angle[] = ["direct", "ratio_first"];

  let tasks: Array<{ stance: Stance; framing: Framing; angle: Angle }>;

  if (mode === "quick") {
    // 3 runs: one per stance, standard framing, direct angle
    tasks = stances.map((stance) => ({ stance, framing: "standard" as Framing, angle: "direct" as Angle }));
  } else {
    // 18 runs: all combinations
    tasks = stances.flatMap((stance) =>
      framings.flatMap((framing) =>
        angles.map((angle) => ({ stance, framing, angle }))
      )
    );
  }

  try {
    const runs = await Promise.all(
      tasks.map(({ stance, framing, angle }) =>
        runSingle(caseName, caseText, proposition, stance, framing, angle)
      )
    );
    const result = aggregate(runs, mode);
    return Response.json(result);
  } catch (e) {
    console.error("Proposition match error:", e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
