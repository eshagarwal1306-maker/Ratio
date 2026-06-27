import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, ShadingType,
} from "docx";

export const maxDuration = 30;

const TYPE_LABEL: Record<string, string> = {
  legislation:         "Legislation",
  case_law:            "Case Law",
  practitioners_guide: "Practice Guide",
  academic:            "Academic",
};

const TYPE_COLOR: Record<string, string> = {
  legislation:         "1d4ed8",
  case_law:            "7c3aed",
  practitioners_guide: "b45309",
  academic:            "047857",
};

interface Citation {
  title: string;
  reference: string;
  type: string;
  relevance: string;
}

function rule(): Paragraph {
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "e5e7eb" } },
    spacing: { before: 300, after: 300 },
  });
}

function spacer(before = 0, after = 120): Paragraph {
  return new Paragraph({ children: [new TextRun("")], spacing: { before, after } });
}

export async function POST(req: Request) {
  const { citations, enrichedDoc, docTitle }: {
    citations: Citation[];
    enrichedDoc?: string;
    docTitle?: string;
  } = await req.json();

  const reportTitle = docTitle ?? "RATIO Source Discovery Report";
  const dateStr = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const children: Paragraph[] = [];

  // ── Cover ──────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "RATIO", bold: true, size: 52, color: "0d1f3c", characterSpacing: 120 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 800, after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Legal Reasoning Auditor", size: 20, color: "6b7280", italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 800 },
    }),
    new Paragraph({
      children: [new TextRun({ text: reportTitle, bold: true, size: 36, color: "111827" })],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Generated ${dateStr}`, size: 18, color: "6b7280" }),
        new TextRun({ text: "   ·   ", size: 18, color: "d1d5db" }),
        new TextRun({ text: `${citations.length} source${citations.length !== 1 ? "s" : ""} found`, size: 18, color: "6b7280" }),
      ],
      spacing: { after: 600 },
    }),
    rule(),
  );

  // ── Sources heading ────────────────────────────────────────────────────────
  children.push(
    spacer(200, 0),
    new Paragraph({
      children: [new TextRun({ text: "SOURCES", bold: true, size: 22, color: "374151", characterSpacing: 120 })],
      spacing: { before: 200, after: 400 },
    }),
  );

  // ── Citation entries ───────────────────────────────────────────────────────
  citations.forEach((c, i) => {
    const typeLabel = TYPE_LABEL[c.type] ?? c.type;
    const typeColor = TYPE_COLOR[c.type] ?? "374151";
    const indent = { left: 360 }; // ~0.25in

    // Citation number + title
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, size: 24, color: "6b7280" }),
          new TextRun({ text: c.title, bold: true, size: 24, color: "111827" }),
        ],
        spacing: { before: i === 0 ? 0 : 400, after: 80 },
      }),
    );

    // Reference (italic, monospace-like)
    if (c.reference) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: c.reference, italics: true, size: 20, color: "6b7280" })],
          indent,
          spacing: { after: 80 },
        }),
      );
    }

    // Type badge (small caps)
    children.push(
      new Paragraph({
        children: [new TextRun({ text: typeLabel.toUpperCase(), bold: true, size: 16, color: typeColor, characterSpacing: 80 })],
        indent,
        spacing: { after: 120 },
        shading: { type: ShadingType.SOLID, color: "f8f9fa", fill: "f8f9fa" },
      }),
    );

    // Relevance
    children.push(
      new Paragraph({
        children: [new TextRun({ text: c.relevance, size: 20, color: "374151" })],
        indent,
        spacing: { after: 80 },
        style: "Normal",
      }),
    );
  });

  children.push(rule());

  // ── Enriched document ─────────────────────────────────────────────────────
  if (enrichedDoc && enrichedDoc.trim()) {
    children.push(
      spacer(200, 0),
      new Paragraph({
        children: [new TextRun({ text: "DOCUMENT WITH CITATIONS", bold: true, size: 22, color: "374151", characterSpacing: 120 })],
        spacing: { before: 200, after: 400 },
      }),
    );

    const lines = enrichedDoc.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        children.push(spacer(0, 80));
        continue;
      }
      // Detect heading lines (short lines ending without period and with no citation markers)
      const isHeading = trimmed.length < 80 && !trimmed.includes("[") && /^[A-Z]/.test(trimmed) && !trimmed.endsWith(".");
      children.push(
        new Paragraph({
          children: [new TextRun({
            text: trimmed,
            size: isHeading ? 22 : 20,
            bold: isHeading,
            color: isHeading ? "111827" : "374151",
          })],
          spacing: { before: isHeading ? 240 : 0, after: isHeading ? 120 : 80 },
        }),
      );
    }

    children.push(rule());
  }

  // ── Disclaimer ────────────────────────────────────────────────────────────
  children.push(
    spacer(200, 120),
    new Paragraph({
      children: [new TextRun({
        text: "This report was produced by RATIO — an AI legal reasoning auditor. It does not constitute legal advice. "
            + "All sources and citations should be independently verified by a qualified solicitor before reliance.",
        size: 16, color: "9ca3af", italics: true,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 400 },
    }),
  );

  const doc = new Document({
    title: reportTitle,
    creator: "RATIO Legal AI",
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: { font: "Calibri", size: 20, color: "374151" },
          paragraph: { spacing: { line: 276 } }, // 1.15 line spacing
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }, // ~0.75in margins
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="ratio-sources-${Date.now()}.docx"`,
    },
  });
}
