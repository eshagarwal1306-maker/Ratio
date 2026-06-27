// ScraperAgent — dedicated legal research scraper
// Uses Firecrawl to scrape Bailii (UK/EU case law) and general legal sources.
// Called as a subagent by DevilsAdvocate and the Orchestrator.

import { anthropic } from "@ai-sdk/anthropic";
import { ToolLoopAgent, tool, isStepCount } from "ai";
import { z } from "zod";
import { FirecrawlClient } from "@mendable/firecrawl-js";

function getFirecrawl() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;
  return new FirecrawlClient({ apiKey });
}

// ── Bailii search + scrape ────────────────────────────────────────────────────
// Bailii search endpoint: https://www.bailii.org/cgi-bin/basql.cgi
// Returns a results page; we scrape the top case links and then scrape each case.

const searchBailiiTool = tool({
  description:
    "Search Bailii (bailii.org) for UK and EU case law by keyword, case name, or citation. Returns scraped text of the top matching cases. Use for finding real precedents, holdings, and judicial reasoning.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Search terms, e.g. 'DORA ICT outsourcing scope UK firm' or 'Caparo Industries duty of care'"
      ),
    maxCases: z
      .number()
      .min(1)
      .max(5)
      .default(3)
      .describe("Maximum number of cases to scrape (1-5)"),
  }),
  execute: async ({ query, maxCases }) => {
    const fc = getFirecrawl();
    if (!fc) {
      return {
        found: false,
        cases: [],
        note: "Firecrawl unavailable (no FIRECRAWL_API_KEY). Set it in .env.local.",
      };
    }

    try {
      // Step 1: Scrape Bailii search results page
      const searchUrl = `https://www.bailii.org/cgi-bin/basql.cgi?method=boolean&query=${encodeURIComponent(query)}&db=all&highlight=1&meta=%2F`;
      const searchPage = await fc.scrape(searchUrl, {
        formats: ["markdown"],
      });

      const markdown = (searchPage as any)?.markdown ?? "";

      // Step 2: Extract case links from the results page
      const caseLinks: string[] = [];
      const linkRegex = /https?:\/\/www\.bailii\.org\/[^\s\)\"\']+\.html/g;
      const matches = markdown.match(linkRegex) ?? [];
      for (const link of matches) {
        // Filter to actual case pages (not index pages)
        if (
          link.includes("/cases/") &&
          !caseLinks.includes(link) &&
          caseLinks.length < maxCases
        ) {
          caseLinks.push(link);
        }
      }

      if (caseLinks.length === 0) {
        return {
          found: false,
          cases: [],
          note: `No cases found on Bailii for: "${query}"`,
          searchPreview: markdown.slice(0, 500),
        };
      }

      // Step 3: Scrape each case page
      const cases = await Promise.all(
        caseLinks.map(async (url) => {
          try {
            const page = await fc.scrape(url, {
              formats: ["markdown"],
            });
            const text = ((page as any)?.markdown ?? "").slice(0, 4000);
            return { url, text };
          } catch {
            return { url, text: "(scrape failed)" };
          }
        })
      );

      return { found: true, cases, query };
    } catch (err) {
      return {
        found: false,
        cases: [],
        note: `Bailii search failed: ${String(err)}`,
      };
    }
  },
});

// ── Scrape any URL ────────────────────────────────────────────────────────────

const scrapeUrlTool = tool({
  description:
    "Scrape any URL and return its content as clean markdown. Use for fetching specific case pages, regulatory documents, or legal commentary you already have a URL for.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to scrape"),
  }),
  execute: async ({ url }) => {
    const fc = getFirecrawl();
    if (!fc) {
      return { success: false, content: "", note: "Firecrawl unavailable (no FIRECRAWL_API_KEY)" };
    }
    try {
      const result = await fc.scrape(url, { formats: ["markdown"] });
      const content = ((result as any)?.markdown ?? "").slice(0, 5000);
      return { success: true, url, content };
    } catch (err) {
      return { success: false, url, content: "", note: String(err) };
    }
  },
});

// ── Web search via Firecrawl ──────────────────────────────────────────────────

const searchWebTool = tool({
  description:
    "Search the web for legal sources: cases, regulatory guidance, academic commentary. Returns scraped content of top results. Use for broad legal research when you need to find authorities you don't yet have URLs for.",
  inputSchema: z.object({
    query: z.string().describe("Legal research query"),
    limit: z.number().min(1).max(5).default(3).describe("Number of results"),
  }),
  execute: async ({ query, limit }) => {
    const fc = getFirecrawl();
    if (!fc) {
      return { results: [], note: "Firecrawl unavailable (no FIRECRAWL_API_KEY)" };
    }
    try {
      const results = await fc.search(query, {
        limit,
        scrapeOptions: { formats: ["markdown"] },
      } as any);

      const items = ((results as any)?.data ?? []).map((r: any) => ({
        url: r.url,
        title: r.title,
        content: (r.markdown ?? r.description ?? "").slice(0, 2000),
      }));

      return { results: items, query };
    } catch (err) {
      return { results: [], note: `Web search failed: ${String(err)}` };
    }
  },
});

// ── The ScraperAgent ──────────────────────────────────────────────────────────

export const scraperAgent = new ToolLoopAgent({
  model: anthropic("claude-sonnet-4-6"),
  instructions: `You are a legal research scraper with access to:
- searchBailii: search UK and EU case law on Bailii (bailii.org)
- scrapeUrl: scrape any specific URL to get its full content
- searchWeb: general web search for legal sources

Your job: find REAL legal authorities relevant to the research task.

Strategy:
1. Start with searchBailii for case law research
2. Use searchWeb for regulatory guidance, commentary, or non-UK/EU sources
3. Use scrapeUrl when you have a specific URL to follow up on
4. Synthesize what you found into a clear, structured summary

Always include:
- The actual authority name (case name + citation, or regulation name)
- The relevant holding or provision
- Why it matters for the research task
- The URL you found it at

Do not invent sources. If you cannot find relevant authorities, say so clearly.`,
  tools: {
    searchBailii: searchBailiiTool,
    scrapeUrl: scrapeUrlTool,
    searchWeb: searchWebTool,
  },
  stopWhen: isStepCount(8), // enough for 2-3 searches + scraping
});

export async function runScraper(task: string): Promise<string> {
  const { text } = await scraperAgent.generate({ prompt: task });
  return text;
}
