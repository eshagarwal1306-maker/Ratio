// EU Publications Office Cellar API + EUR-Lex client
// Fetches DORA text once and caches it in memory for the process lifetime

const SPARQL_ENDPOINT = "https://publications.europa.eu/webapi/rdf/sparql";
const DORA_CELEX = "32022R2554";

let doraTextCache: string | null = null;

async function sparqlQuery(query: string): Promise<Record<string, { value: string }>[]> {
  const url = new URL(SPARQL_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("format", "application/sparql-results+json");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/sparql-results+json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`SPARQL error: ${res.status}`);
  const json = await res.json();
  return json.results.bindings;
}

// Fetch DORA full text from EUR-Lex (more reliable than Cellar REST)
export async function fetchDoraText(): Promise<string> {
  if (doraTextCache) return doraTextCache;

  const res = await fetch(
    `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:${DORA_CELEX}`,
    {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "GAVEL/1.0 Legal Research Tool",
      },
      signal: AbortSignal.timeout(20_000),
    }
  );

  if (!res.ok) throw new Error(`EUR-Lex fetch error: ${res.status}`);
  doraTextCache = await res.text();
  return doraTextCache;
}

export async function checkAmendments(celexId: string): Promise<{
  inForce: boolean;
  amendments: string[];
}> {
  const [forceBindings, amendBindings] = await Promise.all([
    sparqlQuery(`
      PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
      SELECT ?in_force WHERE {
        ?act cdm:resource_legal_id_celex "${celexId}" ;
             cdm:resource_legal_in-force ?in_force .
      } LIMIT 1
    `),
    sparqlQuery(`
      PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
      SELECT ?amending_act WHERE {
        ?act cdm:resource_legal_id_celex "${celexId}" .
        ?amending cdm:resource_legal_amends_resource_legal ?act ;
                  cdm:resource_legal_id_celex ?amending_act .
      }
    `),
  ]);

  const inForce = forceBindings[0]?.in_force?.value === "true";
  const amendments = amendBindings.map((b) => b.amending_act.value);

  return { inForce, amendments };
}

// Extract a specific article from DORA text by article number
export function extractArticle(doraText: string, articleNum: string): string {
  const regex = new RegExp(
    `Article\\s+${articleNum.replace(/[()]/g, "\\$&")}[^<]*?</[^>]+>([\\s\\S]*?)(?=Article\\s+\\d|$)`,
    "i"
  );
  const match = doraText.match(regex);
  if (match) return match[0].replace(/<[^>]+>/g, " ").trim().slice(0, 2000);

  const idx = doraText.indexOf(`Article ${articleNum}`);
  if (idx === -1) return `Article ${articleNum} not found in fetched text.`;
  return doraText.slice(idx, idx + 2000).replace(/<[^>]+>/g, " ").trim();
}
