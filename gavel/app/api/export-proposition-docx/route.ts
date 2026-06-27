import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle,
} from "docx";

export const maxDuration = 30;

type Stance  = "strict_textual" | "purposive" | "commercially_pragmatic";
type Verdict = "supports" | "partially_supports" | "does_not_support";

interface StanceBreakdown {
  label: string;
  supports: number;
  partially: number;
  rejects: number;
  total: number;
}

interface RunDetail {
  stance: Stance;
  framing: "narrow" | "standard" | "broad";
  angle: "direct" | "ratio_first";
  verdict: Verdict;
  reasoning: string;
  key_limitation?: string;
}

interface MatchResult {
  confidence: number;
  stanceBreakdown: Record<Stance, StanceBreakdown>;
  factSensitivity: string;
  topFailureReasons: string[];
  allRuns: RunDetail[];
  runsCompleted: number;
  mode: "quick" | "full";
}

function rule(): Paragraph {
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "e5e7eb" } },
    spacing: { before: 240, after: 240 },
  });
}

function spacer(before = 0, after = 160): Paragraph {
  return new Paragraph({ children: [new TextRun("")], spacing: { before, after } });
}

const VERDICT_LABEL: Record<Verdict, string> = {
  supports:            "Supports",
  partially_supports:  "Partially supports",
  does_not_support:    "Does not support",
};

const FRAMING_LABEL: Record<string, string> = {
  narrow:   "Narrow",
  standard: "Standard",
  broad:    "Broad",
};

const ANGLE_LABEL: Record<string, string> = {
  direct:      "Direct",
  ratio_first: "Ratio-First",
};

