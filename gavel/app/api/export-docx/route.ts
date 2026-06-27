import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, ShadingType,
  TableRow, TableCell, Table, WidthType,
} from "docx";
import type { ClaimResult } from "@/lib/types";

export const maxDuration = 30;

const STATUS_LABEL: Record<string, string> = {
  CITED: "✓ Cited",
  INFERRED: "~ Inferred",
  NOT_FOUND: "✗ Not found",
  APPLICABLE: "✓ Applicable",
  WRONG_JURISDICTION: "✗ Wrong jurisdiction",
  UNCLEAR: "~ Unclear",
  CURRENT: "✓ Current",
  AMENDED: "~ Amended",
  UNKNOWN: "? Unknown",
  NO_CONFLICT: "✓ No conflict",
  CONTRADICTION_FOUND: "✗ Contradiction found",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

function scoreLabel(score: number) {
  if (score >= 70) return "PROCEED";
  if (score >= 40) return "REVIEW REQUIRED";
  return "DO NOT SEND";
}

export async function POST(req: Request) {
  const { keptResults, docTitle }: { keptResults: ClaimResult[]; docTitle?: string } = await req.json();

  const title = docTitle ?? "GAVEL Verification Report";
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const overallScore = keptResults.length
    ? Math.round(keptResults.reduce((s, r) => s + r.score, 0) / keptResults.length)
    : 0;

  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 36, color: "1a1a2e" })],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${dateStr}  |  Claims verified: ${keptResults.length}  |  Overall score: ${overallScore}/100 (${scoreLabel(overallScore)})`, size: 18, color: "6b7280" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Verified Claims", bold: true, size: 28 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
  ];

  keptResults.forEach((result, i) => {
    const scoreColor = result.score >= 70 ? "00a651" : result.score >= 40 ? "f5a623" : "ff3b5c";

    // Claim header
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Claim ${i + 1}  `, bold: true, size: 24 }),
          new TextRun({ text: `${result.score}/100 — ${scoreLabel(result.score)}`, bold: true, size: 20, color: scoreColor }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "e5e7eb" } },
      }),
    );

    // Claim text (regulation + article)
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${result.claim.regulation} ${result.claim.article}  `, bold: true, size: 18, color: "374151" }),
          new TextRun({ text: result.claim.jurisdiction, italics: true, size: 16, color: "9ca3af" }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `"${result.claim.text}"`, italics: true, size: 18, color: "4b5563" })],
        spacing: { after: 240 },
        indent: { left: 360 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: "d1d5db" } },
      }),
    );

    // Agent findings table
    const rows = [
      ["Citation Sourcer", STATUS_LABEL[result.sourcer.status] ?? result.sourcer.status, result.sourcer.discrepancy ?? result.sourcer.verbatim_quote ?? ""],
      ["Jurisdictionist", STATUS_LABEL[result.jurisdictionist.status] ?? result.jurisdictionist.status, `${result.jurisdictionist.confidence}% confidence — ${result.jurisdictionist.reason}`],
      ["Legal Historian", STATUS_LABEL[result.historian.status] ?? result.historian.status, result.historian.note],
      ["Devil's Advocate", `Counter-strength: ${STATUS_LABEL[result.devils_advocate.strength] ?? result.devils_advocate.strength}`, `${result.devils_advocate.counter_authority}: ${result.devils_advocate.why_it_undermines}`],
      ["Firm Memory", STATUS_LABEL[result.firm_memory.status] ?? result.firm_memory.status, result.firm_memory.reference ? `${result.firm_memory.reference.matter} (${result.firm_memory.reference.date})` : "No prior conflicts found"],
    ].map(([agent, verdict, detail]) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: agent, bold: true, size: 16 })] })], width: { size: 22, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: verdict, size: 16 })] })], width: { size: 20, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: detail ?? "", size: 14, color: "6b7280" })] })], width: { size: 58, type: WidthType.PERCENTAGE } }),
        ],
      })
    );

    children.push(
      new Paragraph({ children: [], spacing: { after: 80 } }),
    );

    if (rows.length) {
      children.push(
        new Table({
          rows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        }) as unknown as Paragraph,
      );
    }

    // Orchestrator reasoning
    if (result.orchestrator_reasoning) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Orchestrator note: ", bold: true, size: 16, color: "4a9eff" }),
            new TextRun({ text: result.orchestrator_reasoning, size: 16, color: "6b7280" }),
          ],
          spacing: { before: 160, after: 80 },
          indent: { left: 240 },
        }),
      );
    }
  });

  // Footer disclaimer
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "This report was produced by GAVEL — an AI legal reasoning auditor. It does not constitute legal advice. All findings should be reviewed by a qualified solicitor.", size: 14, color: "9ca3af", italics: true })],
      spacing: { before: 800 },
      alignment: AlignmentType.CENTER,
    }),
  );

  const doc = new Document({
    title,
    creator: "GAVEL Legal AI",
    sections: [{ properties: {}, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  const uint8 = new Uint8Array(buffer);

  return new Response(uint8, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="gavel-report-${Date.now()}.docx"`,
    },
  });
}
