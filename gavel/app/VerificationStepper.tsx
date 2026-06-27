"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import type { ClaimResult } from "@/lib/types";

type Decision = "pending" | "kept" | "skipped";

// ── Find a substring in doc (case-insensitive) ────────────────────────────────

function findStr(doc: string, needle: string, from = 0): { start: number; end: number } | null {
  if (!needle) return null;
  const idx = doc.toLowerCase().indexOf(needle.toLowerCase(), from);
  if (idx === -1) return null;
  return { start: idx, end: idx + needle.length };
}

// ── Find just the citation reference (article/regulation) ──

function findCitation(docText: string, r: ClaimResult): { start: number; end: number } | null {
  const article = (r.claim.article ?? "").trim();
  const regulation = (r.claim.regulation ?? "").trim();

  // 1. Regulation + article together (e.g. "CDPA 1988 s11(2)")
  if (regulation && article) {
    const p = findStr(docText, `${regulation} ${article}`);
    if (p) return p;
  }

  // 2. Article alone — try exact, then with/without space after leading letter
  if (article) {
    const p = findStr(docText, article);
    if (p) return p;
    // "s11(2)" → "s 11(2)" variant
    const spaced = article.replace(/^([a-zA-Z])(\d)/, "$1 $2");
    if (spaced !== article) {
      const p2 = findStr(docText, spaced);
      if (p2) return p2;
    }
    // "s 11(2)" → "s11(2)" (remove spurious space)
    const unspaced = article.replace(/^([a-zA-Z]) (\d)/, "$1$2");
    if (unspaced !== article) {
      const p3 = findStr(docText, unspaced);
      if (p3) return p3;
    }
  }

  // 3. Regulation alone
  if (regulation) {
    const p = findStr(docText, regulation);
    if (p) return p;
  }

  // 4. Any 4+ consecutive words from the claim text
  const words = r.claim.text.split(/\s+/).filter((w) => w.length > 3);
  for (let win = Math.min(5, words.length); win >= 3; win--) {
    for (let s = 0; s + win <= words.length; s++) {
      const phrase = words.slice(s, s + win).join(" ");
      const p = findStr(docText, phrase);
      if (p) return p;
    }
  }

  return null;
}

// ── Build segments highlighting only citation spans ───────────────────────────

interface Segment { text: string; claimIndex: number | null }

function buildSegments(docText: string, results: ClaimResult[]): Segment[] {
  type Span = { start: number; end: number; claimIndex: number };
  const spans: Span[] = results
    .map((r, i) => { const p = findCitation(docText, r); return p ? { ...p, claimIndex: i } : null; })
    .filter((x): x is Span => x !== null)
    .sort((a, b) => a.start - b.start);

  const clean: Span[] = [];
  for (const sp of spans) {
    const prev = clean[clean.length - 1];
    if (!prev || sp.start >= prev.end) clean.push(sp);
  }

  const segs: Segment[] = [];
  let cur = 0;
  for (const sp of clean) {
    if (sp.start > cur) segs.push({ text: docText.slice(cur, sp.start), claimIndex: null });
    segs.push({ text: docText.slice(sp.start, sp.end), claimIndex: sp.claimIndex });
    cur = sp.end;
  }
  if (cur < docText.length) segs.push({ text: docText.slice(cur), claimIndex: null });
  return segs;
}

// ── Pick the single worst finding ────────────────────────────────────────────

function topFinding(r: ClaimResult): { label: string; detail: string; sev: "red" | "amber" | "green" } {
  if (r.jurisdictionist.status === "WRONG_JURISDICTION")
    return { label: "Wrong jurisdiction", detail: r.jurisdictionist.reason, sev: "red" };
  if (r.sourcer.status === "NOT_FOUND")
    return { label: "Source not found", detail: r.sourcer.discrepancy ?? "Citation could not be verified", sev: "red" };
  if (r.historian.status === "AMENDED")
    return { label: "Law amended", detail: r.historian.note, sev: "amber" };
  if (r.devils_advocate.strength === "high")
    return { label: "Counter-argument", detail: r.devils_advocate.why_it_undermines, sev: "amber" };
  if (r.sourcer.status === "INFERRED")
    return { label: "Citation unclear", detail: r.sourcer.discrepancy ?? "Paraphrased — not verbatim", sev: "amber" };
  if (r.firm_memory.status === "CONTRADICTION_FOUND")
    return { label: "Conflicts prior advice", detail: r.firm_memory.reference?.matter ?? "", sev: "amber" };
  return { label: "Verified", detail: r.sourcer.verbatim_quote ?? "Looks good", sev: "green" };
}

