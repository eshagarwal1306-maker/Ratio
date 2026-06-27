import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import mammoth from "mammoth";

export const maxDuration = 60;

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const name = file.name.toLowerCase();

  // Plain text — just read it
  if (name.endsWith(".txt")) {
    const text = await file.text();
    return Response.json({ text });
  }

  // Word document — use mammoth to extract raw text
  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    return Response.json({ text: result.value });
  }

  // PDF — use Claude's native PDF reading
  if (name.endsWith(".pdf")) {
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file" as const,
              data: base64,
              mediaType: "application/pdf" as const,
            },
            {
              type: "text",
              text: "Extract all the text from this legal document exactly as written. Return only the document text — no commentary, no formatting changes, no introduction.",
            },
          ],
        },
      ],
    });

    return Response.json({ text });
  }

  return Response.json(
    { error: "Unsupported file type. Please upload a PDF, Word (.docx), or plain text file." },
    { status: 400 }
  );
}
