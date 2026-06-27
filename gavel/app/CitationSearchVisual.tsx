"use client";

import { useEffect, useRef, useState } from "react";

// ── Fake crawl data ───────────────────────────────────────────────────────────

const CRAWL_STEPS = [
  {
    domain: "eur-lex.europa.eu",
    path: "/legal-content/EN/TXT/?uri=CELEX:32022R2554",
    title: "DORA — Regulation (EU) 2022/2554",
    favicon: "🇪🇺",
    snippet: [
      "Article 1 — Subject matter and scope",
      "This Regulation lays down uniform requirements concerning the security of network and information systems supporting the business processes of financial entities...",
      "Article 30 — Key contractual provisions",
      "Financial entities shall ensure that contracts with ICT third-party service providers include provisions that allow financial entities to fully perform their obligations...",
    ],
    status: 200,
    foundType: "legislation",
    foundLabel: "DORA Art. 30",
  },
  {
    domain: "bailii.org",
    path: "/ew/cases/EWCA/Civ/2023/1234.html",
    title: "Tulip Trading Ltd v Bitcoin Association for BSV",
    favicon: "⚖️",
    snippet: [
      "[2023] EWCA Civ 1179",
      "The Court of Appeal considered whether software developers owe a fiduciary duty to cryptocurrency holders...",
      "Held: The judge was wrong to strike out the claims. The novel duty alleged was at least arguable...",
      "Lady Justice Laing, Lord Justice Males, Lord Justice Birss",
    ],
    status: 200,
    foundType: "case_law",
    foundLabel: "Tulip Trading [2023]",
  },
  {
    domain: "legislation.gov.uk",
    path: "/uksi/2017/701/contents",
    title: "The Money Laundering Regulations 2017",
    favicon: "🏛️",
    snippet: [
      "2017 No. 692 — FINANCIAL SERVICES",
      "The Money Laundering, Terrorist Financing and Transfer of Funds (Information on the Payer) Regulations 2017",
      "Regulation 19 — Policies, controls and procedures",
      "A relevant person must establish and maintain policies, controls and procedures to mitigate and manage effectively the risks of money laundering...",
    ],
    status: 200,
    foundType: "legislation",
    foundLabel: "MLR 2017 reg. 19",
  },
  {
    domain: "esma.europa.eu",
    path: "/document/esma35-43-3020",
    title: "ESMA Guidelines on MiFID II suitability requirements",
    favicon: "📋",
    snippet: [
      "ESMA35-43-3020 | 6 November 2023",
      "These Guidelines apply to investment firms providing investment advice or portfolio management...",
      "Guideline 6 — Suitability assessment for non-complex products",
      "Firms must collect sufficient information about the client's financial situation, investment objectives and risk tolerance...",
    ],
    status: 200,
    foundType: "practitioners_guide",
    foundLabel: "ESMA Suitability Guide",
  },
  {
    domain: "bailii.org",
    path: "/ew/cases/EWHC/Comm/2022/889.html",
    title: "Allianz Global Investors GmbH v Barclays Bank",
    favicon: "⚖️",
    snippet: [
      "[2022] EWHC 889 (Comm)",
      "The claimants brought claims for breach of contract and misrepresentation arising from their purchase of structured notes...",
      "Cockerill J: The duty to inform under MiFID must be read purposively. A strict textual reading does not reflect the regulatory intent...",
    ],
    status: 200,
    foundType: "case_law",
    foundLabel: "Allianz v Barclays [2022]",
  },
  {
    domain: "eba.europa.eu",
    path: "/regulation-and-policy/internal-governance/guidelines-on-ict-and-security-risk-management",
    title: "EBA Guidelines on ICT and Security Risk Management",
    favicon: "🏦",
    snippet: [
      "EBA/GL/2019/04 | 29 November 2019",
      "These Guidelines specify requirements for internal governance arrangements relating to ICT and security risk management...",
      "Section 3.2 — ICT asset management",
      "Institutions should maintain an up-to-date register of all ICT assets including information assets and ICT third-party service dependencies...",
    ],
    status: 200,
    foundType: "practitioners_guide",
    foundLabel: "EBA ICT Guidelines",
  },
  {
    domain: "legislation.gov.uk",
    path: "/ukpga/2000/8/contents",
    title: "Financial Services and Markets Act 2000",
    favicon: "🏛️",
    snippet: [
      "2000 Chapter 8",
      "An Act to make provision about the regulation of financial services and markets...",
      "Section 19 — The general prohibition",
      "No person may carry on a regulated activity in the United Kingdom, or purport to do so, unless he is an authorised person or an exempt person...",
    ],
    status: 200,
    foundType: "legislation",
    foundLabel: "FSMA 2000 s.19",
  },
];