// ── Generate a pre-authored fix suggestion ────────────────────────────────────

function generateFix(r: ClaimResult): string {
  if (r.jurisdictionist.status === "WRONG_JURISDICTION")
    return `Remove or qualify this citation — ${r.claim.regulation} does not apply to your client entity under the identified jurisdiction. Consider replacing with the equivalent UK domestic provision or adding explicit jurisdictional caveats.`;
  if (r.sourcer.status === "NOT_FOUND")
    return `The exact text cited cannot be located in ${r.claim.regulation}. Verify the article number is current, or remove the citation and substitute a provision that can be verified verbatim.`;
  if (r.historian.status === "AMENDED")
    return `${r.claim.article || r.claim.regulation} has been amended. Update the reference to the current version and cross-check that the substantive obligation is unchanged.`;
  if (r.devils_advocate.strength === "high")
    return `A strong counter-authority exists. Add a qualification: "subject to [counter-authority]" or expand the advice to address the counter-argument directly before relying on this citation.`;
  if (r.sourcer.status === "INFERRED")
    return `The cited text is paraphrased rather than verbatim. Either quote the article directly or rephrase to "consistent with ${r.claim.article || r.claim.regulation}" to avoid overstating the legal support.`;
  if (r.firm_memory.status === "CONTRADICTION_FOUND")
    return `This advice may contradict a prior firm position. Flag for partner review before sending, or add a note explaining why the analysis has changed.`;
  return `Citation appears sound. No changes required — retain as drafted.`;
}

const C = {
  red:   { underline: "#ef4444", bg: "#fee2e2", text: "#b91c1c", pill: "#fca5a5" },
  amber: { underline: "#f59e0b", bg: "#fef3c7", text: "#92400e", pill: "#fcd34d" },
  green: { underline: "#22c55e", bg: "#dcfce7", text: "#15803d", pill: "#86efac" },
};

// ── Inline popup ──────────────────────────────────────────────────────────────

interface PopupState {
  claimIndex: number;
  rect: DOMRect;
}

// ─────────────────────────────────────────────────────────────────────────────

