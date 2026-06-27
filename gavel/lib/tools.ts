// Shared tool definitions used across GAVEL agents
// Each tool wraps an external API call the agent can invoke itself

import { tool } from "ai";
import { z } from "zod";
import { fetchDoraText, extractArticle, checkAmendments } from "./eu-cellar";

// ── EU Cellar tools ─────────────────────────────────────────────────────────

export const fetchCellarArticleTool = tool({
  description:
    "Fetch the verbatim text of a specific article from an EU regulation via the EU Publications Office Cellar API. Use this to verify what a regulation actually says.",
  inputSchema: z.object({
    celex: z
      .string()
      .describe("CELEX number of the regulation, e.g. '32022R2554' for DORA"),
    article: z
      .string()
      .describe("Article number to extract, e.g. '30(3)' or '2'"),
  }),
  execute: async ({ celex, article }) => {
    try {
      // For now we only have DORA text cached — extend as needed
      const doraText = await fetchDoraText();
      const text = extractArticle(doraText, article);
      return { found: true, article, text: text.slice(0, 3000) };
    } catch (err) {
      return { found: false, article, text: "", error: String(err) };
    }
  },
});

export const checkAmendmentsTool = tool({
  description:
    "Check whether an EU regulation has been amended and whether it is still in force, using the EU Publications Office Cellar SPARQL endpoint.",
  inputSchema: z.object({
    celex: z
      .string()
      .describe("CELEX number of the regulation to check, e.g. '32022R2554'"),
  }),
  execute: async ({ celex }) => {
    try {
      const { inForce, amendments } = await checkAmendments(celex);
      return { celex, inForce, amendments, found: true };
    } catch (err) {
      return {
        celex,
        inForce: null,
        amendments: [],
        found: false,
        error: String(err),
      };
    }
  },
});

// ── Web search tool ──────────────────────────────────────────────────────────

export const webSearchTool = tool({
  description:
    "Search the web for real legal authorities, cases, regulatory guidance, or academic commentary. Use this to find counter-arguments and verify whether cited legal instruments exist.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Search query — be specific, e.g. 'EBA guidelines ICT outsourcing DORA counter-authority'"
      ),
  }),
  execute: async ({ query }) => {
    if (!process.env.PERPLEXITY_API_KEY) {
      return {
        results: [],
        note: "Web search unavailable (no PERPLEXITY_API_KEY) — use your training knowledge instead.",
      };
    }

    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            {
              role: "user",
              content: `Search for real legal authorities related to: ${query}. Return only real, verifiable legal instruments (cases, regulations, guidelines). Include the authority name and a brief summary of its relevance.`,
            },
          ],
          max_tokens: 800,
        }),
      });

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content ?? "";
      return { results: content, note: "Live web search via Perplexity" };
    } catch (err) {
      return { results: [], note: `Search failed: ${String(err)}` };
    }
  },
});

// ── SPARQL query tool (general) ──────────────────────────────────────────────

export const sparqlQueryTool = tool({
  description:
    "Run a SPARQL query against the EU Publications Office Cellar endpoint to retrieve metadata about EU legal acts — useful for finding related acts, amendment chains, or scope provisions.",
  inputSchema: z.object({
    query: z.string().describe("A valid SPARQL SELECT query using CDM ontology"),
  }),
  execute: async ({ query }) => {
    const SPARQL_ENDPOINT = "https://publications.europa.eu/webapi/rdf/sparql";
    try {
      const res = await fetch(
        `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=application/sparql-results+json`,
        {
          headers: { Accept: "application/sparql-results+json" },
          signal: AbortSignal.timeout(30_000),
        }
      );
      if (!res.ok) return { error: `SPARQL error ${res.status}`, bindings: [] };
      const json = await res.json();
      return { bindings: json.results.bindings.slice(0, 20) };
    } catch (err) {
      return { error: String(err), bindings: [] };
    }
  },
});
