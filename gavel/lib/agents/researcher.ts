import { anthropic } from "@ai-sdk/anthropic";
import { ToolLoopAgent, Output, isStepCount, tool } from "ai";
import { z } from "zod";
import { webSearchTool, sparqlQueryTool, fetchCellarArticleTool } from "../tools";

const ResearchOutputSchema = z.object({
  title: z.string().describe("Short title for the research report"),
  summary: z.string().describe("2-3 sentence executive summary of findings"),
  keyAuthorities: z.array(z.string()).describe("List of key legal authorities found"),
  gaps: z.array(z.string()).describe("Areas where research was inconclusive or sources unavailable"),
});

export const addCitationTool = tool({
  description:
    "Record a confirmed research finding with its cited sources. Call this once per distinct finding as you build up the research report.",
  inputSchema: z.object({
    title: z.string().describe("Short title for this finding"),
    finding: z.string().describe("The substantive finding in 2-4 sentences"),
    sources: z.array(z.string()).describe("Source names: 'gmail', 'harvey', 'lexis', 'notion', 'teams', 'web', 'eu-cellar', 'eur-lex'"),
    confidence: z.enum(["high", "medium", "low"]),
    articleRef: z.string().optional().describe("Specific article reference if applicable"),
  }),
  execute: async (args) => ({ ...args, recorded: true }),
});

// Factory — creates a per-request researcher with closure over indexed firm docs
export function createResearcher(indexedDocs: Array<{ source: string; title: string; snippet: string; tags: string[] }>) {
  const searchLocalDocsTool = tool({
    description:
      "Search the firm's indexed knowledge base (emails, past matters, memos, research) for documents relevant to the query.",
    inputSchema: z.object({
      query: z.string().describe("Keywords or legal concepts to search for"),
    }),
    execute: async ({ query }) => {
      const q = query.toLowerCase();
      const results = indexedDocs.filter(
        (d) =>
          d.snippet.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
      );
      return {
        results: results.slice(0, 6).map((d) => ({
          source: d.source,
          title: d.title,
          snippet: d.snippet,
          tags: d.tags,
        })),
        total: results.length,
      };
    },
  });

  return new ToolLoopAgent({
    model: anthropic("claude-opus-4-8"),
    providerOptions: {
      anthropic: {
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
      },
    },
    instructions: `You are a legal research AI. Research the given question exhaustively using all available tools.

Tools available:
- searchLocalDocs: search firm's indexed documents (emails, past matters, memos, research notes)
- webSearch: real-time Perplexity web search for cases, regulations, and commentary
- sparqlQuery: EU Cellar SPARQL endpoint for regulatory metadata and amendment history
- fetchCellarArticle: retrieve verbatim article text from EUR-Lex
- addCitation: record each confirmed finding with its sources

Research methodology:
1. Start with searchLocalDocs to find existing firm positions on the topic
2. Run targeted webSearch queries for real legal authorities (cases, regulations, guidance)
3. Use sparqlQuery for EU regulatory metadata if relevant to the query
4. For each confirmed finding, call addCitation — cite real sources only
5. Synthesise findings into a final report

Quality rules:
- Only cite REAL, verifiable authorities found through research
- Never invent cases or regulations
- If a source contradicts another, record both and flag the conflict
- Mark confidence honestly: high = verified from primary source, medium = secondary, low = inference`,
    tools: {
      searchLocalDocs: searchLocalDocsTool,
      webSearch: webSearchTool,
      sparqlQuery: sparqlQueryTool,
      fetchCellarArticle: fetchCellarArticleTool,
      addCitation: addCitationTool,
    },
    output: Output.object({ schema: ResearchOutputSchema }),
    stopWhen: isStepCount(16),
  });
}