export async function POST(req: Request) {
  const {
    result,
    caseName,
    proposition,
  }: { result: MatchResult; caseName: string; proposition: string } = await req.json();

  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const confidenceColor =
    result.confidence >= 70 ? "166534" :
    result.confidence >= 40 ? "854d0e" : "991b1b";

  const confidenceLabel =
    result.confidence >= 70 ? "Likely Supports" :
    result.confidence >= 40 ? "Uncertain Match" : "Does Not Support";

  const children: Paragraph[] = [];

  // Cover
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "RATIO", bold: true, size: 52, color: "0d1f3c", characterSpacing: 120 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Monte Carlo Proposition Match Report", size: 20, color: "6b7280", italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Proposition Match Analysis", bold: true, size: 36, color: "111827" })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Generated ${dateStr}`, size: 18, color: "6b7280" }),
        new TextRun({ text: "   ·   ", size: 18, color: "d1d5db" }),
        new TextRun({ text: `${result.runsCompleted} runs · ${result.mode === "quick" ? "Quick mode" : "Full 18-run analysis"}`, size: 18, color: "6b7280" }),
      ],
      spacing: { after: 400 },
    }),
    rule(),
  );

  // Case + proposition
  children.push(
    spacer(200, 80),
    new Paragraph({
      children: [new TextRun({ text: "CASE", bold: true, size: 16, color: "9ca3af", characterSpacing: 120 })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: caseName, bold: true, size: 24, color: "111827" })],
      spacing: { after: 240 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "PROPOSITION TESTED", bold: true, size: 16, color: "9ca3af", characterSpacing: 120 })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `"${proposition}"`, italics: true, size: 22, color: "1e293b" })],
      spacing: { after: 200 },
      indent: { left: 360 },
      border: { left: { style: BorderStyle.SINGLE, size: 16, color: "6366f1" } },
    }),
    rule(),
  );

  // Confidence result
  children.push(
    spacer(200, 80),
    new Paragraph({
      children: [new TextRun({ text: "CONFIDENCE SCORE", bold: true, size: 16, color: "374151", characterSpacing: 100 })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `${result.confidence}%`, bold: true, size: 52, color: confidenceColor }),
        new TextRun({ text: `  —  ${confidenceLabel}`, bold: true, size: 28, color: confidenceColor }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Based on ${result.runsCompleted} parallel Claude runs across interpretive stances, factual framings, and extraction angles.`, size: 18, color: "6b7280" })],
      spacing: { after: 200 },
    }),
    rule(),
  );

  // Stance breakdown
  children.push(
    spacer(200, 80),
    new Paragraph({
      children: [new TextRun({ text: "BREAKDOWN BY INTERPRETIVE STANCE", bold: true, size: 16, color: "374151", characterSpacing: 100 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
  );

  for (const [, bd] of Object.entries(result.stanceBreakdown) as [Stance, StanceBreakdown][]) {
    if (bd.total === 0) continue;
    const supportPct = Math.round((bd.supports / bd.total) * 100);

    children.push(
      new Paragraph({
        children: [new TextRun({ text: bd.label, bold: true, size: 22, color: "1e293b" })],
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `${bd.supports}/${bd.total} runs support  (${supportPct}%)`, size: 18, color: "166534" }),
          new TextRun({ text: "   ·   ", size: 18, color: "d1d5db" }),
          new TextRun({ text: `${bd.partially} partial`, size: 18, color: "854d0e" }),
          new TextRun({ text: "   ·   ", size: 18, color: "d1d5db" }),
          new TextRun({ text: `${bd.rejects} reject`, size: 18, color: "991b1b" }),
        ],
        spacing: { after: 200 },
        indent: { left: 240 },
      }),
    );
  }

  children.push(rule());

  // Fact sensitivity
  children.push(
    spacer(200, 80),
    new Paragraph({
      children: [new TextRun({ text: "FACT SENSITIVITY", bold: true, size: 16, color: "374151", characterSpacing: 100 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: result.factSensitivity, size: 20, color: "374151" })],
      spacing: { after: 200 },
    }),
    rule(),
  );

  // Failure reasons
  if (result.topFailureReasons.length > 0) {
    children.push(
      spacer(200, 80),
      new Paragraph({
        children: [new TextRun({ text: "KEY FAILURE REASONS", bold: true, size: 16, color: "374151", characterSpacing: 100 })],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 120 },
      }),
    );
    result.topFailureReasons.forEach((reason) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `✗  ${reason}`, size: 18, color: "991b1b" })],
          spacing: { after: 120 },
          indent: { left: 240 },
        }),
      );
    });
    children.push(rule());
  }

  // All runs table
  children.push(
    spacer(200, 80),
    new Paragraph({
      children: [new TextRun({ text: "ALL RUNS", bold: true, size: 16, color: "374151", characterSpacing: 100 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 160 },
    }),
  );

  result.allRuns.forEach((run, i) => {
    const vColor =
      run.verdict === "supports" ? "166534" :
      run.verdict === "partially_supports" ? "854d0e" : "991b1b";

    const stanceLabel = result.stanceBreakdown[run.stance]?.label ?? run.stance;

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Run ${i + 1}  `, bold: true, size: 18, color: "374151" }),
          new TextRun({ text: `${stanceLabel} · ${FRAMING_LABEL[run.framing]} · ${ANGLE_LABEL[run.angle]}`, size: 16, color: "9ca3af" }),
        ],
        spacing: { before: i === 0 ? 0 : 200, after: 60 },
      }),
      new Paragraph({
        children: [new TextRun({ text: VERDICT_LABEL[run.verdict], bold: true, size: 18, color: vColor })],
        spacing: { after: 60 },
        indent: { left: 240 },
      }),
      new Paragraph({
        children: [new TextRun({ text: run.reasoning, size: 16, color: "4b5563" })],
        spacing: { after: run.key_limitation ? 40 : 120 },
        indent: { left: 240 },
      }),
      ...(run.key_limitation ? [
        new Paragraph({
          children: [new TextRun({ text: `Limitation: ${run.key_limitation}`, size: 15, color: "991b1b", italics: true })],
          spacing: { after: 120 },
          indent: { left: 240 },
        }),
      ] : []),
    );
  });

  // Disclaimer
  children.push(
    spacer(400, 80),
    new Paragraph({
      children: [new TextRun({
        text: "Proposition matching performed by RATIO using Nemotron via OpenRouter. Results represent probabilistic analysis across interpretive stances and do not constitute legal advice.",
        size: 16, color: "9ca3af", italics: true,
      })],
      alignment: AlignmentType.CENTER,
    }),
  );

  const doc = new Document({
    title: "RATIO Proposition Match Report",
    creator: "RATIO Legal AI",
    sections: [{ properties: {}, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="ratio-proposition-match-${Date.now()}.docx"`,
    },
  });
}
