"use client";

import { useState } from "react";
import type { ClaimResult } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type Stance = "strict_textual" | "purposive" | "commercially_pragmatic";
type Framing = "narrow" | "standard" | "broad";
type Angle = "direct" | "ratio_first";
type Verdict = "supports" | "partially_supports" | "does_not_support";

interface RunDetail {
  stance: Stance;
  framing: Framing;
  angle: Angle;
  verdict: Verdict;
  reasoning: string;
  key_limitation?: string;
}

interface StanceBreakdown {
  label: string;
  supports: number;
  partially: number;
  rejects: number;
  total: number;
}

interface MatchResult {
  confidence: number;
  stanceBreakdown: Record<Stance, StanceBreakdown>;
  factSensitivity: string;
  topFailureReasons: string[];
  allRuns: RunDetail[];
  runsCompleted: number;
  mode: "quick" | "full";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const color =
    confidence >= 70 ? "#15803d"
    : confidence >= 40 ? "#92400e"
    : "#b91c1c";
  const bg =
    confidence >= 70 ? "#f0fdf4"
    : confidence >= 40 ? "#fffbeb"
    : "#fef2f2";
  const border =
    confidence >= 70 ? "#bbf7d0"
    : confidence >= 40 ? "#fde68a"
    : "#fecaca";
  const label =
    confidence >= 70 ? "Likely Supports"
    : confidence >= 40 ? "Uncertain Match"
    : "Does Not Support";

  return (
    <div
      className="rounded-2xl border p-7 text-center"
      style={{ background: bg, borderColor: border }}
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4"
        style={{ background: color + "18", color, border: `2px solid ${color}30` }}
      >
        {confidence >= 70 ? "✓" : confidence >= 40 ? "⚠" : "✕"}
      </div>
      <p className="text-3xl font-bold mb-1" style={{ color }}>
        {confidence}%
      </p>
      <p className="text-sm font-semibold mb-2" style={{ color }}>
        {label}
      </p>
      <p className="text-xs text-slate-500">proposition match confidence</p>

      {/* Track */}
      <div className="mt-5 h-2 rounded-full bg-slate-100 overflow-hidden max-w-xs mx-auto">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${confidence}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function StanceCard({ stance, bd }: { stance: Stance; bd: StanceBreakdown }) {
  if (bd.total === 0) return null;

  const supportPct = Math.round((bd.supports / bd.total) * 100);
  const partialPct = Math.round((bd.partially / bd.total) * 100);
  const rejectPct  = Math.round((bd.rejects  / bd.total) * 100);

  const dominant =
    bd.supports > bd.rejects && bd.supports > bd.partially ? "supports"
    : bd.rejects > bd.supports && bd.rejects > bd.partially ? "rejects"
    : "partially";

  const STANCE_ICON: Record<string, string> = {
    strict_textual:         "T",
    purposive:              "P",
    commercially_pragmatic: "C",
  };

  const dominantColor =
    dominant === "supports" ? "#15803d"
    : dominant === "rejects" ? "#b91c1c"
    : "#92400e";

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: dominantColor + "18", color: dominantColor }}
        >
          {STANCE_ICON[stance]}
        </div>
        <p className="text-sm font-semibold text-slate-800">{bd.label}</p>
      </div>

      {/* Stacked bar */}
      <div className="flex rounded-full overflow-hidden h-2.5 mb-3 gap-0.5">
        {supportPct > 0 && (
          <div style={{ width: `${supportPct}%`, background: "#15803d" }} className="rounded-l-full" />
        )}
        {partialPct > 0 && (
          <div style={{ width: `${partialPct}%`, background: "#f59e0b" }} />
        )}
        {rejectPct > 0 && (
          <div style={{ width: `${rejectPct}%`, background: "#ef4444" }} className="rounded-r-full" />
        )}
      </div>

