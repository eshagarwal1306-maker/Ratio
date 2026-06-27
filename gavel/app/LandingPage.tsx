"use client";

import { useEffect, useState } from "react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  parchment: "#f2efe8",
  white: "#ffffff",
  ink: "#0d0d0d",
  inkMid: "#555555",
  inkFaint: "#999999",
  border: "#ddd9d1",
  borderLight: "#ebe8e0",
  red: "#c41e1e",
  redBg: "#fef2f2",
  redBorder: "#fca5a5",
  amber: "#854d0e",
  amberBg: "#fffbeb",
  amberBorder: "#fde68a",
  green: "#166534",
  greenBg: "#f0fdf4",
  navyBtn: "#0d1f3c",
};

// ── Annotated document preview ────────────────────────────────────────────────

const HIGHLIGHTS = [
  { phrase: "DORA Article 30(3)", badge: "NOT FOUND", type: "red" as const, delay: 700 },
  { phrase: "UK-based financial entities", badge: "WRONG JURISDICTION", type: "red" as const, delay: 1500 },
  { phrase: "RTS Article 42", badge: "AMENDED", type: "amber" as const, delay: 2300 },
  { phrase: "EBA/GL/2019/02", badge: "HIGH RISK", type: "red" as const, delay: 3100 },
];

