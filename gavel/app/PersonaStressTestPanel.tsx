"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PersonaResult {
  id: string;
  name: string;
  role: string;
  verdict: "PASSES" | "RAISES CONCERNS" | "REJECTS";
  quote: string;
  concerns: string[];
  recommendation: string;
}

interface CustomPersona {
  name: string;
  role: string;
  lens: string;
}

// ── Display maps ──────────────────────────────────────────────────────────────

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

const CUSTOM_BG_PALETTE = [
  "#1c4532", "#312e81", "#4a1d96", "#78350f", "#1e3a5f",
  "#7f1d1d", "#14532d", "#1e40af", "#701a75", "#365314",
];

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard({ persona }: { persona: typeof SKELETON_PERSONAS[0] }) {
  const meta = PERSONA_META[persona.id] ?? { initial: persona.name[0], bg: "#334155" };
  return (
    <div style={{ background: "#fff", border: "1px solid #e0dbd4", borderRadius: 10, padding: "20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
          {meta.initial}
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#0d0d0d" }}>{persona.name}</p>
          <p style={{ fontSize: 10, color: "#9ca3af" }}>{persona.role}</p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <div style={{ height: 22, width: 90, borderRadius: 99, background: "#f2efe8", animation: "skelPulse 1.4s ease-in-out infinite" }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[80, 65, 72].map((w, i) => (
          <div key={i} style={{ height: 10, borderRadius: 4, background: "#f2efe8", width: `${w}%`, animation: `skelPulse 1.4s ease-in-out ${i * 0.15}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ── Persona card ──────────────────────────────────────────────────────────────

function PersonaCard({ result, isCustom }: { result: PersonaResult; isCustom?: boolean }) {
  const defaultMeta = PERSONA_META[result.id] ?? null;
  const customIdx = isCustom ? (parseInt(result.id.split("-")[1]) || 0) % CUSTOM_BG_PALETTE.length : 0;
  const bg = defaultMeta?.bg ?? CUSTOM_BG_PALETTE[customIdx];
  const initial = defaultMeta?.initial ?? result.name.charAt(0).toUpperCase();
  const vs = VERDICT_STYLE[result.verdict] ?? VERDICT_STYLE["RAISES CONCERNS"];

  return (
    <div style={{ background: "#fff", border: `1px solid ${isCustom ? "#c7d2fe" : "#e0dbd4"}`, borderRadius: 10, padding: "20px", display: "flex", flexDirection: "column", gap: 12, animation: "cardAppear 0.35s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0, position: "relative" }}>
          {initial}
          {isCustom && (
            <span style={{ position: "absolute", bottom: -2, right: -2, width: 12, height: 12, borderRadius: "50%", background: "#6366f1", border: "1.5px solid #fff", fontSize: 7, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800 }}>★</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#0d0d0d" }}>{result.name}</p>
            {isCustom && <span style={{ fontSize: 8, fontWeight: 700, color: "#6366f1", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 4, padding: "1px 5px", letterSpacing: "0.06em" }}>CUSTOM</span>}
          </div>
          <p style={{ fontSize: 10, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{result.role}</p>
        </div>
        <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 99, background: vs.bg, color: vs.color, border: `1px solid ${vs.border}`, letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0 }}>
          {vs.label}
        </span>
      </div>

      <p style={{ fontSize: 12, color: "#555", fontStyle: "italic", lineHeight: 1.6, fontFamily: "Georgia, serif", borderLeft: `2px solid ${vs.border}`, paddingLeft: 12 }}>
        &ldquo;{result.quote}&rdquo;
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {result.concerns.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ width: 16, height: 16, borderRadius: "50%", background: vs.bg, border: `1px solid ${vs.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: vs.color, flexShrink: 0, marginTop: 1 }}>!</span>
            <p style={{ fontSize: 11, color: "#555", lineHeight: 1.55 }}>{c}</p>
          </div>
        ))}
      </div>

      <div style={{ padding: "8px 10px", background: "#f8f7f4", border: "1px solid #ebe8e0", borderRadius: 6, fontSize: 11, color: "#555", lineHeight: 1.5 }}>
        <span style={{ fontWeight: 700, color: "#0d0d0d" }}>Action: </span>
        {result.recommendation}
      </div>
    </div>
  );
}

// ── Custom persona builder ────────────────────────────────────────────────────

const JUDGE_TEMPLATES = [
  {
    label: "Commercial Court Judge",
    name: "Mr Justice Pemberton",
    role: "Commercial Court, King's Bench Division",
    lens: "You are a Commercial Court judge known for strict adherence to precedent. You review legal memoranda for logical consistency, correct citation of authority, and whether the arguments would survive adversarial scrutiny. You are impatient with vague reasoning and expect precise statutory references.",
  },
  {
    label: "EU Law Specialist",
    name: "Advocate General Kowalski",
    role: "Court of Justice of the European Union",
    lens: "You are an EU law specialist reviewing documents for compliance with EU instruments, correct interpretation of Directives and Regulations, and whether post-Brexit UK law correctly reflects or diverges from EU law. You focus on purpose-driven interpretation of EU instruments.",
  },
  {
    label: "Compliance Officer",
    name: "Dr Sarah Chen",
    role: "Chief Compliance Officer, Global Financial Institution",
    lens: "You review legal advice from a pure compliance perspective — whether the advice exposes the firm to regulatory sanction, whether it correctly identifies what regulators expect, and whether acting on this advice would survive an FCA or PRA examination.",
  },
  {
    label: "Sceptical Client",
    name: "Richard Holt",
    role: "CEO, Mid-Market Company",
    lens: "You are a commercially focused CEO who has seen law firms get things wrong before. You scrutinise whether the advice is actionable, whether the caveats are excessive or genuine, whether you can actually rely on this, and what the worst-case scenario is if the lawyers are wrong.",
  },
];

function CustomPersonaBuilder({ onAdd }: { onAdd: (p: CustomPersona) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [lens, setLens] = useState("");

  function applyTemplate(t: typeof JUDGE_TEMPLATES[0]) {
    setName(t.name);
    setRole(t.role);
    setLens(t.lens);
  }

  function handleAdd() {
    if (!name.trim() || !role.trim() || !lens.trim()) return;
    onAdd({ name: name.trim(), role: role.trim(), lens: lens.trim() });
    setName(""); setRole(""); setLens("");
    setOpen(false);
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e0dbd4", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
      <button
        onClick={() => setOpen((x) => !x)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "none", border: "none", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#eef2ff", border: "1px solid #c7d2fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>+</div>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>Add a custom judge profile</p>
            <p style={{ fontSize: 10, color: "#9ca3af" }}>Define your own stakeholder perspective</p>
          </div>
        </div>
        <span style={{ fontSize: 12, color: "#9ca3af", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid #f1f5f9", padding: "16px" }}>
          {/* Templates */}
          <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Quick templates</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {JUDGE_TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => applyTemplate(t)}
                style={{ fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 20, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer" }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Lord Justice Smith"
                style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#1e293b", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Role / Title</label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Court of Appeal, Civil Division"
                style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#1e293b", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Their perspective</label>
              <textarea
                value={lens}
                onChange={(e) => setLens(e.target.value)}
                rows={4}
                placeholder="Describe how this person thinks, what they care about, and what they'll scrutinise…"
                style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#1e293b", resize: "none", outline: "none", lineHeight: 1.6, boxSizing: "border-box" }}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!name.trim() || !role.trim() || !lens.trim()}
              style={{ padding: "9px 0", borderRadius: 7, background: "#6366f1", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: (!name.trim() || !role.trim() || !lens.trim()) ? 0.4 : 1 }}
            >
              Add to stress test →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Document upload ───────────────────────────────────────────────────────────

function DocumentUpload({ docText, onChange }: { docText: string; onChange: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract-text", { method: "POST", body: formData });
      const data = await res.json();
      if (data.text) onChange(data.text);
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  }

  const hasDoc = docText.trim().length > 0;

  return (
    <div style={{ background: "#fff", border: "1px solid #e0dbd4", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
      <button
        onClick={() => setOpen((x) => !x)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "none", border: "none", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: hasDoc ? "#f0fdf4" : "#f8fafc", border: `1px solid ${hasDoc ? "#bbf7d0" : "#e2e8f0"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
            {hasDoc ? "✓" : "↑"}
          </div>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>
              {hasDoc ? "Document loaded" : "Upload document to stress test"}
            </p>
            <p style={{ fontSize: 10, color: "#9ca3af" }}>
              {hasDoc ? `${docText.length.toLocaleString()} characters · click to replace` : "PDF, Word (.docx) or plain text — overrides audit results"}
            </p>
          </div>
        </div>
        <span style={{ fontSize: 12, color: "#9ca3af", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid #f1f5f9", padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <input ref={fileRef} type="file" accept=".txt,.pdf,.docx,.doc" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

          <div
            onClick={() => fileRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            onDragOver={(e) => e.preventDefault()}
            style={{ border: "1.5px dashed #e2e8f0", borderRadius: 8, padding: "14px 16px", textAlign: "center", cursor: "pointer" }}
          >
            {uploading ? (
              <p style={{ fontSize: 12, color: "#64748b" }}>Reading document…</p>
            ) : (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 2 }}>Drop file or click to upload</p>
                <p style={{ fontSize: 10, color: "#9ca3af" }}>PDF · Word (.docx) · Plain text</p>
              </>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
            <span style={{ fontSize: 10, color: "#9ca3af" }}>or paste below</span>
            <div style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
          </div>

          <textarea
            value={docText}
            onChange={(e) => onChange(e.target.value)}
            rows={6}
            placeholder="Paste the legal memo, advice letter, or document text here…"
            style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#1e293b", resize: "none", outline: "none", lineHeight: 1.6, boxSizing: "border-box" }}
          />

          {hasDoc && (
            <button
              onClick={() => { onChange(""); setOpen(false); }}
              style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              ✕ Remove document
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function PersonaStressTestPanel({
  claimResults,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  claimResults: any[];
}) {
  const [results, setResults]           = useState<PersonaResult[] | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [exporting, setExporting]       = useState(false);
  const [exportDone, setExportDone]     = useState(false);
  const [documentText, setDocumentText] = useState("");
  const [customPersonas, setCustomPersonas] = useState<CustomPersona[]>([]);

  const isDemo = claimResults.length === 0 && !documentText.trim();

  async function exportDocx() {
    if (!results || exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export-persona-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personas: results, docTitle: "RATIO Persona Stress Test Report" }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "ratio-persona-stress-test.docx"; a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 2500);
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  }

  useEffect(() => {
    // Auto-run only if we have real audit data
    if (claimResults.length > 0) run();
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
        body: JSON.stringify({
          claimResults,
          documentText: documentText.trim() || undefined,
          customPersonas,
        }),
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

  function removeCustomPersona(i: number) {
    setCustomPersonas((prev) => prev.filter((_, idx) => idx !== i));
  }

  const overallVerdict = results ? (() => {
    const rejects  = results.filter((r) => r.verdict === "REJECTS").length;
    const concerns = results.filter((r) => r.verdict === "RAISES CONCERNS").length;
    if (rejects >= 2) return "REJECTS";
    if (rejects >= 1 || concerns >= 3) return "RAISES CONCERNS";
    if (concerns >= 1) return "RAISES CONCERNS";
    return "PASSES";
  })() : null;

  const vs = overallVerdict ? VERDICT_STYLE[overallVerdict] : null;

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#f2efe8", padding: "28px 24px 56px" }}>
      <style>{`
        @keyframes skelPulse  { 0%,100%{opacity:0.5}50%{opacity:1} }
        @keyframes cardAppear { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
            Persona Stress Test
          </p>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: "#0d0d0d", lineHeight: 1.2 }}>
            {results ? `${results.length} perspectives.` : "Five legal perspectives."}
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
          <div style={{ display: "flex", gap: 8 }}>
            {results && (
              <button
                onClick={exportDocx}
                disabled={exporting}
                style={{ fontSize: 11, fontWeight: 600, color: exportDone ? "#166534" : "#1c3461", background: exportDone ? "#f0fdf4" : "transparent", border: `1px solid ${exportDone ? "#bbf7d0" : "#1c3461"}`, borderRadius: 6, padding: "6px 12px", cursor: exporting ? "not-allowed" : "pointer", opacity: exporting ? 0.5 : 1, transition: "all 0.25s" }}
              >
                {exporting ? "Exporting…" : exportDone ? "✓ Downloaded" : "↓ Word doc"}
              </button>
            )}
            <button
              onClick={run}
              style={{ fontSize: 11, fontWeight: 600, color: "#555", background: "transparent", border: "1px solid #ddd9d1", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}
            >
              ↺ Re-run
            </button>
          </div>
        )}
      </div>

      {/* Setup tools — always visible */}
      <DocumentUpload docText={documentText} onChange={setDocumentText} />
      <CustomPersonaBuilder onAdd={(p) => setCustomPersonas((prev) => [...prev, p])} />

      {/* Custom personas queue */}
      {customPersonas.length > 0 && (
        <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Custom personas ({customPersonas.length})
          </p>
          {customPersonas.map((cp, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: i > 0 ? "1px solid #c7d2fe" : "none" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: CUSTOM_BG_PALETTE[i % CUSTOM_BG_PALETTE.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {cp.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#1e293b" }}>{cp.name}</p>
                <p style={{ fontSize: 10, color: "#6366f1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cp.role}</p>
              </div>
              <button
                onClick={() => removeCustomPersona(i)}
                style={{ fontSize: 10, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Run button when in standalone/no-data mode */}
      {!loading && !results && (claimResults.length === 0) && (
        <button
          onClick={run}
          style={{ width: "100%", padding: "12px 0", borderRadius: 8, background: "#0d1f3c", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 20 }}
        >
          Run Stress Test →
        </button>
      )}

      {/* Overall verdict banner */}
      {vs && overallVerdict && (
        <div style={{ padding: "14px 18px", background: vs.bg, border: `1px solid ${vs.border}`, borderRadius: 8, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", animation: "cardAppear 0.3s ease" }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: vs.color, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>Overall verdict</p>
            <p style={{ fontSize: 14, fontWeight: 800, color: vs.color, fontFamily: "Georgia, serif" }}>{vs.label}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: vs.color }}>
              {results?.filter((r) => r.verdict === "REJECTS").length} rejects ·{" "}
              {results?.filter((r) => r.verdict === "RAISES CONCERNS").length} concerns ·{" "}
              {results?.filter((r) => r.verdict === "PASSES").length} passes
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 12, color: "#991b1b", marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {loading && SKELETON_PERSONAS.map((p) => <SkeletonCard key={p.id} persona={p} />)}
        {results && results.map((r) => (
          <PersonaCard key={r.id} result={r} isCustom={r.id.startsWith("custom-")} />
        ))}
      </div>

      {(results || error) && (
        <p style={{ fontSize: 10, color: "#c4bfb8", textAlign: "center", marginTop: 24 }}>
          Persona assessments generated by Claude · Not legal advice
        </p>
      )}
    </div>
  );
}
