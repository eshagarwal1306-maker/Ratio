import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle,
} from "docx";

export const maxDuration = 30;

interface PersonaResult {
  id: string;
  name: string;
  role: string;
  verdict: "PASSES" | "RAISES CONCERNS" | "REJECTS";
  quote: string;
  concerns: string[];
  recommendation: string;
}

const VERDICT_COLOR: Record<string, string> = {
  "PASSES":          "166534",
  "RAISES CONCERNS": "854d0e",
  "REJECTS":         "991b1b",
};

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

export async function POST(req: Request) {
  const { personas, docTitle }: { personas: PersonaResult[]; docTitle?: string } = await req.json();

  const title = docTitle ?? "RATIO Persona Stress Test Report";
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const rejects  = personas.filter((p) => p.verdict === "REJECTS").length;
  const concerns = personas.filter((p) => p.verdict === "RAISES CONCERNS").length;
  const passes   = personas.filter((p) => p.verdict === "PASSES").length;

  const overallVerdict =
    rejects >= 2 ? "REJECTS" :
    rejects >= 1 || concerns >= 3 ? "RAISES CONCERNS" :
    concerns >= 1 ? "RAISES CONCERNS" : "PASSES";
  const overallColor = VERDICT_COLOR[overallVerdict];

  const children: Paragraph[] = [];

  // Cover
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "RATIO", bold: true, size: 52, color: "0d1f3c", characterSpacing: 120 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Persona Stress Test Report", size: 20, color: "6b7280", italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 36, color: "111827" })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Generated ${dateStr}`, size: 18, color: "6b7280" }),
        new TextRun({ text: "   ·   ", size: 18, color: "d1d5db" }),
        new TextRun({ text: `${personas.length} perspectives assessed`, size: 18, color: "6b7280" }),
      ],
      spacing: { after: 400 },
    }),
    rule(),
  );

  // Overall verdict
  children.push(
    spacer(200, 80),
    new Paragraph({
      children: [new TextRun({ text: "OVERALL VERDICT", bold: true, size: 18, color: "374151", characterSpacing: 100 })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: overallVerdict, bold: true, size: 32, color: overallColor })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `${rejects} reject${rejects !== 1 ? "s" : ""}`, size: 18, color: "991b1b" }),
        new TextRun({ text: "   ·   ", size: 18, color: "d1d5db" }),
        new TextRun({ text: `${concerns} concern${concerns !== 1 ? "s" : ""}`, size: 18, color: "854d0e" }),
        new TextRun({ text: "   ·   ", size: 18, color: "d1d5db" }),
        new TextRun({ text: `${passes} pass${passes !== 1 ? "es" : ""}`, size: 18, color: "166534" }),
      ],
      spacing: { after: 200 },
    }),
    rule(),
  );

  // Each persona
  personas.forEach((persona, i) => {
    const verdictColor = VERDICT_COLOR[persona.verdict] ?? "374151";

    children.push(
      spacer(i === 0 ? 200 : 400, 80),
      // Name + role
      new Paragraph({
        children: [
          new TextRun({ text: persona.name, bold: true, size: 26, color: "111827" }),
          new TextRun({ text: `  ·  ${persona.role}`, size: 20, color: "9ca3af", italics: true }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 80 },
      }),
      // Verdict badge
      new Paragraph({
        children: [new TextRun({ text: persona.verdict, bold: true, size: 18, color: verdictColor, characterSpacing: 80 })],
        spacing: { after: 160 },
      }),
      // Quote
      new Paragraph({
        children: [new TextRun({ text: `"${persona.quote}"`, italics: true, size: 20, color: "4b5563" })],
        spacing: { after: 200 },
        indent: { left: 360 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: "d1d5db" } },
      }),
    );

    // Concerns
    if (persona.concerns.length > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Concerns raised:", bold: true, size: 18, color: "374151" })],
          spacing: { after: 80 },
        }),
      );
      persona.concerns.forEach((concern) => {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `• ${concern}`, size: 18, color: "4b5563" })],
            spacing: { after: 80 },
            indent: { left: 360 },
          }),
        );
      });
    }

    // Recommendation
    children.push(
      spacer(120, 40),
      new Paragraph({
        children: [
          new TextRun({ text: "Recommendation: ", bold: true, size: 18, color: verdictColor }),
          new TextRun({ text: persona.recommendation, size: 18, color: "4b5563" }),
        ],
        spacing: { after: 80 },
        indent: { left: 240 },
      }),
      rule(),
    );
  });

  // Disclaimer
  children.push(
    spacer(200, 80),
    new Paragraph({
      children: [new TextRun({
        text: "Persona assessments generated by RATIO using Claude. These represent simulated stakeholder perspectives only and do not constitute legal advice.",
        size: 16, color: "9ca3af", italics: true,
      })],
      alignment: AlignmentType.CENTER,
    }),
  );

  const doc = new Document({
    title,
    creator: "RATIO Legal AI",
    sections: [{ properties: {}, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="ratio-persona-stress-test-${Date.now()}.docx"`,
    },
  });
}
