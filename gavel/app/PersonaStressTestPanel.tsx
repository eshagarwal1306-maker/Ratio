"use client";

import { useEffect, useState } from "react";

interface PersonaResult {
  id: string;
  name: string;
  role: string;
  verdict: "PASSES" | "RAISES CONCERNS" | "REJECTS";
  quote: string;
  concerns: string[];
  recommendation: string;
}

const PERSONA_META: Record<string, { initial: string; bg: string }> = {
  judge:     { initial: "J", bg: "#1e3a5f" },
  opposing:  { initial: "O", bg: "#7c1d1d" },
  regulator: { initial: "R", bg: "#1a3d2b" },
  partner:   { initial: "P", bg: "#3b2060" },
  incounsel: { initial: "C", bg: "#1c3461" },
};

const VERDICT_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  "PASSES":          { color: "#166534", bg: "#f0fdf4", border: "#bbf7d0", label: "Passes" },
  "RAISES CONCERNS": { color: "#854d0e", bg: "#fffbeb", border: "#fde68a", label: "Raises Concerns" },
  "REJECTS":         { color: "#991b1b", bg: "#fef2f2", border: "#fca5a5", label: "Rejects" },
};

const SKELETON_PERSONAS = [
  { id: "judge",     name: "High Court Judge",    role: "Mr Justice Blackwell, Commercial Court" },
  { id: "opposing",  name: "Opposing Counsel",     role: "Senior Litigation Partner" },
  { id: "regulator", name: "FCA Regulator",        role: "Senior Supervisor, Financial Conduct Authority" },
  { id: "partner",   name: "Partner Risk Review",  role: "Senior Partner & Head of Risk" },
  { id: "incounsel", name: "In-House Counsel",     role: "General Counsel, Client Company" },
];

