"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Mock corpus ───────────────────────────────────────────────────────────────

const MOCK_GMAIL: RawDoc[] = [
  {
    id: "gm-1",
    title: "Re: TechFinance DORA Compliance — URGENT",
    from: "j.richardson@gavel-law.com",
    date: "15 Mar 2024",
    snippet:
      "UK-incorporated firms without EU establishment are OUTSIDE DORA scope per Article 2. Our March 2024 advisory to TechFinance Ltd confirms this position.",
    tags: ["DORA", "jurisdiction", "UK", "out-of-scope"],
  },
  {
    id: "gm-2",
    title: "FW: EBA Guidelines ICT Risk — review needed",
    from: "legal@techfinance.com",
    date: "22 Jan 2024",
    snippet:
      "EBA/GL/2019/04 remains the applicable ICT risk standard for UK firms post-Brexit, onshored into FCA SYSC requirements. DORA does not apply.",
    tags: ["EBA", "ICT", "UK", "FCA", "SYSC"],
  },
  {
    id: "gm-3",
    title: "DORA Article 2 Scope Analysis — Final",
    from: "compliance@gavel-law.com",
    date: "10 Dec 2023",
    snippet:
      "Article 2(1) closed list requires EU authorisation or EU establishment. Post-Brexit UK entities without EU nexus are outside scope. FSMA 2023 governs.",
    tags: ["DORA", "Article 2", "scope"],
  },
  {
    id: "gm-4",
    title: "Client alert: DORA Article 50 penalty clarification",
    from: "partner@gavel-law.com",
    date: "5 Nov 2023",
    snippet:
      "DORA Article 50 governs critical ICT third-party providers (CTPPs) — NOT a 2% turnover fine on financial entities. That figure conflates DORA with GDPR.",
    tags: ["DORA", "Article 50", "penalties", "CTPP"],
  },
  {
    id: "gm-5",
    title: "Research: ICT Sub-outsourcing Article 30",
    from: "associates@gavel-law.com",
    date: "8 Feb 2024",
    snippet:
      "DORA Article 30 sub-outsourcing requirements only engage once Article 2 scope is met. UK-only entity → Article 30 is irrelevant.",
    tags: ["DORA", "Article 30", "sub-outsourcing"],
  },
];

const MOCK_HARVEY: RawDoc[] = [
  {
    id: "hv-1",
    title: "TechFinance Ltd — DORA Scope Advisory",
    date: "March 2024",
    snippet:
      "Harvey AI analysis: UK-only fintech confirmed outside DORA Article 2 scope. Recommended SYSC 8.1 framework instead of DORA compliance programme.",
    tags: ["DORA", "UK", "fintech", "scope"],
  },
  {
    id: "hv-2",
    title: "EU/UK Regulatory Divergence Post-Brexit",
    date: "January 2024",
    snippet:
      "DORA (EU) vs FCA SYSC + operational resilience rules (UK). Critical distinction: DORA applies only to EU-authorised entities.",
    tags: ["Brexit", "DORA", "FCA", "divergence"],
  },
  {
    id: "hv-3",
    title: "ICT Contract Review — Nexus Capital (EU subsidiary)",
    date: "November 2023",
    snippet:
      "Nexus Capital has EU subsidiary → in DORA scope. Revised 12 contractual provisions to comply with Article 30(2). Penalty exposure: up to 1% daily turnover for CTPPs.",
    tags: ["DORA", "Article 30", "ICT", "contracts"],
  },
];

const MOCK_LEXIS: RawDoc[] = [
  {
    id: "lx-1",
    title: "DORA Scope: Who Is Covered?",
    date: "2024",
    snippet:
      "Comprehensive analysis of DORA Article 2 closed list. Only EU-authorised or EU-established entities covered. UK firms post-Brexit outside scope absent EU establishment.",
    tags: ["DORA", "scope", "EU"],
  },
  {
    id: "lx-2",
    title: "ICT Risk: EBA/GL/2019/04 vs DORA — Comparative",
    date: "2024",
    snippet:
      "EBA/GL/2019/04 remains UK standard under SYSC onshoring. DORA introduces new EU regime from Jan 2025. Material differences in sub-outsourcing chain management.",
    tags: ["EBA", "DORA", "ICT", "UK"],
  },
];

