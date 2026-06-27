import { NextResponse } from "next/server";
export const maxDuration = 30;

export async function GET() {
  const results: Record<string, unknown> = {};

  // Test EU Cellar SPARQL (fixed with ?query= param)
  try {
    const url = new URL("https://publications.europa.eu/webapi/rdf/sparql");
    url.searchParams.set("query", `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT ?in_force WHERE {
  ?act cdm:resource_legal_id_celex "32022R2554" ;
       cdm:resource_legal_in-force ?in_force .
} LIMIT 1`);
    url.searchParams.set("format", "application/sparql-results+json");
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/sparql-results+json" },
      signal: AbortSignal.timeout(10_000),
    });
    const json = await res.json();
    results.cellar_sparql = {
      status: res.ok ? "OK" : "FAIL",
      httpStatus: res.status,
      bindings: json?.results?.bindings?.slice(0, 3) ?? [],
    };
  } catch (e) {
    results.cellar_sparql = { status: "ERROR", error: String(e) };
  }

  // Test EUR-Lex DORA text
  try {
    const res = await fetch(
      "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32022R2554",
      {
        headers: { Accept: "text/html", "User-Agent": "GAVEL/1.0 Legal Research Tool" },
        signal: AbortSignal.timeout(15_000),
      }
    );
    const text = await res.text();
    const hasArt30 = text.includes("Article 30") || text.includes("article 30");
    results.eurlex = {
      status: res.ok ? "OK" : "FAIL",
      httpStatus: res.status,
      charsFetched: text.length,
      containsArticle30: hasArt30,
    };
  } catch (e) {
    results.eurlex = { status: "ERROR", error: String(e) };
  }

  // Test Perplexity (Devil's Advocate web search)
  if (process.env.PERPLEXITY_API_KEY) {
    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-large-128k-online",
          messages: [{ role: "user", content: "Name one real EU regulation about ICT risk management in finance." }],
          max_tokens: 80,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json();
      results.perplexity = {
        status: res.ok ? "OK" : "FAIL",
        httpStatus: res.status,
        response: data?.choices?.[0]?.message?.content?.slice(0, 150),
      };
    } catch (e) {
      results.perplexity = { status: "ERROR", error: String(e) };
    }
  } else {
    results.perplexity = { status: "SKIP", note: "No PERPLEXITY_API_KEY" };
  }

  return NextResponse.json(results, { status: 200 });
}