      <div className="flex gap-3 text-[11px]">
        <span style={{ color: "#15803d" }} className="font-semibold">
          {bd.supports}/{bd.total} support
        </span>
        {bd.partially > 0 && (
          <span style={{ color: "#92400e" }} className="font-semibold">
            {bd.partially} partial
          </span>
        )}
        <span style={{ color: "#b91c1c" }} className="font-semibold">
          {bd.rejects} reject
        </span>
      </div>

      {/* Descriptive verdict */}
      <p className="text-xs text-slate-500 mt-2 leading-snug">
        {dominant === "supports"
          ? `Supports proposition under ${bd.label.toLowerCase()} reading (${supportPct}% of runs)`
          : dominant === "rejects"
          ? `Does not support under ${bd.label.toLowerCase()} reading (${rejectPct}% of runs)`
          : `Mixed result under ${bd.label.toLowerCase()} reading`}
      </p>
    </div>
  );
}

function RunsGrid({ runs }: { runs: RunDetail[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayRuns = expanded ? runs : runs.slice(0, 6);

  const VERDICT_DOT: Record<Verdict, { color: string; label: string }> = {
    supports:            { color: "#15803d", label: "S" },
    partially_supports:  { color: "#f59e0b", label: "P" },
    does_not_support:    { color: "#ef4444", label: "✕" },
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
        All runs ({runs.length} total)
      </p>
      <div className="grid grid-cols-1 gap-2">
        {displayRuns.map((run, i) => {
          const dot = VERDICT_DOT[run.verdict];
          return (
            <div key={i} className="flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                style={{ background: dot.color + "20", color: dot.color }}
              >
                {dot.label}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex gap-1.5 flex-wrap mb-1">
                  {[
                    run.stance === "strict_textual" ? "Strict" : run.stance === "purposive" ? "Purposive" : "Pragmatic",
                    run.framing === "narrow" ? "Narrow" : run.framing === "broad" ? "Broad" : "Standard",
                    run.angle === "ratio_first" ? "Ratio-First" : "Direct",
                  ].map((tag) => (
                    <span key={tag} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "#e2e8f0", color: "#64748b" }}>
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">{run.reasoning}</p>
                {run.key_limitation && (
                  <p className="text-[10px] text-red-500 mt-1 italic">{run.key_limitation}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {runs.length > 6 && (
        <button
          onClick={() => setExpanded((x) => !x)}
          className="mt-3 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          {expanded ? "↑ Show less" : `↓ Show all ${runs.length} runs`}
        </button>
      )}
    </div>
  );
}

// ── Input form ────────────────────────────────────────────────────────────────

interface FormProps {
  onSubmit: (caseName: string, caseText: string, proposition: string, mode: "quick" | "full") => void;
  loading: boolean;
  prefill?: { caseName: string; caseText: string };
}

function InputForm({ onSubmit, loading, prefill }: FormProps) {
  const [caseName, setCaseName]       = useState(prefill?.caseName ?? "");
  const [caseText, setCaseText]       = useState(prefill?.caseText ?? "");
  const [proposition, setProposition] = useState("");
  const [mode, setMode]               = useState<"quick" | "full">("quick");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!caseName.trim() || !proposition.trim()) return;
    onSubmit(caseName, caseText, proposition, mode);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
          Case citation
        </label>
        <input
          value={caseName}
          onChange={(e) => setCaseName(e.target.value)}
          placeholder="e.g. Salomon v Salomon & Co [1897] AC 22"
          className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
          Case summary
          <span className="ml-2 font-normal text-slate-400 normal-case tracking-normal">optional — helps if the case is obscure</span>
        </label>
        <textarea
          value={caseText}
          onChange={(e) => setCaseText(e.target.value)}
          placeholder="Paste a short excerpt or summary of the case…"
          rows={3}
          className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
          Proposition to test
        </label>
        <textarea
          value={proposition}
          onChange={(e) => setProposition(e.target.value)}
          placeholder="e.g. A company has separate legal personality from its members and cannot be held liable for their personal debts"
          rows={3}
          className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
          required
        />
      </div>

      {/* Mode selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
          Analysis depth
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["quick", "full"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="rounded-lg border py-3 px-4 text-left transition-all"
              style={{
                borderColor: mode === m ? "#4f46e5" : "#e2e8f0",
                background: mode === m ? "#eef2ff" : "#ffffff",
              }}
            >
              <p className="text-xs font-bold mb-0.5" style={{ color: mode === m ? "#4f46e5" : "#374151" }}>
                {m === "quick" ? "Quick — 3 runs" : "Deep — 18 runs"}
              </p>
              <p className="text-[10px] text-slate-400">
                {m === "quick"
                  ? "3 interpretive stances · ~10 s"
                  : "3 stances × 3 framings × 2 angles · ~30 s"}
              </p>
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !caseName.trim() || !proposition.trim()}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
        style={{ background: "#1c3461" }}
      >
        {loading ? "Running analysis…" : "Run Proposition Match →"}
      </button>
    </form>
  );
}

// ── Progress indicator ────────────────────────────────────────────────────────

function LoadingState({ mode }: { mode: "quick" | "full" }) {
  const total = mode === "quick" ? 3 : 18;
  const stances = ["Strict Textual", "Purposive", "Commercially Pragmatic"];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="w-16 h-16 rounded-full mb-6 flex items-center justify-center text-2xl"
        style={{ background: "#e0e7ff", color: "#4f46e5" }}
      >
        ◎
      </div>
      <p className="text-sm font-semibold text-slate-700 mb-2">
        Running {total} parallel checks…
      </p>
      <p className="text-xs text-slate-400 mb-6 max-w-xs">
        Testing your proposition across different interpretive stances, factual framings, and extraction angles
      </p>
      <div className="space-y-2 w-56">
        {stances.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background: "#4f46e5",
                animation: `dotPulse 1.2s ease-in-out ${i * 0.4}s infinite`,
              }}
            />
            <p className="text-xs text-slate-500">{s}</p>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes dotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.6); }
        }
      `}</style>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PropositionMatchPanel({
  claimResults,
}: {
  claimResults: ClaimResult[];
}) {
  const [result, setResult]     = useState<MatchResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [activeMode, setActiveMode] = useState<"quick" | "full">("quick");
  const [showForm, setShowForm] = useState(true);
  const [lastQuery, setLastQuery] = useState<{ caseName: string; proposition: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  async function exportDocx() {
    if (!result || !lastQuery || exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export-proposition-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, caseName: lastQuery.caseName, proposition: lastQuery.proposition }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "ratio-proposition-match.docx"; a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 2500);
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  }

  // Pre-populate from audit results if available
  const prefillOptions = claimResults
    .filter((r) => r.devils_advocate?.counter_authority)
    .map((r) => ({
      caseName: r.devils_advocate.counter_authority,
      caseText: r.devils_advocate.why_it_undermines ?? "",
    }));

  async function handleSubmit(
    caseName: string,
    caseText: string,
    proposition: string,
    mode: "quick" | "full"
  ) {
    setLoading(true);
    setError("");
    setResult(null);
    setActiveMode(mode);
    setShowForm(false);
    setLastQuery({ caseName, proposition });

    try {
      const res = await fetch("/api/proposition-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseName, caseText, proposition, mode }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data: MatchResult = await res.json();
      setResult(data);
    } catch (e) {
      setError("Analysis failed. Please try again.");
      console.error(e);
      setShowForm(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#f8fafc", padding: "32px 28px 56px" }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">
            Monte Carlo Proposition Match
          </p>
          <p className="text-[10px] text-slate-300 mt-0.5">
            Multi-run analysis across interpretive stances, factual framings &amp; extraction angles
          </p>
        </div>
        {result && (
          <div className="flex items-center gap-2">
            <button
              onClick={exportDocx}
              disabled={exporting}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all disabled:opacity-40"
              style={{
                borderColor: exportDone ? "#bbf7d0" : "#1c3461",
                color: exportDone ? "#166534" : "#1c3461",
                background: exportDone ? "#f0fdf4" : "transparent",
              }}
            >
              {exporting ? "Exporting…" : exportDone ? "✓ Downloaded" : "↓ Word doc"}
            </button>
            <button
              onClick={() => { setResult(null); setShowForm(true); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              ← New query
            </button>
          </div>
        )}
      </div>

      {/* Explainer card */}
      {showForm && !loading && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-5">
          <p className="text-xs font-semibold text-indigo-700 mb-1">How this works</p>
          <p className="text-[11px] text-indigo-600 leading-relaxed">
            Instead of asking once whether a case supports a proposition, we run the same question
            multiple times under different interpretive stances (strict textual, purposive, commercially
            pragmatic), factual framings (narrow/broad), and extraction angles (direct vs ratio-first).
            The distribution of verdicts tells you <em>how confidently</em> the citation holds — and exactly <em>why</em> it fails.
          </p>
        </div>
      )}

      {/* Input form */}
      {showForm && !loading && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mb-5" style={{ animation: "fadeUp 0.2s ease" }}>
          <InputForm
            onSubmit={handleSubmit}
            loading={loading}
            prefill={prefillOptions.length > 0 ? prefillOptions[0] : undefined}
          />

          {/* Quick prefill from audit results */}
          {prefillOptions.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-2">
                Cases from your audit
              </p>
              <div className="space-y-1.5">
                {prefillOptions.slice(0, 3).map((opt, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => {}}
                  >
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">{i + 1}</span>
                    <p className="text-xs text-slate-600 truncate">{opt.caseName}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && <LoadingState mode={activeMode} />}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-5">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5" style={{ animation: "fadeUp 0.3s ease" }}>

          {/* Confidence hero */}
          <ConfidenceMeter confidence={result.confidence} />

          {/* Mode badge */}
          <p className="text-center text-[10px] text-slate-400">
            Based on {result.runsCompleted} runs ·{" "}
            {result.mode === "quick" ? "3 interpretive stances" : "3 stances × 3 framings × 2 extraction angles"}
          </p>

          {/* Stance breakdown */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              By Interpretive Stance
            </p>
            <div className="grid grid-cols-1 gap-3">
              {(Object.keys(result.stanceBreakdown) as (keyof typeof result.stanceBreakdown)[]).map(
                (stance) => (
                  <StanceCard key={stance} stance={stance} bd={result.stanceBreakdown[stance]} />
                )
              )}
            </div>
          </div>

          {/* Fact sensitivity */}
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
              Fact Sensitivity
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">{result.factSensitivity}</p>
          </div>

          {/* Failure reasons */}
          {result.topFailureReasons.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                Key Failure Reasons
              </p>
              <div className="space-y-2">
                {result.topFailureReasons.map((reason, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-lg bg-red-50 px-3 py-2.5">
                    <span className="text-red-400 shrink-0 mt-0.5 text-xs font-bold">✕</span>
                    <p className="text-[12px] text-slate-700 leading-snug">{reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upgrade prompt if in quick mode */}
          {result.mode === "quick" && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              <p className="text-xs font-semibold text-indigo-700 mb-1">Want deeper analysis?</p>
              <p className="text-[11px] text-indigo-600 leading-relaxed mb-2">
                The full 18-run analysis tests 3 factual framings (narrow/standard/broad) and compares
                direct matching against ratio-first extraction — catching cases where the quote is accurate
                but the ratio is being misapplied.
              </p>
              <button
                onClick={() => { setResult(null); setShowForm(true); }}
                className="text-[11px] font-semibold text-indigo-700 underline"
              >
                Run 18-run deep analysis →
              </button>
            </div>
          )}

          {/* All runs grid */}
          <RunsGrid runs={result.allRuns} />

          <p className="text-[10px] text-slate-300 text-center pt-1">
            Monte Carlo proposition matching · Not legal advice
          </p>
        </div>
      )}
    </div>
  );
}
