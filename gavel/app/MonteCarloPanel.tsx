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
  histogram: number[];
  mean: number;
  stdDev: number;
  p5: number;
  p95: number;
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
  const histogram = new Array(20).fill(0);
  let sum = 0, dontSend = 0, review = 0, proceed = 0;
  for (const s of scores) {
    histogram[Math.min(19, Math.floor(s / 5))]++;
    sum += s;
    if (s < 40) dontSend++; else if (s < 70) review++; else proceed++;
  }
  const mean = sum / n;
  const variance = scores.reduce((a, s) => a + (s - mean) ** 2, 0) / n;
  const sorted = [...scores].sort((a, b) => a - b);
  return {
    histogram,
    mean,
    stdDev: Math.sqrt(variance),
    p5: sorted[Math.floor(n * 0.05)] ?? 0,
    p95: sorted[Math.floor(n * 0.95)] ?? 100,
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
  const maxBucket = display ? Math.max(...display.histogram, 1) : 1;

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
        body: JSON.stringify({ claimResults, meanScore: result.mean }),
      });
      const data: Advice = await res.json();
      setAdvice(data);
    } catch (e) {
      console.error(e);
    } finally {
      setAdviceLoading(false);
    }
  }

  // Dominant verdict
  const verdictLabel = !display ? null
    : display.pDontSend > display.pReview && display.pDontSend > display.pProceed ? "DO NOT SEND"
    : display.pProceed  > display.pReview && display.pProceed  > display.pDontSend ? "PROCEED"
    : "REVIEW REQUIRED";
  const verdictColor = verdictLabel === "DO NOT SEND" ? "#b91c1c"
    : verdictLabel === "PROCEED" ? "#15803d" : "#92400e";
  const verdictBg = verdictLabel === "DO NOT SEND" ? "#fef2f2"
    : verdictLabel === "PROCEED" ? "#f0fdf4" : "#fffbeb";
  const verdictPct = !display ? 0
    : verdictLabel === "DO NOT SEND" ? display.pDontSend
    : verdictLabel === "PROCEED" ? display.pProceed
    : display.pReview;

  // Risk factors summary
  const factors = [
    {
      label: "Citation accuracy",
      status: snapshot.sourcerStatus === "CITED" ? "ok" : snapshot.sourcerStatus === "INFERRED" ? "warn" : "bad",
      text: snapshot.sourcerStatus === "CITED" ? "Sources verified" : snapshot.sourcerStatus === "INFERRED" ? "Citations inferred" : "Sources not found",
    },
    {
      label: "Jurisdiction",
      status: snapshot.jurisdictionStatus === "APPLICABLE" ? "ok" : snapshot.jurisdictionStatus === "UNCLEAR" ? "warn" : "bad",
      text: snapshot.jurisdictionStatus === "APPLICABLE" ? "In scope"
        : snapshot.jurisdictionStatus === "UNCLEAR" ? "Scope unclear"
        : `Wrong jurisdiction (${snapshot.jurisdictionConfidence}% confidence)`,
    },
    {
      label: "Law currency",
      status: snapshot.historianStatus === "CURRENT" ? "ok" : snapshot.historianStatus === "UNKNOWN" ? "warn" : "bad",
      text: snapshot.historianStatus === "CURRENT" ? "Law is current" : snapshot.historianStatus === "UNKNOWN" ? "Currency unknown" : "Law has been amended",
    },
    {
      label: "Counter-arguments",
      status: snapshot.devilStrength === "low" ? "ok" : snapshot.devilStrength === "medium" ? "warn" : "bad",
      text: snapshot.devilStrength === "low" ? "Weak counter-case" : snapshot.devilStrength === "medium" ? "Moderate counter-case" : "Strong counter-case found",
    },
    {
      label: "Firm conflicts",
      status: snapshot.memoryStatus === "NO_CONFLICT" ? "ok" : "bad",
      text: snapshot.memoryStatus === "NO_CONFLICT" ? "No prior conflicts" : "Contradicts prior advice",
    },
  ];
  const STATUS_COLOR: Record<string, string> = { ok: "#15803d", warn: "#92400e", bad: "#b91c1c" };
  const STATUS_BG:    Record<string, string> = { ok: "#f0fdf4", warn: "#fffbeb", bad: "#fef2f2" };
  const STATUS_ICON:  Record<string, string> = { ok: "✓", warn: "⚠", bad: "✕" };

  return (
    <div className="h-full overflow-y-auto bg-white" style={{ padding: "28px 28px 48px" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-bold text-slate-900">Risk Simulation</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monte Carlo · N = {N_TOTAL.toLocaleString()} simulations ·{" "}
            {usingDemo
              ? <span className="italic">demo scenario</span>
              : <span>{claimResults.length} claims</span>}
          </p>
        </div>
        <button
          onClick={startSimulation}
          disabled={running}
          className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all"
        >
          {running ? `${Math.round(progress * 100)}%…` : "↺ Re-run"}
        </button>
      </div>

      {/* Progress bar */}
      {running && (
        <div className="mb-6">
          <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-100"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 text-right">
            {Math.min(scoresRef.current.length, N_TOTAL).toLocaleString()} / {N_TOTAL.toLocaleString()} iterations
          </p>
        </div>
      )}

      {/* ── Hero verdict ── */}
      {display && verdictLabel && (
        <div
          className="rounded-2xl border p-6 mb-6 text-center"
          style={{ backgroundColor: verdictBg, borderColor: verdictColor + "30" }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: verdictColor + "80" }}>
            Most likely outcome
          </p>
          <p className="text-3xl font-bold mb-1" style={{ color: verdictColor }}>
            {verdictLabel}
          </p>
          <p className="text-sm font-medium" style={{ color: verdictColor + "99" }}>
            {verdictPct.toFixed(1)}% of simulated audits
          </p>

          {/* Split bar */}
          <div className="flex h-2 rounded-full overflow-hidden mt-4 gap-px">
            <div
              className="transition-all duration-700 rounded-l-full"
              style={{ width: `${display.pDontSend}%`, backgroundColor: "#ef4444" }}
            />
            <div
              className="transition-all duration-700"
              style={{ width: `${display.pReview}%`, backgroundColor: "#f59e0b" }}
            />
            <div
              className="transition-all duration-700 rounded-r-full"
              style={{ width: `${display.pProceed}%`, backgroundColor: "#22c55e" }}
            />
          </div>
          <div className="flex justify-between text-[10px] mt-1.5" style={{ color: verdictColor + "70" }}>
            <span>Don&apos;t send {display.pDontSend.toFixed(0)}%</span>
            <span>Review {display.pReview.toFixed(0)}%</span>
            <span>Proceed {display.pProceed.toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* ── Stats row ── */}
      {display && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Expected score", value: display.mean.toFixed(1), sub: "/ 100" },
            { label: "Std deviation", value: "±" + display.stdDev.toFixed(1), sub: "pts" },
            { label: "Worst 5%", value: display.p5.toFixed(0), sub: "P5" },
            { label: "Best 5%", value: display.p95.toFixed(0), sub: "P95" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-[10px] text-slate-400 mb-1">{s.label}</p>
              <p className="text-xl font-bold text-slate-900 leading-none">
                {s.value}
                <span className="text-xs font-normal text-slate-400 ml-0.5">{s.sub}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Histogram ── */}
      {display && (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 mb-6">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-4">Score distribution</p>
          <div className="flex items-end gap-0.5 h-24">
            {display.histogram.map((count, i) => {
              const score = i * 5;
              const pct   = count / maxBucket;
              const color = score < 40 ? "#fca5a5" : score < 70 ? "#fcd34d" : "#86efac";
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm transition-all duration-200"
                  style={{
                    height: `${Math.round(pct * 100)}%`,
                    backgroundColor: color,
                    minHeight: count > 0 ? 2 : 0,
                  }}
                  title={`${score}–${score + 4}: ${((count / display.n) * 100).toFixed(1)}%`}
                />
              );
            })}
          </div>
          <div className="flex mt-2 h-1 rounded-full overflow-hidden gap-px">
            <div className="rounded-l-full" style={{ width: "40%", backgroundColor: "#fca5a5" }} />
            <div style={{ width: "30%", backgroundColor: "#fcd34d" }} />
            <div className="rounded-r-full" style={{ width: "30%", backgroundColor: "#86efac" }} />
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 mt-1 px-0.5">
            <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
          </div>
        </div>
      )}

      {/* ── Risk factors ── */}
      <div className="space-y-2 mb-6">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Risk factors driving simulation
        </p>
        {factors.map((f) => (
          <div
            key={f.label}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
            style={{ borderColor: STATUS_COLOR[f.status] + "30", backgroundColor: STATUS_BG[f.status] }}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{ backgroundColor: STATUS_COLOR[f.status] + "20", color: STATUS_COLOR[f.status] }}
            >
              {STATUS_ICON[f.status]}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{f.label}</p>
              <p className="text-xs text-slate-700 truncate">{f.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── AI refinement ── */}
      {!running && result && result.mean < 70 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-amber-800">Source Refinement</p>
              <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                Score below threshold — Claude can identify weak citations and suggest stronger sources.
              </p>
            </div>
            {!advice && (
              <button
                onClick={getAdvice}
                disabled={adviceLoading || usingDemo}
                className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                style={{ backgroundColor: "#92400e", color: "#fff" }}
              >
                {adviceLoading ? "Analysing…" : "Get Suggestions"}
              </button>
            )}
          </div>

          {usingDemo && (
            <p className="text-[10px] text-amber-600 italic">Run a real audit to get AI refinement suggestions.</p>
          )}

          {advice && (
            <div className="space-y-4">
              <p className="text-xs text-amber-900 leading-relaxed">{advice.summary}</p>
              {advice.flagged_areas.map((area, i) => (
                <div key={i} className="bg-white rounded-xl border border-amber-100 p-4 space-y-2">
                  <blockquote className="text-[10px] text-slate-400 italic border-l-2 border-amber-200 pl-2 line-clamp-2">
                    &ldquo;{area.claim_snippet}&rdquo;
                  </blockquote>
                  <p className="text-xs font-semibold text-red-600">⚠ {area.issue}</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{area.suggestion}</p>
                  {area.recommended_sources.length > 0 && (
                    <ul className="space-y-1">
                      {area.recommended_sources.map((src, j) => (
                        <li key={j} className="text-[10px] text-slate-500 flex items-start gap-1.5">
                          <span className="text-amber-500 shrink-0 mt-0.5">→</span>
                          {src}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {advice.overall_recommendation && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-widest mb-1">Recommendation</p>
                  <p className="text-xs text-amber-900 leading-relaxed">{advice.overall_recommendation}</p>
                </div>
              )}
              <button
                onClick={() => setAdvice(null)}
                className="text-[10px] text-amber-600 hover:text-amber-800 uppercase tracking-widest"
              >
                ✕ Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty loading state */}
      {!display && !running && (
        <div className="h-40 flex flex-col items-center justify-center text-center text-slate-300 space-y-3">
          <div className="text-4xl">◎</div>
          <p className="text-xs">Loading simulation…</p>
        </div>
      )}
    </div>
  );
}
