import Firecrawl from "@mendable/firecrawl-js";

export const maxDuration = 30;

const EU_REGS = /DORA|MiFID|GDPR|AIFMD|CRR|MAR|SFDR|EMIR|PRIIPS|UCITS|BRRD|SRMR|ESMA|EBA\b/i;

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });

const DOMAIN_MAP: Record<string, string> = {
  case_law:            "bailii.org",
  practitioners_guide: "legislation.gov.uk",
};

function getDomain(type: string, ref: string, title: string): string {
  if (DOMAIN_MAP[type]) return DOMAIN_MAP[type];
  if (type === "legislation") {
    return EU_REGS.test(ref + title) ? "eur-lex.europa.eu" : "legislation.gov.uk";
  }
  return "";
}

function cleanMarkdown(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, "")                    // strip images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")            // flatten links
    .replace(/^#{1,6}\s+/gm, "")                         // strip headings
    .replace(/\*\*([^*]+)\*\*/g, "$1")                  // strip bold
    .replace(/\*([^*]+)\*/g, "$1")                       // strip italic
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1))         // strip inline code
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: Request) {
  const { title, reference, type }: {
    title: string;
    reference: string;
    type: string;
  } = await req.json();

  const domain = getDomain(type, reference, title);
  const query = [title, reference].filter(Boolean).join(" ").trim();

  async function doSearch(includeDomain: string | null) {
    return firecrawl.search(query, {
      limit: 1,
      ...(includeDomain ? { includeDomains: [includeDomain] } : {}),
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    });
  }

  try {
    let result = await doSearch(domain || null);
    let docs = result.web ?? [];

    // If domain-scoped search found nothing, retry without restriction
    if (!docs.length && domain) {
      result = await doSearch(null);
      docs = result.web ?? [];
    }

    if (!docs.length) {
      return Response.json({ found: false });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = docs[0] as any;
    const url: string = doc.metadata?.sourceURL ?? doc.url ?? "";
    if (!url) return Response.json({ found: false });

    let hostname = "";
    try { hostname = new URL(url).hostname.replace(/^www\./, ""); } catch { /* ok */ }

    const markdown: string = doc.markdown ?? "";
    const snippet = cleanMarkdown(markdown).slice(0, 700);
    const pageTitle: string = doc.metadata?.title ?? doc.title ?? title;
    const favicon: string = doc.metadata?.favicon ?? `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`;

    return Response.json({ found: true, url, domain: hostname, title: pageTitle, snippet, favicon });
  } catch (err) {
    console.error("verify-source error:", err);
    return Response.json({ found: false });
  }
}
