"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentSnapshot {
  sourcerStatus: "CITED" | "INFERRED" | "NOT_FOUND";
  jurisdictionStatus: "APPLICABLE" | "WRONG_JURISDICTION" | "UNCLEAR";
  jurisdictionConfidence: number;
  historianStatus: "CURRENT" | "AMENDED" | "UNKNOWN";
  devilStrength: "high" | "medium" | "low";
  memoryStatus: "CONTRADICTION_FOUND" | "NO_CONFLICT";
}

interface SimResult {
  pDontSend: number;
  pReview: number;
  pProceed: number;
  n: number;
}

// ── Demo defaults ─────────────────────────────────────────────────────────────

const DEMO_SNAPSHOT: AgentSnapshot = {
  sourcerStatus: "INFERRED",
  jurisdictionStatus: "WRONG_JURISDICTION",
  jurisdictionConfidence: 97,
  historianStatus: "AMENDED",
  devilStrength: "high",
  memoryStatus: "CONTRADICTION_FOUND",
};

// ── Snapshot from real results (worst-case across all claims) ─────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function snapshotFromResults(results: any[]): AgentSnapshot | null {
  if (!results.length) return null;
  const worstSourcer = results.some((r) => r.sourcer?.status === "NOT_FOUND")
    ? "NOT_FOUND"
    : results.some((r) => r.sourcer?.status === "INFERRED")
      ? "INFERRED"
      : "CITED";
  const worstJurisd = results.some((r) => r.jurisdictionist?.status === "WRONG_JURISDICTION")
    ? "WRONG_JURISDICTION"
    : results.some((r) => r.jurisdictionist?.status === "UNCLEAR")
      ? "UNCLEAR"
      : "APPLICABLE";
  const maxConf = Math.max(...results.map((r) => r.jurisdictionist?.confidence ?? 50));
  const worstHist = results.some((r) => r.historian?.status === "AMENDED")
    ? "AMENDED"
    : results.some((r) => r.historian?.status === "UNKNOWN")
      ? "UNKNOWN"
      : "CURRENT";
  const worstDevil = results.some((r) => r.devils_advocate?.strength === "high")
    ? "high"
    : results.some((r) => r.devils_advocate?.strength === "medium")
      ? "medium"
      : "low";
  const worstMem = results.some((r) => r.firm_memory?.status === "CONTRADICTION_FOUND")
    ? "CONTRADICTION_FOUND"
    : "NO_CONFLICT";
  return {
    sourcerStatus: worstSourcer,
    jurisdictionStatus: worstJurisd,
    jurisdictionConfidence: maxConf,
    historianStatus: worstHist,
    devilStrength: worstDevil,
    memoryStatus: worstMem,
  };
}

// ── Monte Carlo core ──────────────────────────────────────────────────────────

function runIteration(snap: AgentSnapshot): number {
  let deduction = 0;
  const pSourcer = snap.sourcerStatus === "NOT_FOUND" ? 0.95 : snap.sourcerStatus === "INFERRED" ? 0.65 : 0.05;
  if (Math.random() < pSourcer) deduction += 20;
  const pJurisd = snap.jurisdictionStatus === "WRONG_JURISDICTION"
    ? snap.jurisdictionConfidence / 100
    : snap.jurisdictionStatus === "UNCLEAR" ? 0.45 : 0.05;
  if (Math.random() < pJurisd) deduction += 25;
  const pHist = snap.historianStatus === "AMENDED" ? 0.78 : snap.historianStatus === "UNKNOWN" ? 0.38 : 0.05;
  if (Math.random() < pHist) deduction += 15;
  const pDevil = snap.devilStrength === "high" ? 0.85 : snap.devilStrength === "medium" ? 0.55 : 0.18;
  if (Math.random() < pDevil) deduction += 20;
  const pMem = snap.memoryStatus === "CONTRADICTION_FOUND" ? 0.90 : 0.05;
  if (Math.random() < pMem) deduction += 20;
  const noise = (Math.random() + Math.random() - 1) * 12;
  return Math.max(0, Math.min(100, 100 - deduction + noise));
}