export function VerificationStepper({
  claimResults,
  docText,
  onComplete,
}: {
  claimResults: ClaimResult[];
  docText: string;
  onComplete: (kept: ClaimResult[]) => void;
}) {
  const [decisions, setDecisions] = useState<Decision[]>(() =>
    new Array(claimResults.length).fill("pending")
  );
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [showFix, setShowFix] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const segments = useMemo(() => buildSegments(docText, claimResults), [docText, claimResults]);

  // Dismiss popup on outside click
  useEffect(() => {
    if (!popup) return;
    function handleOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopup(null);
        setShowFix(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [popup]);

  function handleSpanClick(e: React.MouseEvent<HTMLSpanElement>, ci: number) {
    e.stopPropagation();
    if (popup?.claimIndex === ci) {
      setPopup(null);
      setShowFix(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ claimIndex: ci, rect });
    setShowFix(false);
  }

  const decide = useCallback((i: number, dec: Decision) => {
    setDecisions((prev) => {
      const next = [...prev];
      next[i] = next[i] === dec ? "pending" : dec;
      return next;
    });
    setPopup(null);
    setShowFix(false);
  }, []);

  const kept = decisions.filter((d) => d === "kept").length;
  const pending = decisions.filter((d) => d === "pending").length;

  // Compute popup position
  let popupLeft = 0;
  let popupTop = 0;
  if (popup) {
    const w = 300;
    popupLeft = Math.min(Math.max(popup.rect.left, 8), window.innerWidth - w - 8);
    popupTop = popup.rect.top - 8; // will move upward via transform
  }

  const activeResult = popup ? claimResults[popup.claimIndex] : null;
  const activeFinding = activeResult ? topFinding(activeResult) : null;
  const activeDecision = popup ? decisions[popup.claimIndex] : null;

  return (
    <div className="flex flex-1 min-h-0 w-full" style={{ position: "relative" }}>

      {/* ── Inline popup ── */}
      {popup && activeFinding && activeResult && (
        <div
          ref={popupRef}
          style={{
            position: "fixed",
            left: popupLeft,
            top: popupTop,
            transform: "translateY(-100%)",
            width: 300,
            zIndex: 9999,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
            padding: "12px 14px",
            pointerEvents: "auto",
          }}
        >
          {/* Arrow */}
          <div style={{
            position: "absolute", bottom: -6, left: Math.min(Math.max(popup.rect.left - popupLeft + (popup.rect.width / 2) - 6, 12), 278),
            width: 12, height: 12, background: "#fff",
            border: "1px solid #e2e8f0", borderTop: "none", borderLeft: "none",
            transform: "rotate(45deg)",
          }} />

          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              backgroundColor: C[activeFinding.sev].bg, color: C[activeFinding.sev].text,
            }}>
              {activeFinding.label}
            </span>
            <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>
              {activeResult.score}/100
            </span>
          </div>

          {/* Detail */}
          <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, margin: "0 0 10px" }}>
            {activeFinding.detail.slice(0, 120)}{activeFinding.detail.length > 120 ? "…" : ""}
          </p>

          {/* Suggest fix */}
          {showFix ? (
            <div style={{
              background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
              padding: "9px 11px", marginBottom: 10, fontSize: 11.5, color: "#374151", lineHeight: 1.55,
            }}>
              {generateFix(activeResult)}
            </div>
          ) : (
            <button
              onClick={() => setShowFix(true)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "7px 10px",
                marginBottom: 10, border: "1px dashed #cbd5e1", borderRadius: 8,
                fontSize: 12, color: "#64748b", background: "transparent", cursor: "pointer",
              }}
            >
              ✦ Suggest fix
            </button>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 7 }}>
            <button
              onClick={() => decide(popup.claimIndex, "skipped")}
              style={{
                flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 600,
                border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff",
                color: "#64748b", cursor: "pointer",
              }}
            >
              {activeDecision === "skipped" ? "Undo" : "Dismiss"}
            </button>
            <button
              onClick={() => decide(popup.claimIndex, "kept")}
              style={{
                flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 700,
                border: "none", borderRadius: 8,
                background: activeDecision === "kept" ? "#16a34a" : "#1c3461",
                color: "#fff", cursor: "pointer",
              }}
            >
              {activeDecision === "kept" ? "✓ Added" : "Add to report"}
            </button>
          </div>
        </div>
      )}

      {/* ── Document ── */}
      <div className="flex-1 overflow-y-auto bg-white px-16 py-12">
        <div
          className="max-w-[680px] mx-auto text-[15px] leading-8 text-slate-800 whitespace-pre-wrap"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {segments.map((seg, i) => {
            if (seg.claimIndex === null) return <span key={i}>{seg.text}</span>;

            const ci = seg.claimIndex;
            const r = claimResults[ci];
            const dec = decisions[ci];
            const f = topFinding(r);
            const col = C[f.sev];
            const isActive = popup?.claimIndex === ci;

            return (
              <span
                key={i}
                onClick={(e) => handleSpanClick(e, ci)}
                style={{
                  textDecoration: "underline",
                  textDecorationStyle: "wavy",
                  textDecorationColor: dec === "skipped" ? "#d1d5db" : col.underline,
                  textDecorationThickness: "2px",
                  backgroundColor: isActive ? col.bg : "transparent",
                  borderRadius: "2px",
                  cursor: "pointer",
                  opacity: dec === "skipped" ? 0.35 : 1,
                  padding: "0 1px",
                  transition: "background-color 0.15s",
                }}
                title={f.label}
              >
                {seg.text}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Sidebar ── */}
      <div className="w-52 shrink-0 flex flex-col border-l border-slate-200 bg-white">

        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-600">{pending} left · {kept} kept</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Click a citation to review</p>
        </div>

        {/* Issue list */}
        <div className="flex-1 overflow-y-auto py-1">
          {claimResults.map((r, i) => {
            const f = topFinding(r);
            const col = C[f.sev];
            const dec = decisions[i];
            const isActive = popup?.claimIndex === i;
            return (
              <button
                key={i}
                className={`w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-slate-50 transition-all ${isActive ? "bg-slate-50" : ""}`}
              >
                <span
                  className="shrink-0 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: dec === "skipped" ? "#d1d5db" : col.underline }}
                />
                <span
                  className="text-[11px] truncate"
                  style={{
                    color: dec === "skipped" ? "#d1d5db" : "#374151",
                    textDecoration: dec === "skipped" ? "line-through" : "none",
                  }}
                >
                  {r.claim.article || r.claim.regulation}
                </span>
                {dec === "kept" && <span className="text-green-500 text-[10px] ml-auto shrink-0">✓</span>}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={() => onComplete(claimResults.filter((_, i) => decisions[i] === "kept"))}
            className="w-full py-2 rounded-lg text-[12px] font-bold text-white"
            style={{ backgroundColor: "#1c3461" }}
          >
            {kept > 0 ? `Report (${kept})` : "Finish"}
          </button>
        </div>
      </div>
    </div>
  );
}
