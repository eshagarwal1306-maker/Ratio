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
  histogram: number[]; // 20 buckets, each spans 5 pts
  mean: number;
  stdDev: number;
  p5: number;
  p95: number;
  pDontSend: number;
  pReview: number;
  pProceed: number;
  n: number;
}

// ── Jack & Jill demo defaults ─────────────────────────────────────────────────

const DEMO_SNAPSHOT: AgentSnapshot = {
  sourcerStatus: "INFERRED",
  jurisdictionStatus: "WRONG_JURISDICTION",
  jurisdictionConfidence: 97,
  historianStatus: "AMENDED",
  devilStrength: "high",
  memoryStatus: "CONTRADICTION_FOUND",
};

// ── Monte Carlo core ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function snapshotFromResults(results: any[]): AgentSnapshot | null {
  if (!results.length) return null;
  const r = results[0];
  return {
    sourcerStatus: r.sourcer?.status ?? "NOT_FOUND",
    jurisdictionStatus: r.jurisdictionist?.status ?? "UNCLEAR",
    jurisdictionConfidence: r.jurisdictionist?.confidence ?? 50,
    historianStatus: r.historian?.status ?? "UNKNOWN",
    devilStrength: r.devils_advocate?.strength ?? "high",
    memoryStatus: r.firm_memory?.status ?? "NO_CONFLICT",
  };
}