function DocPreview() {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const timers = HIGHLIGHTS.map((h, i) =>
      setTimeout(() => setShown(i + 1), h.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  function Hi({ idx, children }: { idx: number; children: string }) {
    const h = HIGHLIGHTS[idx];
    const visible = shown > idx;
    const isRed = h.type === "red";
    return (
      <span style={{ display: "inline" }}>
        <span style={{
          backgroundColor: visible ? (isRed ? "#fee2e2" : "#fef9c3") : "transparent",
          borderRadius: 2,
          padding: "1px 2px",
          transition: "background-color 0.5s ease",
          cursor: "default",
        }}>
          {children}
        </span>
        {visible && (
          <span style={{
            display: "inline-block",
            fontSize: 9,
            fontWeight: 700,
            padding: "1px 6px",
            borderRadius: 3,
            background: isRed ? T.redBg : T.amberBg,
            color: isRed ? T.red : T.amber,
            border: `1px solid ${isRed ? T.redBorder : T.amberBorder}`,
            marginLeft: 6,
            verticalAlign: "middle",
            letterSpacing: "0.05em",
            fontFamily: "system-ui, sans-serif",
            animation: "tagIn 0.25s ease",
          }}>
            {h.badge}
          </span>
        )}
      </span>
    );
  }

  const allDone = shown >= HIGHLIGHTS.length;

  return (
    <div style={{
      background: T.white,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: "0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <style>{`
        @keyframes tagIn { from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)} }
        @keyframes scanLine { 0%{opacity:1}50%{opacity:0.3}100%{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Document chrome */}
      <div style={{
        padding: "10px 18px", borderBottom: `1px solid ${T.borderLight}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#fafaf8",
      }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: T.ink, letterSpacing: "0.01em" }}>
            DORA Compliance Memo
          </p>
          <p style={{ fontSize: 10, color: T.inkFaint }}>Linklaters LLP · 14 February 2025</p>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          fontSize: 10, color: "#3b82f6", fontWeight: 600,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%", background: "#3b82f6",
            display: "inline-block",
            animation: "scanLine 1.4s ease-in-out infinite",
          }} />
          {shown < HIGHLIGHTS.length ? "Scanning…" : "Audit complete"}
        </div>
      </div>

      {/* Document body */}
      <div style={{
        padding: "22px 24px 16px",
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: 13.5,
        lineHeight: 2,
        color: "#2a2a2a",
      }}>
        <p style={{ marginBottom: 10 }}>
          The Digital Operational Resilience Act pursuant to{" "}
          <Hi idx={0}>DORA Article 30(3)</Hi>{" "}
          imposes third-party risk management obligations on{" "}
          <Hi idx={1}>UK-based financial entities</Hi>.
          Firms are required to comply with requirements set out in{" "}
          <Hi idx={2}>RTS Article 42</Hi>.
          Supplementary guidance published by the{" "}
          <Hi idx={3}>EBA/GL/2019/02</Hi>{" "}
          confirms this interpretation.
        </p>
      </div>

      {/* Summary bar */}
      <div style={{
        margin: "0 16px 16px",
        padding: "10px 14px",
        background: allDone ? T.redBg : "#f8f7f5",
        border: `1px solid ${allDone ? T.redBorder : T.borderLight}`,
        borderRadius: 6,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "all 0.4s ease",
        animation: allDone ? "slideUp 0.3s ease" : "none",
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: allDone ? T.red : T.inkFaint }}>
          {shown === 0
            ? "No issues found yet"
            : shown < HIGHLIGHTS.length
            ? `${shown} issue${shown > 1 ? "s" : ""} found so far…`
            : "4 issues found · 3 high risk · Do not send"}
        </span>
        {allDone && (
          <span style={{
            fontSize: 9, fontWeight: 800, color: T.red,
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            DO NOT SEND
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main landing page ─────────────────────────────────────────────────────────

interface LandingPageProps {
  onVerify: () => void;
  onFind: () => void;
}

export function LandingPage({ onVerify, onFind }: LandingPageProps) {
  return (
    <main style={{ background: T.parchment, minHeight: "100vh", color: T.ink }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)} }
        .btn-primary { transition: background 0.15s, transform 0.15s; }
        .btn-primary:hover { background: #1a3560 !important; transform: translateY(-1px); }
        .btn-ghost:hover { background: rgba(0,0,0,0.05) !important; }
        .agent-card:hover { border-color: #c4bfb8 !important; }
        .feature-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08) !important; }
      `}</style>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 56px", height: 58,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.border}`,
      }}>
        <span style={{
          fontSize: 17, fontWeight: 800, letterSpacing: "0.08em",
          color: T.ink, fontFamily: "Georgia, serif",
        }}>
          RATIO
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 10, color: T.inkFaint, padding: "4px 10px",
            border: `1px solid ${T.border}`, borderRadius: 4,
            letterSpacing: "0.05em", textTransform: "uppercase",
          }}>
            Cambridge Hack the Law 2026
          </span>
          <button onClick={onVerify} className="btn-primary" style={{
            fontSize: 12, fontWeight: 700, padding: "8px 18px",
            background: T.navyBtn, color: "#fff",
            borderRadius: 6, border: "none", cursor: "pointer",
            letterSpacing: "0.02em",
          }}>
            Audit a memo →
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={{ padding: "88px 56px 72px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }}>

          {/* Left: copy */}
          <div style={{ animation: "fadeUp 0.5s ease both" }}>

            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 10, fontWeight: 700, color: T.red,
              letterSpacing: "0.1em", textTransform: "uppercase",
              marginBottom: 28,
            }}>
              <span style={{
                width: 16, height: 16, borderRadius: "50%",
                background: T.redBg, border: `1px solid ${T.redBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 8,
              }}>!</span>
              5 adversarial agents · runs in ~3 minutes
            </div>

            <h1 style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(32px, 3.6vw, 52px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              marginBottom: 24,
              color: T.ink,
            }}>
              AI wrote the memo.
              <br />
              <span style={{ color: T.red }}>We found the errors.</span>
            </h1>

            <p style={{
              fontSize: 16, color: T.inkMid, lineHeight: 1.75,
              marginBottom: 36, maxWidth: 440,
            }}>
              AI-drafted memos hallucinate citations, misapply jurisdiction, and cite
              repealed law. RATIO deploys five specialist agents to catch every error
              before it becomes a professional liability exposure.
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onVerify} className="btn-primary" style={{
                padding: "13px 26px", borderRadius: 7, border: "none", cursor: "pointer",
                background: T.navyBtn, color: "#fff",
                fontSize: 14, fontWeight: 700, letterSpacing: "0.01em",
              }}>
                Verify Citations →
              </button>
              <button onClick={onFind} className="btn-ghost" style={{
                padding: "13px 22px", borderRadius: 7, cursor: "pointer",
                background: "transparent",
                border: `1px solid ${T.border}`,
                color: T.inkMid, fontSize: 14, fontWeight: 500,
                transition: "background 0.15s",
              }}>
                Find Sources
              </button>
            </div>

            {/* Proof points */}
            <div style={{
              display: "flex", gap: 32, marginTop: 36,
              paddingTop: 32, borderTop: `1px solid ${T.border}`,
            }}>
              {[
                { stat: "23%", label: "of AI citations contain a material error" },
                { stat: "£2.4M", label: "average negligence claim" },
                { stat: "3 min", label: "to run a full audit" },
              ].map((p) => (
                <div key={p.stat}>
                  <p style={{
                    fontFamily: "Georgia, serif",
                    fontSize: 22, fontWeight: 700,
                    color: T.ink, marginBottom: 3, letterSpacing: "-0.02em",
                  }}>{p.stat}</p>
                  <p style={{ fontSize: 11, color: T.inkFaint, lineHeight: 1.4 }}>{p.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: annotated document */}
          <div style={{ animation: "fadeUp 0.5s ease 0.12s both" }}>
            <DocPreview />
          </div>
        </div>
      </section>

      {/* ── Five agents ──────────────────────────────────────────────────────── */}
      <section style={{
        borderTop: `1px solid ${T.border}`,
        background: T.white,
        padding: "72px 56px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 48 }}>
            <p style={{
              fontSize: 10, fontWeight: 700, color: T.inkFaint,
              letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12,
            }}>
              The verification engine
            </p>
            <h2 style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(22px, 2.4vw, 34px)",
              fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 12,
            }}>
              Five adversarial specialists.{" "}
              <span style={{ color: T.inkFaint }}>Not one AI that does everything.</span>
            </h2>
            <p style={{ fontSize: 14, color: T.inkMid, maxWidth: 500, lineHeight: 1.65 }}>
              Each agent is given a different brief. A flaw missed by one is caught by another.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {[
              {
                num: "I",
                name: "Citation Sourcer",
                desc: "Fetches verbatim text from EUR-Lex and legislation.gov.uk. Verifies every cited provision word for word.",
                badge: "NOT FOUND",
                finding: "DORA Article 30(3) does not match the Official Journal text.",
                type: "red",
              },
              {
                num: "II",
                name: "Jurisdictionist",
                desc: "Checks whether the cited regulation applies to your specific client entity post-Brexit.",
                badge: "WRONG JURISDICTION",
                finding: "UK-only firms are outside DORA scope without EU establishment.",
                type: "red",
              },
              {
                num: "III",
                name: "Legal Historian",
                desc: "Traces amendment history. Catches stale article numbers from AI training data that predates publication.",
                badge: "AMENDED",
                finding: "Article numbering differs from final OJ text of January 2025.",
                type: "amber",
              },
              {
                num: "IV",
                name: "Devil's Advocate",
                desc: "Surfaces the strongest counter-authority that opposing counsel will raise — before you send.",
                badge: "HIGH RISK",
                finding: "EBA/GL/2019/02 directly undermines the cited interpretation.",
                type: "red",
              },
              {
                num: "V",
                name: "Firm Memory",
                desc: "Checks every claim against prior firm opinions. Flags advice that contradicts your own precedent.",
                badge: "CONTRADICTION",
                finding: "Client Advisory (Richardson, March 2024) took the opposite position.",
                type: "red",
              },
            ].map((a) => (
              <div key={a.name} className="agent-card" style={{
                background: T.parchment,
                border: `1px solid ${T.border}`,
                borderRadius: 10, padding: "20px 18px",
                transition: "border-color 0.2s",
                cursor: "default",
              }}>
                <div style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 12, fontWeight: 700, color: T.inkFaint,
                  letterSpacing: "0.04em", marginBottom: 14,
                }}>
                  {a.num}
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, color: T.ink, marginBottom: 8 }}>
                  {a.name}
                </p>
                <p style={{ fontSize: 11, color: T.inkMid, lineHeight: 1.6, marginBottom: 14 }}>
                  {a.desc}
                </p>
                <div style={{
                  padding: "8px 10px",
                  background: T.white,
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                }}>
                  <div style={{
                    display: "inline-block",
                    fontSize: 9, fontWeight: 700,
                    padding: "2px 6px", borderRadius: 3, marginBottom: 5,
                    background: a.type === "red" ? T.redBg : T.amberBg,
                    color: a.type === "red" ? T.red : T.amber,
                    border: `1px solid ${a.type === "red" ? T.redBorder : T.amberBorder}`,
                    letterSpacing: "0.04em",
                  }}>
                    {a.badge}
                  </div>
                  <p style={{ fontSize: 10, color: T.inkMid, lineHeight: 1.5 }}>{a.finding}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "72px 56px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 48 }}>
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(22px, 2.4vw, 34px)",
            fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 10,
          }}>
            From document to verified report in 3 minutes
          </h2>
          <p style={{ fontSize: 14, color: T.inkMid }}>
            No setup. No integrations. Paste your memo and run.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
          {[
            {
              step: "01",
              title: "Upload your document",
              desc: "Paste or upload your legal memo — PDF, Word, or plain text. Add a client description so the Jurisdictionist can check applicability accurately.",
              note: "The 8 highest-risk citations are identified and prioritised automatically.",
            },
            {
              step: "02",
              title: "Five agents run in parallel",
              desc: "All five specialists check every claim simultaneously — source text, jurisdiction, currency, counter-arguments, and prior firm conflicts.",
              note: "Watch findings stream in live as each agent reports.",
            },
            {
              step: "03",
              title: "Review and export",
              desc: "Every flagged citation gets an inline highlight. Click to see the finding, the agent's reasoning, and a suggested fix — without leaving the document.",
              note: "Export a formatted .docx verification report or send by email.",
            },
          ].map((s) => (
            <div key={s.step} style={{
              background: T.white,
              border: `1px solid ${T.border}`,
              borderRadius: 10, padding: "28px 24px",
            }}>
              <p style={{
                fontFamily: "Georgia, serif",
                fontSize: 13, fontWeight: 700, color: T.inkFaint,
                letterSpacing: "0.04em", marginBottom: 18,
              }}>
                {s.step}
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 10 }}>
                {s.title}
              </p>
              <p style={{ fontSize: 12, color: T.inkMid, lineHeight: 1.7, marginBottom: 16 }}>
                {s.desc}
              </p>
              <p style={{
                fontSize: 11, color: T.inkMid,
                padding: "8px 12px",
                background: T.parchment,
                borderRadius: 6,
                border: `1px solid ${T.border}`,
                lineHeight: 1.6,
              }}>
                {s.note}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature callouts ─────────────────────────────────────────────────── */}
      <section style={{
        borderTop: `1px solid ${T.border}`,
        background: T.white,
        padding: "72px 56px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              {
                label: "Jurisdiction",
                title: "Post-Brexit applicability intelligence",
                desc: "RATIO knows which EU regulations extend to UK-registered entities and which stopped applying after exit. A UK-only firm citing DORA without EU establishment — caught. A CDPA claim for a UK employer — confirmed as applicable.",
              },
              {
                label: "Inline review",
                title: "Grammarly-style error highlights",
                desc: "Every flagged citation gets a wavy underline directly in your document. Click any highlight to see the finding, the agent's reasoning, and a suggested fix — all without leaving the document view.",
              },
              {
                label: "Risk verdict",
                title: "Monte Carlo risk simulation",
                desc: "2,000 simulated scenarios produce a plain-language verdict: DO NOT SEND, NEEDS REVIEW, or CLEAR TO SEND. No charts. The answer a partner needs before signing off.",
              },
              {
                label: "Source discovery",
                title: "Find citations for uncited memos",
                desc: "AI drafted the memo but left out the citations? RATIO searches EUR-Lex, BAILII, and legislation.gov.uk for relevant legislation, case law, and practice guides — then verifies every source it finds.",
              },
            ].map((f) => (
              <div key={f.title} className="feature-card" style={{
                padding: "26px 26px",
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                transition: "box-shadow 0.2s",
              }}>
                <p style={{
                  fontSize: 9, fontWeight: 700, color: T.inkFaint,
                  letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10,
                }}>
                  {f.label}
                </p>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 10 }}>
                  {f.title}
                </p>
                <p style={{ fontSize: 12, color: T.inkMid, lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 56px 100px", textAlign: "center" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <p style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(24px, 2.4vw, 36px)",
            fontWeight: 700, letterSpacing: "-0.02em",
            marginBottom: 16, lineHeight: 1.2,
          }}>
            Three minutes to know
            <br />
            whether it is safe to send.
          </p>
          <p style={{ fontSize: 15, color: T.inkMid, marginBottom: 36, lineHeight: 1.65 }}>
            Paste your legal document and let five adversarial agents verify
            every citation before it becomes a claim against you.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={onVerify} className="btn-primary" style={{
              padding: "14px 30px", borderRadius: 7, border: "none", cursor: "pointer",
              background: T.navyBtn, color: "#fff",
              fontSize: 14, fontWeight: 700, letterSpacing: "0.01em",
            }}>
              Verify Citations →
            </button>
            <button onClick={onFind} className="btn-ghost" style={{
              padding: "14px 22px", borderRadius: 7, cursor: "pointer",
              background: "transparent",
              border: `1px solid ${T.border}`,
              color: T.inkMid, fontSize: 14, fontWeight: 500,
              transition: "background 0.15s",
            }}>
              Find Sources
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div style={{
        borderTop: `1px solid ${T.border}`,
        padding: "18px 56px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: T.white,
      }}>
        <span style={{
          fontSize: 12, fontFamily: "Georgia, serif",
          fontWeight: 700, letterSpacing: "0.08em", color: T.ink,
        }}>
          RATIO
        </span>
        <span style={{ fontSize: 11, color: T.inkFaint }}>
          Cambridge Hack the Law 2026 · Not legal advice · Powered by Claude Sonnet 4.6
        </span>
      </div>
    </main>
  );
}
