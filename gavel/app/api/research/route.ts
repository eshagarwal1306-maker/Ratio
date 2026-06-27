import { createAgentUIStreamResponse } from "ai";
import { createResearcher } from "@/lib/agents/researcher";

export const maxDuration = 300;

export async function POST(request: Request) {
  const { messages, indexedDocs } = await request.json();

  const researcher = createResearcher(indexedDocs ?? []);

  try {
    return await createAgentUIStreamResponse({
      agent: researcher,
      uiMessages: messages ?? [],
      onError: (err) => {
        console.error("Research stream error:", err);
        return err instanceof Error ? err.message : String(err);
      },
    });
  } catch (err) {
    console.error("Research route error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