function runIteration(snap: AgentSnapshot): number {
  let deduction = 0;

  // Citation sourcer (w=20)
  const pSourcer = snap.sourcerStatus === "NOT_FOUND" ? 0.95
    : snap.sourcerStatus === "INFERRED" ? 0.65 : 0.05;
  if (Math.random() < pSourcer) deduction += 20;

  // Jurisdictionist (w=25)
  const pJurisd = snap.jurisdictionStatus === "WRONG_JURISDICTION"
    ? snap.jurisdictionConfidence / 100
    : snap.jurisdictionStatus === "UNCLEAR" ? 0.45 : 0.05;
  if (Math.random() < pJurisd) deduction += 25;

  // Historian (w=15)
  const pHist = snap.historianStatus === "AMENDED" ? 0.78
    : snap.historianStatus === "UNKNOWN" ? 0.38 : 0.05;
  if (Math.random() < pHist) deduction += 15;

  // Devil's Advocate (w=20)
  const pDevil = snap.devilStrength === "high" ? 0.85
    : snap.devilStrength === "medium" ? 0.55 : 0.18;
  if (Math.random() < pDevil) deduction += 20;

  // Firm Memory (w=20)
  const pMemory = snap.memoryStatus === "CONTRADICTION_FOUND" ? 0.90 : 0.05;
  if (Math.random() < pMemory) deduction += 20;

  // Regulatory interpretation noise — triangular distribution ±12 pts
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
    if (s < 40) dontSend++;
    else if (s < 70) review++;
    else proceed++;
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
const BATCH  = 80;

// ── Component ─────────────────────────────────────────────────────────────────

export function MonteCarloPanel({
  claimResults,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  claimResults: any[];
}) {
  const [running, setRunning]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult]     = useState<SimResult | null>(null);
  const [liveResult, setLive]   = useState<SimResult | null>(null);
  const rafRef   = useRef<number>(0);
  const scoresRef = useRef<number[]>([]);

  const snapshot  = snapshotFromResults(claimResults) ?? DEMO_SNAPSHOT;
  const usingDemo = claimResults.length === 0;

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); }, []);

  function startSimulation() {
    cancelAnimationFrame(rafRef.current);
    scoresRef.current = [];
    setRunning(true);
    setProgress(0);
    setResult(null);
    setLive(null);

    function runBatch() {
      for (let i = 0; i < BATCH; i++) scoresRef.current.push(runIteration(snapshot));
      const done = scoresRef.current.length;
      setProgress(done / N_TOTAL);
      if (done % (BATCH * 4) === 0) setLive(computeStats(scoresRef.current));

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

  const display = liveResult ?? result;
  const maxBucket = display ? Math.max(...display.histogram, 1) : 1;

  // Agent input pills
  const agentInputs = [
    {
      label: "Sourcer",
      value: snapshot.sourcerStatus,
      p: snapshot.sourcerStatus === "NOT_FOUND" ? 95 : snapshot.sourcerStatus === "INFERRED" ? 65 : 5,
      color: "#00d98b", weight: 20,
    },
    {
      label: "Jurisdiction",
      value: snapshot.jurisdictionStatus.replace(/_/g, " "),
      p: snapshot.jurisdictionStatus === "WRONG_JURISDICTION"
        ? snapshot.jurisdictionConfidence
        : snapshot.jurisdictionStatus === "UNCLEAR" ? 45 : 5,
      color: "#9f7aea", weight: 25,
    },
    {
      label: "Historian",
      value: snapshot.historianStatus,
      p: snapshot.historianStatus === "AMENDED" ? 78 : snapshot.historianStatus === "UNKNOWN" ? 38 : 5,
      color: "#f5a623", weight: 15,
    },
    {
      label: "Devil's Adv.",
      value: snapshot.devilStrength.toUpperCase(),
      p: snapshot.devilStrength === "high" ? 85 : snapshot.devilStrength === "medium" ? 55 : 18,
      color: "#ff6b6b", weight: 20,
    },
    {
      label: "Firm Memory",
      value: snapshot.memoryStatus.replace(/_/g, " "),
      p: snapshot.memoryStatus === "CONTRADICTION_FOUND" ? 90 : 5,
      color: "#00d9d9", weight: 20,
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">Monte Carlo Risk Simulation</p>
          <h2 className="text-sm font-bold text-zinc-200">Score Distribution Analysis</h2>
          {usingDemo && (
            <p className="text-[10px] text-zinc-600 mt-1 italic">
              Using Jack &amp; Jill demo scenario — run an audit to simulate real findings
            </p>
          )}
        </div>
        <button
          onClick={startSimulation}
          disabled={running}
          className={`shrink-0 px-4 py-2 rounded-xl text-[11px] font-bold tracking-widest uppercase transition-all ${
            running
              ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              : result
                ? "bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
                : "bg-blue-600 text-white hover:bg-blue-500"
          }`}
        >
          {running ? `${Math.round(progress * 100)}%…` : result ? "↺ Re-run" : "▶ Run  N=2,000"}
        </button>
      </div>

      {/* Agent inputs → probability */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-4">
        <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-3">
          Agent findings → error probability inputs
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {agentInputs.map((ag) => (
            <div key={ag.label} className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[8px] text-zinc-500 uppercase tracking-widest">{ag.label}</span>
                <span className="text-[7px] text-zinc-700">w={ag.weight}%</span>
              </div>
              <p className="text-[9px] font-bold leading-tight" style={{ color: ag.color }}>
                {ag.value}
              </p>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${ag.p}%`, backgroundColor: ag.color + "80" }}
                  />
                </div>
                <span className="text-[8px] text-zinc-600 tabular-nums w-6 text-right">{ag.p}%</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[8px] text-zinc-700 mt-2">
          Each iteration samples Bernoulli(p) per agent + triangular noise ±12 pts. Weights sum to 100.
        </p>
      </div>

      {/* Progress bar */}
      {running && (
        <div className="space-y-1">
          <div className="flex justify-between text-[9px] text-zinc-600">
            <span className="animate-pulse">Simulating…</span>
            <span className="tabular-nums">
              {Math.min(scoresRef.current.length, N_TOTAL).toLocaleString()} / {N_TOTAL.toLocaleString()}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-100"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Histogram */}
      {display && (
        <>
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] text-zinc-600 uppercase tracking-widest">
                Score Distribution
              </p>
              <span className="text-[9px] text-zinc-700 tabular-nums">
                N = {display.n.toLocaleString()}
              </span>
            </div>

            {/* Bars */}
            <div className="flex items-end gap-px h-28">
              {display.histogram.map((count, i) => {
                const score = i * 5;
                const pct = count / maxBucket;
                const barColor = score < 40 ? "#ff3b5c" : score < 70 ? "#f5a623" : "#00d98b";
                const pctOfTotal = ((count / display.n) * 100).toFixed(1);
                return (
                  <div key={i} className="relative flex-1 group flex flex-col justify-end h-full">
                    <div
                      className="w-full rounded-t-sm transition-all duration-200"
                      style={{
                        height: `${Math.round(pct * 100)}%`,
                        backgroundColor: barColor + "88",
                        minHeight: count > 0 ? 2 : 0,
                      }}
                    />
                    {/* hover tooltip */}
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
                      <div className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[8px] text-zinc-300 whitespace-nowrap">
                        {score}–{score + 4}: {pctOfTotal}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-axis */}
            <div className="flex justify-between text-[8px] text-zinc-700 mt-1.5 px-0.5">
              {["0", "25", "50", "75", "100"].map((l) => <span key={l}>{l}</span>)}
            </div>

            {/* Zone underline */}
            <div className="flex mt-1 h-1 rounded-full overflow-hidden gap-px">
              <div className="w-[40%] bg-rose-900/50" />
              <div className="w-[30%] bg-amber-900/50" />
              <div className="w-[30%] bg-emerald-900/50" />
            </div>
          </div>

          {/* Outcome probabilities */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "DO NOT SEND", p: display.pDontSend, color: "#ff3b5c", sub: "score < 40" },
              { label: "REVIEW",      p: display.pReview,   color: "#f5a623", sub: "40 – 70" },
              { label: "PROCEED",     p: display.pProceed,  color: "#00d98b", sub: "score ≥ 70" },
            ].map((o) => (
              <div
                key={o.label}
                className="rounded-xl border p-4 text-center space-y-0.5 transition-all"
                style={{ borderColor: o.color + "35", backgroundColor: o.color + "08" }}
              >
                <p
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: o.color }}
                >
                  {o.p.toFixed(1)}<span className="text-sm font-normal">%</span>
                </p>
                <p className="text-[9px] uppercase tracking-widest text-zinc-500">{o.label}</p>
                <p className="text-[8px] text-zinc-700">{o.sub}</p>
              </div>
            ))}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "E[score]",  value: display.mean.toFixed(1),   color: "#c8c8d8", sub: "expected" },
              { label: "σ",         value: display.stdDev.toFixed(1), color: "#818cf8", sub: "std deviation" },
              { label: "P5",        value: display.p5.toFixed(0),     color: "#ff6b6b", sub: "worst 5%" },
              { label: "P95",       value: display.p95.toFixed(0),    color: "#4ade80", sub: "best 5%" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-center">
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-0.5">{s.label}</p>
                <p className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[8px] text-zinc-700 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Interpretation */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-4 text-[11px] text-zinc-500 leading-relaxed space-y-2">
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Interpretation</p>
            <p>
              Across {display.n.toLocaleString()} simulated audits sampling from each agent&apos;s
              confidence distribution, the expected GAVEL score is{" "}
              <span className="text-zinc-300 font-bold">{display.mean.toFixed(1)}/100</span>{" "}
              (σ&nbsp;=&nbsp;{display.stdDev.toFixed(1)}). There is a{" "}
              <span style={{ color: "#ff3b5c" }} className="font-bold">
                {display.pDontSend.toFixed(1)}%
              </span>{" "}
              probability of a <em>DO NOT SEND</em> verdict under realistic interpretive variance.
            </p>
            <p>
              Even the best-case scenario (P95&nbsp;=&nbsp;{display.p95.toFixed(0)}) suggests{" "}
              {display.p95 < 40
                ? "the memo does not reach review threshold in any plausible scenario."
                : display.p95 < 70
                  ? "the memo enters review territory but does not clear for sending."
                  : "a marginal pass — requiring careful partner-level review."}
            </p>
            {!running && (
              <p className="text-[9px] text-zinc-700 pt-1 border-t border-zinc-800">
                Model: 5 Bernoulli trials weighted {agentInputs.map((a) => a.weight).join("/")}, noise ~ Triangular(−12, 0, +12)
              </p>
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!display && !running && (
        <div className="h-48 flex flex-col items-center justify-center text-center opacity-25 space-y-3">
          <div className="text-4xl text-blue-400">◎</div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
            Click Run to simulate 2,000 audit outcomes
          </p>
          <p className="text-[9px] text-zinc-700">
            {usingDemo ? "Using Jack & Jill demo data" : `${claimResults.length} real claim results loaded`}
          </p>
        </div>
      )}
    </div>
  );
}