function computeStats(scores: number[]): SimResult {
  const n = scores.length;
  let dontSend = 0, review = 0, proceed = 0;
  for (const s of scores) {
    if (s < 40) dontSend++; else if (s < 70) review++; else proceed++;
  }
  return {
    pDontSend: (dontSend / n) * 100,
    pReview: (review / n) * 100,
    pProceed: (proceed / n) * 100,
    n,
  };
}

const N_TOTAL = 2000;
const BATCH   = 100;

// ── Advice types ──────────────────────────────────────────────────────────────

interface AdviceFlaggedArea {
  claim_snippet: string;
  issue: string;
  suggestion: string;
  recommended_sources: string[];
}

interface Advice {
  summary: string;
  flagged_areas: AdviceFlaggedArea[];
  overall_recommendation: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MonteCarloPanel({
  claimResults,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  claimResults: any[];
}) {
  const [progress, setProgress] = useState(0);
  const [result, setResult]     = useState<SimResult | null>(null);
  const [live, setLive]         = useState<SimResult | null>(null);
  const [running, setRunning]   = useState(false);
  const [advice, setAdvice]     = useState<Advice | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const rafRef    = useRef<number>(0);
  const scoresRef = useRef<number[]>([]);

  const snapshot  = snapshotFromResults(claimResults) ?? DEMO_SNAPSHOT;
  const usingDemo = claimResults.length === 0;
  const display   = live ?? result;

  // Auto-run on mount
  useEffect(() => {
    const id = setTimeout(() => startSimulation(), 400);
    return () => { clearTimeout(id); cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startSimulation() {
    cancelAnimationFrame(rafRef.current);
    scoresRef.current = [];
    setRunning(true);
    setProgress(0);
    setResult(null);
    setLive(null);
    setAdvice(null);

    function runBatch() {
      for (let i = 0; i < BATCH; i++) scoresRef.current.push(runIteration(snapshot));
      const done = scoresRef.current.length;
      setProgress(done / N_TOTAL);
      if (done % (BATCH * 5) === 0) setLive(computeStats(scoresRef.current));
      if (done < N_TOTAL) {
        rafRef.current = requestAnimationFrame(runBatch);
      } else {
        const final = computeStats(scoresRef.current);
        setResult(final);
        setLive(final);
        setRunning(false);
      }
    }
    rafRef.current = requestAnimationFrame(runBatch);
  }

  async function getAdvice() {
    if (!result || adviceLoading) return;
    setAdviceLoading(true);
    setAdvice(null);
    try {
      const res = await fetch("/api/monte-carlo-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimResults, meanScore: result.pProceed > 50 ? 75 : result.pReview > 50 ? 55 : 30 }),
      });
      const data: Advice = await res.json();
      setAdvice(data);
    } catch (e) {
      console.error(e);
    } finally {
      setAdviceLoading(false);
    }
  }

  // ── Verdict config ────────────────────────────────────────────────────────

  type Verdict = "dont-send" | "review" | "proceed";
  const verdict: Verdict = !display
    ? "review"
    : display.pDontSend >= display.pReview && display.pDontSend >= display.pProceed
      ? "dont-send"
      : display.pProceed >= display.pReview && display.pProceed >= display.pDontSend
        ? "proceed"
        : "review";

  const VERDICTS: Record<Verdict, {
    label: string; emoji: string;
    color: string; bg: string; border: string;
    headline: string; body: string;
    nextSteps: string[];
  }> = {
    "dont-send": {
      label: "Do Not Send",
      emoji: "✕",
      color: "#b91c1c",
      bg: "#fef2f2",
      border: "#fecaca",
      headline: "This memo has significant legal risks and should not be sent as drafted.",
      body: "Our agents found problems that make this advice unreliable. Sending it without correction could expose the firm to negligence claims.",
      nextSteps: [
        "Address the flagged citation errors before sending",
        "Have a senior partner review the jurisdictional analysis",
        "Do not rely on this memo until the issues below are resolved",
      ],
    },
    "review": {
      label: "Needs Review",
      emoji: "⚠",
      color: "#92400e",
      bg: "#fffbeb",
      border: "#fde68a",
      headline: "This memo needs senior review before it goes out.",
      body: "There are some concerns that could be legitimate issues or just areas where more verification is needed. A senior partner should sign off before this leaves the firm.",
      nextSteps: [
        "Flag the highlighted citations for partner review",
        "Consider verifying the jurisdiction analysis independently",
        "Proceed only after resolving open questions",
      ],
    },
    "proceed": {
      label: "Clear to Send",
      emoji: "✓",
      color: "#15803d",
      bg: "#f0fdf4",
      border: "#bbf7d0",
      headline: "This memo appears legally sound and can be sent.",
      body: "Our verification found no significant issues with the citations, jurisdiction, or currency of the law cited. Standard partner sign-off applies.",
      nextSteps: [
        "Complete standard partner review",
        "Note any minor qualifications flagged below",
        "Send with confidence",
      ],
    },
  };

  const v = VERDICTS[verdict];
  const verdictPct = !display ? 0
    : verdict === "dont-send" ? display.pDontSend
    : verdict === "proceed" ? display.pProceed
    : display.pReview;

  // Plain-English risk factors
  const risks: Array<{ text: string; severity: "bad" | "warn" | "ok" }> = [
    snapshot.sourcerStatus === "NOT_FOUND"
      ? { text: "Citations could not be found in the primary source material", severity: "bad" }
      : snapshot.sourcerStatus === "INFERRED"
        ? { text: "Some citations appear paraphrased — they could not be verified verbatim", severity: "warn" }
        : { text: "All citations verified against primary sources", severity: "ok" },
    snapshot.jurisdictionStatus === "WRONG_JURISDICTION"
      ? { text: `The cited regulation may not apply to this client entity (${snapshot.jurisdictionConfidence}% confidence)`, severity: "bad" }
      : snapshot.jurisdictionStatus === "UNCLEAR"
        ? { text: "It is unclear whether the cited law applies to this client", severity: "warn" }
        : { text: "The cited law applies to this client", severity: "ok" },
    snapshot.historianStatus === "AMENDED"
      ? { text: "At least one cited provision has been amended — the memo may cite an outdated version", severity: "warn" }
      : snapshot.historianStatus === "UNKNOWN"
        ? { text: "Could not confirm whether all cited law is still current", severity: "warn" }
        : { text: "All cited law is current and in force", severity: "ok" },
    snapshot.devilStrength === "high"
      ? { text: "A strong counter-argument exists that opposing counsel is likely to raise", severity: "bad" }
      : snapshot.devilStrength === "medium"
        ? { text: "There is a moderate counter-argument the advice should address", severity: "warn" }
        : { text: "No strong counter-arguments identified", severity: "ok" },
    snapshot.memoryStatus === "CONTRADICTION_FOUND"
      ? { text: "This advice may conflict with a position the firm has previously taken", severity: "bad" }
      : { text: "No conflicts with the firm's prior advice", severity: "ok" },
  ];

  const SEV_ICON:  Record<string, string> = { bad: "✕", warn: "⚠", ok: "✓" };
  const SEV_COLOR: Record<string, string> = { bad: "#b91c1c", warn: "#92400e", ok: "#15803d" };
  const SEV_BG:    Record<string, string> = { bad: "#fef2f2", warn: "#fffbeb", ok: "#f0fdf4" };

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: "#f8fafc", padding: "32px 28px 56px" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">Risk Assessment</p>
          {usingDemo && (
            <p className="text-[10px] text-slate-400 mt-0.5 italic">Using demo scenario</p>
          )}
        </div>
        <button
          onClick={startSimulation}
          disabled={running}
          className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
        >
          {running ? `Analysing… ${Math.round(progress * 100)}%` : "↺ Re-run"}
        </button>
      </div>

      {/* ── Running state ── */}
      {running && !display && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div
            className="w-16 h-16 rounded-full mb-6 flex items-center justify-center text-2xl"
            style={{ background: "#e0e7ff", color: "#4f46e5" }}
          >
            ◎
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-2">Running risk simulation…</p>
          <p className="text-xs text-slate-400">Modelling 2,000 possible audit outcomes</p>
          <div className="w-48 h-1 rounded-full bg-slate-200 mt-6 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-100"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {display && (
        <div className="space-y-5">

          {/* Verdict hero card */}
          <div
            className="rounded-2xl border p-7 text-center"
            style={{ background: v.bg, borderColor: v.border }}
          >
            {/* Icon */}
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4"
              style={{ background: v.color + "18", color: v.color, border: `2px solid ${v.color}30` }}
            >
              {v.emoji}
            </div>

            {/* Label */}
            <p
              className="text-2xl font-bold mb-1"
              style={{ color: v.color }}
            >
              {v.label}
            </p>

            {/* Confidence */}
            <p className="text-sm mb-4" style={{ color: v.color + "80" }}>
              {Math.round(verdictPct)}% probability across simulated scenarios
            </p>

            {/* Explanation */}
            <p className="text-sm text-slate-600 leading-relaxed mb-5 max-w-sm mx-auto">
              {v.headline}
            </p>

            {/* Three probability pills */}
            <div className="flex justify-center gap-2 flex-wrap">
              {[
                { label: "Don't send", pct: display.pDontSend, color: "#b91c1c", bg: "#fef2f2" },
                { label: "Needs review", pct: display.pReview,   color: "#92400e", bg: "#fffbeb" },
                { label: "Clear to send", pct: display.pProceed,  color: "#15803d", bg: "#f0fdf4" },
              ].map((o) => (
                <div
                  key={o.label}
                  className="rounded-full px-4 py-1.5 text-xs font-semibold"
                  style={{ background: o.bg, color: o.color, border: `1px solid ${o.color}25` }}
                >
                  {o.label} — {Math.round(o.pct)}%
                </div>
              ))}
            </div>
          </div>

          {/* What this means */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">What this means</p>
            <p className="text-sm text-slate-700 leading-relaxed mb-4">{v.body}</p>
            <div className="space-y-2">
              {v.nextSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-slate-300 text-sm mt-0.5 shrink-0">→</span>
                  <p className="text-sm text-slate-600">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Risk factors */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">What the agents found</p>
            <div className="space-y-2.5">
              {risks.map((risk, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl px-3.5 py-2.5"
                  style={{ background: SEV_BG[risk.severity] }}
                >
                  <span
                    className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                    style={{ background: SEV_COLOR[risk.severity] + "20", color: SEV_COLOR[risk.severity] }}
                  >
                    {SEV_ICON[risk.severity]}
                  </span>
                  <p className="text-sm text-slate-700 leading-snug">{risk.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* AI suggestions (only if result is not great) */}
          {!running && result && (verdict === "dont-send" || verdict === "review") && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Get AI suggestions</p>
                {!advice && (
                  <button
                    onClick={getAdvice}
                    disabled={adviceLoading || usingDemo}
                    className="text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all disabled:opacity-40"
                    style={{ background: "#1c3461", color: "#fff" }}
                  >
                    {adviceLoading ? "Thinking…" : "How do I fix this?"}
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-500 mb-4">
                {usingDemo
                  ? "Run a real audit to get specific suggestions for improving your memo."
                  : "Claude can identify which citations to fix and suggest stronger alternatives."}
              </p>

              {advice && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-700 leading-relaxed">{advice.summary}</p>

                  {advice.flagged_areas.map((area, i) => (
                    <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                      <blockquote className="text-xs text-slate-400 italic border-l-2 border-slate-200 pl-3 line-clamp-2">
                        &ldquo;{area.claim_snippet}&rdquo;
                      </blockquote>
                      <p className="text-sm font-semibold text-red-600">⚠ {area.issue}</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{area.suggestion}</p>
                      {area.recommended_sources.length > 0 && (
                        <div className="pt-1">
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">Better sources</p>
                          <ul className="space-y-1">
                            {area.recommended_sources.map((src, j) => (
                              <li key={j} className="text-xs text-slate-500 flex items-start gap-2">
                                <span className="text-indigo-400 shrink-0 mt-0.5">→</span>
                                {src}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}

                  {advice.overall_recommendation && (
                    <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
                      <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-semibold mb-1">Recommendation</p>
                      <p className="text-sm text-indigo-900 leading-relaxed">{advice.overall_recommendation}</p>
                    </div>
                  )}

                  <button
                    onClick={() => setAdvice(null)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
                  >
                    ✕ Dismiss
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer note */}
          <p className="text-[10px] text-slate-300 text-center pt-1">
            Based on 2,000 simulated audit scenarios · Not legal advice
          </p>
        </div>
      )}
    </div>
  );
}
