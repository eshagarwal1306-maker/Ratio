import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType,
} from "docx";

export const maxDuration = 30;

const TYPE_LABEL: Record<string, string> = {
  legislation:         "Legislation",
  case_law:            "Case Law",
  practitioners_guide: "Practice Guide",
  academic:            "Academic",
};

interface Citation {
  title: string;
  reference: string;
  type: string;
  relevance: string;
}

export async function POST(req: Request) {
  const { citations, enrichedDoc, docTitle }: {
    citations: Citation[];
    enrichedDoc?: string;
    docTitle?: string;
  } = await req.json();

  const title = docTitle ?? "RATIO Source Discovery Report";
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 36, color: "0d1f3c" })],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: `Generated: ${dateStr}  |  Sources found: ${citations.length}`,
        size: 18, color: "6b7280",
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Sources Found", bold: true, size: 28 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
  ];

  // Citation table
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Type", bold: true, size: 16 })] })], width: { size: 14, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Title", bold: true, size: 16 })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Reference", bold: true, size: 16 })] })], width: { size: 26, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Relevance", bold: true, size: 16 })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
    ],
  });

  const dataRows = citations.map((c) =>
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: TYPE_LABEL[c.type] ?? c.type, size: 16, color: "374151" })] })], width: { size: 14, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c.title, bold: true, size: 16 })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c.reference, size: 15, color: "6b7280" })] })], width: { size: 26, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c.relevance, size: 15, color: "4b5563" })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
      ],
    })
  );

  children.push(
    new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }) as unknown as Paragraph,
  );

  // Enriched document section
  if (enrichedDoc) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Document with Citations", bold: true, size: 28 })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 600, after: 200 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: "e5e7eb" } },
      }),
    );

    const lines = enrichedDoc.split("\n");
    for (const line of lines) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 18, color: "374151" })],
          spacing: { after: 100 },
        }),
      );
    }
  }

  children.push(
    new Paragraph({
      children: [new TextRun({
        text: "This report was produced by RATIO — an AI legal reasoning auditor. It does not constitute legal advice. All sources should be verified by a qualified solicitor.",
        size: 14, color: "9ca3af", italics: true,
      })],
      spacing: { before: 800 },
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
      "Content-Disposition": `attachment; filename="ratio-sources-${Date.now()}.docx"`,
    },
  });
}