function SkeletonCard({ persona }: { persona: typeof SKELETON_PERSONAS[0] }) {
  const meta = PERSONA_META[persona.id] ?? { initial: persona.name[0], bg: "#334155" };
  return (
    <div style={{
      background: "#ffffff", border: "1px solid #e0dbd4",
      borderRadius: 10, padding: "20px 20px",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: meta.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, color: "#fff",
          fontFamily: "Georgia, serif", flexShrink: 0,
        }}>
          {meta.initial}
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#0d0d0d" }}>{persona.name}</p>
          <p style={{ fontSize: 10, color: "#9ca3af" }}>{persona.role}</p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <div style={{
            height: 22, width: 90, borderRadius: 99,
            background: "#f2efe8",
            animation: "skelPulse 1.4s ease-in-out infinite",
          }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[80, 65, 72].map((w, i) => (
          <div key={i} style={{
            height: 10, borderRadius: 4,
            background: "#f2efe8",
            width: `${w}%`,
            animation: `skelPulse 1.4s ease-in-out ${i * 0.15}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

function PersonaCard({ result }: { result: PersonaResult }) {
  const meta = PERSONA_META[result.id] ?? { initial: result.name[0], bg: "#334155" };
  const vs = VERDICT_STYLE[result.verdict] ?? VERDICT_STYLE["RAISES CONCERNS"];

  return (
    <div style={{
      background: "#ffffff", border: "1px solid #e0dbd4",
      borderRadius: 10, padding: "20px 20px",
      display: "flex", flexDirection: "column", gap: 12,
      animation: "cardAppear 0.35s ease",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: meta.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, color: "#fff",
          fontFamily: "Georgia, serif", flexShrink: 0,
        }}>
          {meta.initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#0d0d0d" }}>{result.name}</p>
          <p style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {result.role}
          </p>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 800,
          padding: "3px 9px", borderRadius: 99,
          background: vs.bg, color: vs.color,
          border: `1px solid ${vs.border}`,
          letterSpacing: "0.06em", textTransform: "uppercase",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}>
          {vs.label}
        </span>
      </div>

      {/* Quote */}
      <p style={{
        fontSize: 12, color: "#555",
        fontStyle: "italic", lineHeight: 1.6,
        fontFamily: "Georgia, serif",
        borderLeft: `2px solid ${vs.border}`,
        paddingLeft: 12,
      }}>
        &ldquo;{result.quote}&rdquo;
      </p>

      {/* Concerns */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {result.concerns.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{
              width: 16, height: 16, borderRadius: "50%",
              background: vs.bg, border: `1px solid ${vs.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 8, color: vs.color, flexShrink: 0, marginTop: 1,
            }}>!</span>
            <p style={{ fontSize: 11, color: "#555", lineHeight: 1.55 }}>{c}</p>
          </div>
        ))}
      </div>

      {/* Recommendation */}
      <div style={{
        padding: "8px 10px",
        background: "#f8f7f4", border: "1px solid #ebe8e0",
        borderRadius: 6, fontSize: 11, color: "#555", lineHeight: 1.5,
      }}>
        <span style={{ fontWeight: 700, color: "#0d0d0d" }}>Action: </span>
        {result.recommendation}
      </div>
    </div>
  );
}

export function PersonaStressTestPanel({
  claimResults,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  claimResults: any[];
}) {
  const [results, setResults] = useState<PersonaResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isDemo = claimResults.length === 0;

  useEffect(() => {
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const res = await fetch("/api/persona-stress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimResults }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setResults(data.personas);
    } catch {
      setError("Failed to run stress test. Check your API key.");
    } finally {
      setLoading(false);
    }
  }

  // Overall verdict from the 5 personas
  const overallVerdict = results ? (() => {
    const rejects = results.filter(r => r.verdict === "REJECTS").length;
    const concerns = results.filter(r => r.verdict === "RAISES CONCERNS").length;
    if (rejects >= 2) return "REJECTS";
    if (rejects >= 1 || concerns >= 3) return "RAISES CONCERNS";
    if (concerns >= 1) return "RAISES CONCERNS";
    return "PASSES";
  })() : null;

  const vs = overallVerdict ? VERDICT_STYLE[overallVerdict] : null;

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#f2efe8", padding: "28px 24px 56px" }}>
      <style>{`
        @keyframes skelPulse { 0%,100%{opacity:0.5}50%{opacity:1} }
        @keyframes cardAppear { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <p style={{
            fontSize: 10, fontWeight: 700, color: "#9ca3af",
            letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4,
          }}>
            Persona Stress Test
          </p>
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontSize: 18, fontWeight: 700, color: "#0d0d0d", lineHeight: 1.2,
          }}>
            Five legal perspectives.
            <br />
            <span style={{ color: "#9ca3af" }}>One document.</span>
          </h2>
          {isDemo && (
            <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 6, fontStyle: "italic" }}>
              Using demonstration scenario
            </p>
          )}
        </div>
        {!loading && (
          <button
            onClick={run}
            style={{
              fontSize: 11, fontWeight: 600, color: "#555",
              background: "transparent", border: "1px solid #ddd9d1",
              borderRadius: 6, padding: "6px 12px", cursor: "pointer",
            }}
          >
            ↺ Re-run
          </button>
        )}
      </div>

      {/* Overall verdict banner */}
      {vs && overallVerdict && (
        <div style={{
          padding: "14px 18px",
          background: vs.bg, border: `1px solid ${vs.border}`,
          borderRadius: 8, marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          animation: "cardAppear 0.3s ease",
        }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: vs.color, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
              Overall verdict
            </p>
            <p style={{ fontSize: 14, fontWeight: 800, color: vs.color, fontFamily: "Georgia, serif" }}>
              {vs.label}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: vs.color }}>
              {results?.filter(r => r.verdict === "REJECTS").length} reject
              {results?.filter(r => r.verdict === "REJECTS").length !== 1 ? "s" : ""} ·{" "}
              {results?.filter(r => r.verdict === "RAISES CONCERNS").length} concern
              {results?.filter(r => r.verdict === "RAISES CONCERNS").length !== 1 ? "s" : ""} ·{" "}
              {results?.filter(r => r.verdict === "PASSES").length} pass
              {results?.filter(r => r.verdict === "PASSES").length !== 1 ? "es" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          padding: "12px 16px", background: "#fef2f2",
          border: "1px solid #fca5a5", borderRadius: 8,
          fontSize: 12, color: "#991b1b", marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {loading && !results &&
          SKELETON_PERSONAS.map((p) => <SkeletonCard key={p.id} persona={p} />)
        }
        {results &&
          results.map((r) => <PersonaCard key={r.id} result={r} />)
        }
      </div>

      {/* Footer */}
      {(results || error) && (
        <p style={{ fontSize: 10, color: "#c4bfb8", textAlign: "center", marginTop: 24 }}>
          Persona assessments generated by Claude · Not legal advice
        </p>
      )}
    </div>
  );
}
