// EU Publications Office Cellar API client
// Fetches DORA text once and caches it in memory for the process lifetime

const SPARQL_ENDPOINT = "https://publications.europa.eu/webapi/rdf/sparql";
const CELLAR_REST = "https://publications.europa.eu/resource/cellar";

const DORA_CELEX = "32022R2554";

let doraTextCache: string | null = null;

async function sparqlQuery(query: string): Promise<Record<string, { value: string }>[]> {
  const res = await fetch(SPARQL_ENDPOINT, {
    method: "GET",
    headers: { Accept: "application/sparql-results+json" },
    signal: AbortSignal.timeout(60_000),
    next: { revalidate: 3600 },
    cache: "force-cache",
  } as RequestInit & { next?: { revalidate: number } });

  if (!res.ok) throw new Error(`SPARQL error: ${res.status}`);
  const json = await res.json();
  return json.results.bindings;
}

export async function fetchDoraText(): Promise<string> {
  if (doraTextCache) return doraTextCache;

  // Step 1: resolve CELEX → cellar ID
  const bindings = await sparqlQuery(`
    PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
    SELECT ?cellar_id WHERE {
      ?work cdm:resource_legal_id_celex "${DORA_CELEX}" ;
            cdm:resource_legal_eli ?cellar_id .
    } LIMIT 1
  `);

  if (!bindings.length) throw new Error("Could not find DORA in Cellar");

  const eli = bindings[0].cellar_id.value;
  // ELI looks like https://data.europa.eu/eli/reg/2022/2554/oj
  // Cellar REST uses the path after the last slash
  const cellarId = eli.split("/").slice(-3).join("/");

  // Step 2: fetch the actual document text
  const docRes = await fetch(`${CELLAR_REST}/${cellarId}`, {
    headers: { Accept: "text/html,application/xhtml+xml" },
    next: { revalidate: 3600 },
    cache: "force-cache",
  } as RequestInit & { next?: { revalidate: number } });

  if (!docRes.ok) throw new Error(`Cellar fetch error: ${docRes.status}`);

  doraTextCache = await docRes.text();
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
  // Try to find the article section in HTML/XHTML
  const regex = new RegExp(
    `Article\\s+${articleNum.replace(/[()]/g, "\\$&")}[^<]*?</[^>]+>([\\s\\S]*?)(?=Article\\s+\\d|$)`,
    "i"
  );
  const match = doraText.match(regex);
  if (match) return match[0].replace(/<[^>]+>/g, " ").trim().slice(0, 2000);

  // Fallback: return surrounding context
  const idx = doraText.indexOf(`Article ${articleNum}`);
  if (idx === -1) return `Article ${articleNum} not found in fetched text.`;
  return doraText.slice(idx, idx + 2000).replace(/<[^>]+>/g, " ").trim();
}