const TYPE_COLOR: Record<string, { color: string; bg: string; label: string }> = {
  legislation:         { color: "#1d4ed8", bg: "#eff6ff",  label: "Legislation" },
  case_law:            { color: "#7c3aed", bg: "#f5f3ff",  label: "Case law" },
  practitioners_guide: { color: "#b45309", bg: "#fffbeb",  label: "Guidance" },
};

const LOG_MESSAGES = [
  "Extracting legal claims from document…",
  "Identifying applicable regulatory frameworks…",
  "Querying EUR-Lex for EU instruments…",
  "Cross-referencing BAILII case database…",
  "Checking legislation.gov.uk for UK statutes…",
  "Searching ESMA & EBA regulatory publications…",
  "Verifying citation accuracy against source text…",
  "Ranking sources by relevance…",
  "Generating enriched document with citations…",
];

// ── Browser chrome component ──────────────────────────────────────────────────

function BrowserChrome({
  step,
  lineReveal,
}: {
  step: (typeof CRAWL_STEPS)[0];
  lineReveal: number;
}) {
  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #e0e0e0",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Window controls */}
      <div style={{
        background: "#f5f5f5",
        borderBottom: "1px solid #e0e0e0",
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <div style={{ display: "flex", gap: 5 }}>
          {["#ff5f57", "#ffbd2e", "#28c840"].map((c) => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
          ))}
        </div>

        {/* URL bar */}
        <div style={{
          flex: 1, background: "#ffffff", borderRadius: 5,
          border: "1px solid #d0d0d0",
          padding: "4px 10px", fontSize: 11, color: "#333",
          display: "flex", alignItems: "center", gap: 6,
          overflow: "hidden",
        }}>
          <span style={{ color: "#22c55e", fontSize: 12, flexShrink: 0 }}>🔒</span>
          <span style={{ color: "#1a56db", fontWeight: 600, flexShrink: 0 }}>{step.domain}</span>
          <span style={{ color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {step.path}
          </span>
        </div>

        <div style={{
          fontSize: 9, fontWeight: 700, color: "#22c55e",
          background: "#f0fdf4", border: "1px solid #bbf7d0",
          padding: "2px 7px", borderRadius: 4, letterSpacing: "0.04em",
        }}>
          {step.status} OK
        </div>
      </div>

      {/* Fake loading bar */}
      <div style={{ height: 2, background: "#f3f4f6" }}>
        <div style={{
          height: 2,
          background: "linear-gradient(90deg, #3b82f6 0%, #06b6d4 50%, #3b82f6 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmerBar 1.2s linear infinite",
          width: "60%",
          borderRadius: "0 2px 2px 0",
        }} />
      </div>

      {/* Page header mock */}
      <div style={{
        padding: "14px 18px 10px",
        borderBottom: "1px solid #f0f0f0",
        background: "#fafafa",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 18 }}>{step.favicon}</span>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{step.title}</p>
        </div>
        <p style={{ fontSize: 10, color: "#9ca3af" }}>
          {step.domain} · Authenticated access · TLS 1.3
        </p>
      </div>

      {/* Page content — lines reveal one by one */}
      <div style={{ padding: "14px 18px", flex: 1, overflow: "hidden" }}>
        {step.snippet.map((line, i) => {
          const visible = i < lineReveal;
          const isHeader = i % 2 === 0;
          return (
            <div
              key={i}
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(4px)",
                transition: "opacity 0.3s ease, transform 0.3s ease",
                marginBottom: isHeader ? 4 : 10,
              }}
            >
              {isHeader ? (
                <p style={{ fontSize: 10, fontWeight: 800, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {line}
                </p>
              ) : (
                <p style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.65 }}>{line}</p>
              )}
            </div>
          );
        })}

        {/* Cursor blink on last line */}
        {lineReveal > 0 && lineReveal <= step.snippet.length && (
          <span style={{
            display: "inline-block", width: 2, height: 14,
            background: "#3b82f6", marginLeft: 2, verticalAlign: "middle",
            animation: "cursorBlink 0.9s step-end infinite",
          }} />
        )}
      </div>

      {/* Source badge when fully loaded */}
      {lineReveal >= step.snippet.length && (
        <div style={{
          margin: "0 14px 14px",
          padding: "8px 12px",
          background: TYPE_COLOR[step.foundType]?.bg ?? "#f9fafb",
          border: `1px solid ${TYPE_COLOR[step.foundType]?.color ?? "#e5e7eb"}33`,
          borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          animation: "fadeUp 0.25s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>✓</span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: TYPE_COLOR[step.foundType]?.color ?? "#374151",
            }}>
              {TYPE_COLOR[step.foundType]?.label} · {step.foundLabel}
            </span>
          </div>
          <span style={{ fontSize: 10, color: "#6b7280" }}>Added to sources</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CitationSearchVisual() {
  const [stepIdx, setStepIdx]       = useState(0);
  const [lineReveal, setLineReveal] = useState(0);
  const [logLines, setLogLines]     = useState<string[]>([LOG_MESSAGES[0]]);
  const [found, setFound]           = useState<typeof CRAWL_STEPS>([]);
  const [logIdx, setLogIdx]         = useState(1);
  const logRef = useRef<HTMLDivElement>(null);

  const step = CRAWL_STEPS[stepIdx % CRAWL_STEPS.length];

  // Line-by-line reveal within current page
  useEffect(() => {
    setLineReveal(0);
    const timer = setInterval(() => {
      setLineReveal((n) => {
        if (n >= step.snippet.length) {
          clearInterval(timer);
          return n;
        }
        return n + 1;
      });
    }, 380);
    return () => clearInterval(timer);
  }, [stepIdx, step.snippet.length]);

  // Advance to next page every ~3.2 s
  useEffect(() => {
    const id = setInterval(() => {
      setFound((f) => {
        const current = CRAWL_STEPS[stepIdx % CRAWL_STEPS.length];
        if (!f.find((x) => x.path === current.path)) return [...f, current];
        return f;
      });
      setStepIdx((i) => i + 1);
    }, 3200);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  // Log messages ticker
  useEffect(() => {
    if (logIdx >= LOG_MESSAGES.length) return;
    const id = setTimeout(() => {
      setLogLines((l) => [...l, LOG_MESSAGES[logIdx]]);
      setLogIdx((i) => i + 1);
    }, 2800);
    return () => clearTimeout(id);
  }, [logIdx]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "#0d1f3c",
      display: "flex", flexDirection: "column",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <style>{`
        @keyframes shimmerBar {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>

      {/* Header bar */}
      <div style={{
        padding: "0 28px", height: 52, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 800, letterSpacing: "0.08em", color: "#fff" }}>
            RATIO
          </span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>·</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Source Discovery</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "pulse 1.5s ease-in-out infinite" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
            Live crawl · {found.length} source{found.length !== 1 ? "s" : ""} found
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, gap: 0 }}>

        {/* Left: browser + log */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: "20px 16px 20px 24px", gap: 14 }}>

          {/* Current URL breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Crawling</span>
            {[
              { icon: "🇪🇺", label: "EUR-Lex" },
              { icon: "⚖️", label: "BAILII" },
              { icon: "🏛️", label: "legislation.gov.uk" },
              { icon: "📋", label: "ESMA" },
              { icon: "🏦", label: "EBA" },
            ].map(({ icon, label }, i) => {
              const active = CRAWL_STEPS[stepIdx % CRAWL_STEPS.length].domain.includes(
                label.replace("legislation.gov.uk", "legislation").toLowerCase().split(".")[0]
              );
              return (
                <div key={label} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "3px 8px", borderRadius: 5,
                  background: active ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.08)"}`,
                  transition: "all 0.3s ease",
                }}>
                  <span style={{ fontSize: 11 }}>{icon}</span>
                  <span style={{ fontSize: 10, color: active ? "#93c5fd" : "rgba(255,255,255,0.35)", fontWeight: active ? 700 : 400 }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Browser window */}
          <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
            <BrowserChrome step={step} lineReveal={lineReveal} />
          </div>

          {/* Agent log terminal */}
          <div style={{
            flexShrink: 0, height: 100,
            background: "rgba(0,0,0,0.35)",
            borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)",
            padding: "10px 14px", overflow: "hidden",
          }}>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
              Agent log
            </p>
            <div
              ref={logRef}
              style={{ overflowY: "auto", maxHeight: 68, display: "flex", flexDirection: "column", gap: 3 }}
            >
              {logLines.map((line, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#22c55e", fontSize: 10, flexShrink: 0 }}>›</span>
                  <p style={{
                    fontSize: 11, color: i === logLines.length - 1 ? "#e2e8f0" : "rgba(255,255,255,0.35)",
                    fontFamily: "'Fira Code', 'Courier New', monospace",
                  }}>{line}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: sources panel */}
        <div style={{
          width: 260, flexShrink: 0,
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.15)",
          padding: "20px 16px",
          display: "flex", flexDirection: "column", gap: 14,
          overflowY: "auto",
        }}>
          {/* Counter */}
          <div>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
              Sources found
            </p>
            <p style={{
              fontFamily: "Georgia, serif",
              fontSize: 44, fontWeight: 700, color: "#fff",
              lineHeight: 1, letterSpacing: "-0.04em",
            }}>
              {found.length}
            </p>
          </div>

          {/* Type breakdown */}
          {["legislation", "case_law", "practitioners_guide"].map((type) => {
            const count = found.filter((f) => f.foundType === type).length;
            const meta = TYPE_COLOR[type];
            return (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: meta.color, flexShrink: 0,
                }} />
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", flex: 1 }}>{meta.label}</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: count > 0 ? "#fff" : "rgba(255,255,255,0.2)" }}>{count}</p>
              </div>
            );
          })}

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

          {/* Found source list */}
          <div>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
              Verified sources
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {found.map((src, i) => {
                const meta = TYPE_COLOR[src.foundType];
                return (
                  <div
                    key={i}
                    style={{
                      padding: "8px 10px", borderRadius: 7,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      animation: "fadeUp 0.3s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                      <span style={{ fontSize: 14 }}>{src.favicon}</span>
                      <span style={{
                        fontSize: 8, fontWeight: 700, color: meta.color,
                        background: meta.bg, padding: "1px 5px", borderRadius: 3,
                        letterSpacing: "0.04em",
                      }}>{meta.label.toUpperCase()}</span>
                    </div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.3 }}>
                      {src.foundLabel}
                    </p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                      {src.domain}
                    </p>
                  </div>
                );
              })}

              {/* Skeleton placeholders for upcoming sources */}
              {Array.from({ length: Math.max(0, 4 - found.length) }).map((_, i) => (
                <div
                  key={`sk-${i}`}
                  style={{
                    padding: "8px 10px", borderRadius: 7,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <div style={{ height: 8, borderRadius: 3, background: "rgba(255,255,255,0.06)", marginBottom: 5, width: "60%" }} />
                  <div style={{ height: 8, borderRadius: 3, background: "rgba(255,255,255,0.04)", width: "85%" }} />
                </div>
              ))}
            </div>
          </div>

          {/* Bottom hint */}
          <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>
              Searching EUR-Lex, BAILII, legislation.gov.uk, ESMA and EBA databases for relevant sources…
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