const MOCK_NOTION: RawDoc[] = [
  {
    id: "nt-1",
    title: "GAVEL Internal Wiki — DORA FAQ",
    date: "2024",
    snippet:
      "Q: Does DORA apply to UK fintech clients? A: No, unless they have EU establishment or EU-authorised subsidiary. See TechFinance advisory March 2024.",
    tags: ["DORA", "FAQ", "UK"],
  },
  {
    id: "nt-2",
    title: "Precedent Library — ICT Outsourcing Clauses",
    date: "Feb 2024",
    snippet:
      "Standard ICT outsourcing clause library: DORA-compliant variants (EU entities) and non-DORA UK variants. Cross-referenced to EBA/GL/2019/04.",
    tags: ["ICT", "clauses", "precedent"],
  },
];

const MOCK_TEAMS: RawDoc[] = [
  {
    id: "tm-1",
    title: "General Counsel Channel — DORA update thread",
    date: "Jan 2025",
    snippet:
      "Thread summary: UK firms confirmed out of scope for DORA application date (17 Jan 2025). UK operational resilience regime applies instead.",
    tags: ["DORA", "UK", "update"],
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawDoc {
  id: string;
  title: string;
  date?: string;
  from?: string;
  snippet: string;
  tags: string[];
}

export interface IndexedDoc {
  id: string;
  source: ConnectorId;
  title: string;
  snippet: string;
  tags: string[];
  indexedAt: Date;
}

type ConnectorId = "gmail" | "harvey" | "lexis" | "notion" | "teams";
type ConnectorStatus = "idle" | "connecting" | "connected";

interface ConnectorState {
  status: ConnectorStatus;
  docCount: number;
}

// ── Connector metadata ────────────────────────────────────────────────────────

const CONNECTOR_DEFS: Array<{
  id: ConnectorId;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  type: "real" | "simulated";
  desc: string;
  docs: () => RawDoc[];
}> = [
  {
    id: "gmail",
    name: "Gmail",
    icon: "✉",
    color: "#ea4335",
    bgColor: "#ea433510",
    type: "real",
    desc: "Email threads & attachments",
    docs: () => MOCK_GMAIL,
  },
  {
    id: "harvey",
    name: "Harvey AI",
    icon: "⚡",
    color: "#7c3aed",
    bgColor: "#7c3aed10",
    type: "simulated",
    desc: "Past matter summaries",
    docs: () => MOCK_HARVEY,
  },
  {
    id: "lexis",
    name: "Lexis+",
    icon: "⊟",
    color: "#0ea5e9",
    bgColor: "#0ea5e910",
    type: "simulated",
    desc: "Research memos & annotations",
    docs: () => MOCK_LEXIS,
  },
  {
    id: "notion",
    name: "Notion",
    icon: "▣",
    color: "#94a3b8",
    bgColor: "#94a3b810",
    type: "simulated",
    desc: "Internal wikis & notes",
    docs: () => MOCK_NOTION,
  },
  {
    id: "teams",
    name: "MS Teams",
    icon: "◫",
    color: "#6264a7",
    bgColor: "#6264a710",
    type: "simulated",
    desc: "Channel threads & files",
    docs: () => MOCK_TEAMS,
  },
];

// ── Gmail OAuth simulation modal ──────────────────────────────────────────────

function GmailOAuthModal({ onAllow, onCancel }: { onAllow: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#202124] border border-zinc-700 rounded-2xl w-80 overflow-hidden shadow-2xl">
        {/* Google branding bar */}
        <div className="bg-[#1a73e8] px-5 py-3 flex items-center gap-2">
          <span className="text-white font-bold text-sm">Google</span>
          <span className="text-blue-200 text-xs">Sign in</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-full bg-[#ea4335]/20 flex items-center justify-center mx-auto text-2xl">✉</div>
            <p className="text-sm font-semibold text-zinc-100">GAVEL Legal Auditor</p>
            <p className="text-[11px] text-zinc-400">wants access to your Google Account</p>
            <p className="text-[10px] text-zinc-600 font-mono">sahidmunjavar.s@gmail.com</p>
          </div>
          <div className="border border-zinc-700 rounded-lg p-3 space-y-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Permissions requested</p>
            {["Read Gmail messages", "Read Gmail metadata", "Read-only access"].map((p) => (
              <div key={p} className="flex items-center gap-2">
                <span className="text-emerald-400 text-xs">✓</span>
                <span className="text-[11px] text-zinc-300">{p}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2 rounded-lg border border-zinc-700 text-[11px] text-zinc-400 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onAllow}
              className="flex-1 py-2 rounded-lg bg-[#1a73e8] text-[11px] text-white font-semibold hover:bg-[#1557b0] transition-colors"
            >
              Allow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main SourcesPanel component ───────────────────────────────────────────────

export function SourcesPanel({
  onIndexed,
}: {
  onIndexed: (docs: IndexedDoc[]) => void;
}) {
  const [connectors, setConnectors] = useState<Record<ConnectorId, ConnectorState>>({
    gmail:  { status: "idle", docCount: 0 },
    harvey: { status: "idle", docCount: 0 },
    lexis:  { status: "idle", docCount: 0 },
    notion: { status: "idle", docCount: 0 },
    teams:  { status: "idle", docCount: 0 },
  });
  const [showGmailOAuth, setShowGmailOAuth] = useState(false);
  const [indexedDocs, setIndexedDocs] = useState<IndexedDoc[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const notify = useCallback(onIndexed, []);

  useEffect(() => {
    notify(indexedDocs);
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [indexedDocs, notify]);

  async function ingestDocs(id: ConnectorId, rawDocs: RawDoc[]) {
    setIsIndexing(true);
    for (const doc of rawDocs) {
      await delay(350);
      setIndexedDocs((prev) => [
        ...prev,
        {
          id: doc.id,
          source: id,
          title: doc.title,
          snippet: doc.snippet,
          tags: doc.tags,
          indexedAt: new Date(),
        },
      ]);
    }
    setIsIndexing(false);
  }

  async function handleConnect(id: ConnectorId) {
    if (connectors[id].status !== "idle") return;

    if (id === "gmail") {
      // Show simulated OAuth modal
      setShowGmailOAuth(true);
      return;
    }

    // Simulated sources: connect immediately
    setConnectors((prev) => ({ ...prev, [id]: { status: "connecting", docCount: 0 } }));
    await delay(800);
    const def = CONNECTOR_DEFS.find((d) => d.id === id)!;
    const docs = def.docs();
    setConnectors((prev) => ({ ...prev, [id]: { status: "connected", docCount: docs.length } }));
    await ingestDocs(id, docs);
  }

  async function handleGmailAllow() {
    setShowGmailOAuth(false);
    setConnectors((prev) => ({ ...prev, gmail: { status: "connecting", docCount: 0 } }));
    await delay(1200); // simulate auth token exchange
    const docs = MOCK_GMAIL;
    setConnectors((prev) => ({ ...prev, gmail: { status: "connected", docCount: docs.length } }));
    await ingestDocs("gmail", docs);
  }

  const totalDocs = Object.values(connectors).reduce((s, c) => s + c.docCount, 0);
  const allTags = [...new Set(indexedDocs.flatMap((d) => d.tags))].slice(0, 14);

  const sourceColors: Record<ConnectorId, string> = {
    gmail: "#ea4335", harvey: "#7c3aed", lexis: "#0ea5e9", notion: "#94a3b8", teams: "#6264a7",
  };

  return (
    <>
      {showGmailOAuth && (
        <GmailOAuthModal
          onAllow={handleGmailAllow}
          onCancel={() => setShowGmailOAuth(false)}
        />
      )}

      <div className="p-4 space-y-4">
        {/* Header */}
        <div>
          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">Knowledge Ingestion</p>
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            Connect sources to enrich Firm Memory with real context.
          </p>
        </div>

        {/* Connector grid */}
        <div className="grid grid-cols-2 gap-2">
          {CONNECTOR_DEFS.map((def) => {
            const conn = connectors[def.id];
            const isIdle       = conn.status === "idle";
            const isConnecting = conn.status === "connecting";
            const isConnected  = conn.status === "connected";

            return (
              <div
                key={def.id}
                className="rounded-xl border p-3 transition-all duration-300 flex flex-col"
                style={{
                  borderColor: isConnected ? def.color + "44" : "#27272a",
                  backgroundColor: isConnected ? def.bgColor : "#0d0d1f",
                  boxShadow: isConnected ? `0 0 12px ${def.color}10` : "none",
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="text-xl leading-none transition-all duration-300"
                    style={{ color: isConnected ? def.color : isConnecting ? def.color + "88" : "#374151" }}
                  >
                    {def.icon}
                  </span>
                  <div className="flex items-center gap-1">
                    {def.type === "simulated" && isIdle && (
                      <span className="text-[8px] border border-zinc-800 text-zinc-700 px-1 py-0.5 rounded font-mono">
                        SIM
                      </span>
                    )}
                    {isConnected && (
                      <span
                        className="text-[8px] border px-1 py-0.5 rounded font-mono font-bold"
                        style={{ borderColor: def.color + "44", color: def.color }}
                      >
                        {conn.docCount}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[11px] font-semibold text-zinc-200 leading-tight">{def.name}</p>
                <p className="text-[9px] text-zinc-600 mb-2.5 leading-relaxed">{def.desc}</p>

                <button
                  onClick={() => handleConnect(def.id)}
                  disabled={!isIdle}
                  className="mt-auto w-full py-1 rounded text-[9px] font-bold uppercase tracking-widest transition-all"
                  style={
                    isConnected
                      ? { backgroundColor: def.color + "15", color: def.color, border: `1px solid ${def.color}30`, cursor: "default" }
                      : isConnecting
                      ? { backgroundColor: "#18181b", color: "#52525b", border: "1px solid #27272a", cursor: "wait" }
                      : { backgroundColor: "transparent", color: "#71717a", border: "1px solid #3f3f46", cursor: "pointer" }
                  }
                >
                  {isConnecting ? (
                    <span className="flex items-center justify-center gap-1">
                      <span className="animate-spin inline-block">◌</span> Connecting…
                    </span>
                  ) : isConnected ? (
                    "✓ Connected"
                  ) : def.id === "gmail" ? (
                    "Connect"
                  ) : (
                    "Simulate"
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Vector Knowledge Base */}
        {totalDocs > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest">Vector Knowledge Base</span>
              <div className="flex items-center gap-2">
                {isIndexing && (
                  <span className="text-[9px] text-blue-400 animate-pulse">indexing…</span>
                )}
                <span className="text-[10px] font-bold font-mono text-zinc-300">{totalDocs} docs</span>
              </div>
            </div>

            {/* Stacked bar */}
            <div className="flex h-2 rounded overflow-hidden gap-px">
              {CONNECTOR_DEFS.filter((d) => connectors[d.id].docCount > 0).map((d) => (
                <div
                  key={d.id}
                  className="h-full transition-all duration-700 ease-out"
                  style={{
                    backgroundColor: d.color,
                    width: `${(connectors[d.id].docCount / totalDocs) * 100}%`,
                    opacity: 0.85,
                  }}
                />
              ))}
            </div>

            {/* Source breakdown */}
            <div className="flex flex-wrap gap-2">
              {CONNECTOR_DEFS.filter((d) => connectors[d.id].docCount > 0).map((d) => (
                <span key={d.id} className="flex items-center gap-1 text-[9px] text-zinc-500">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  {d.name} ({connectors[d.id].docCount})
                </span>
              ))}
            </div>

            {/* Tag cloud */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {allTags.map((t) => (
                  <span
                    key={t}
                    className="text-[8px] px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-600 font-mono"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Indexed feed */}
        {indexedDocs.length > 0 && (
          <div>
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-2">Recently Indexed</p>
            <div ref={feedRef} className="space-y-1.5 max-h-48 overflow-y-auto">
              {[...indexedDocs].reverse().map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start gap-2 rounded-lg px-2 py-1.5 bg-zinc-900/30 border border-zinc-800/40"
                >
                  <span
                    className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: sourceColors[doc.source] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-zinc-400 truncate leading-tight">{doc.title}</p>
                    <p className="text-[9px] text-zinc-600 truncate leading-tight mt-0.5">{doc.snippet.slice(0, 70)}…</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {doc.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[7px] px-1 py-0.5 rounded bg-zinc-800/60 text-zinc-600 font-mono">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalDocs === 0 && (
          <div className="text-center py-6 opacity-30 space-y-2">
            <div className="text-3xl">⊡</div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">No sources connected</p>
            <p className="text-[9px] text-zinc-700">Connect Gmail or simulate sources above</p>
          </div>
        )}
      </div>
    </>
  );
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
