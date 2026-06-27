"use client";

import { useMemo } from "react";

// ── Agent definitions ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GetResult = (out: any) => { verdict: string; color: string; detail?: string };

const AGENT_DEFS: Array<{
  key: string; name: string; icon: string; color: string;
  tagline: string; quote: string; getResult: GetResult;
}> = [
  {
    key: "runSourcer",
    name: "Citation Sourcer",
    icon: "⊕",
    color: "#00d98b",
    tagline: "Verifies every source verbatim",
    quote: "I don't trust what I can't verify word for word. Give me the primary source or I'll find it myself.",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getResult: (out: any) => ({
      verdict: out.status === "CITED" ? "Citation verified"
        : out.status === "INFERRED" ? "Citation unclear"
        : "Citation not found",
      color: out.status === "CITED" ? "#00d98b" : out.status === "INFERRED" ? "#f5a623" : "#ff3b5c",
      detail: (out.discrepancy || out.verbatim_quote)?.slice(0, 90),
    }),
  },
  {
    key: "runJurisdictionist",
    name: "Jurisdictionist",
    icon: "◉",
    color: "#9f7aea",
    tagline: "Maps scope & regulatory reach",
    quote: "Article 2 is not a formality. It defines who legally exists inside a regulation. Brexit changed everything.",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getResult: (out: any) => ({
      verdict: out.status === "APPLICABLE" ? "In scope"
        : out.status === "WRONG_JURISDICTION" ? "Outside jurisdiction"
        : "Scope unclear",
      color: out.status === "APPLICABLE" ? "#00d98b" : out.status === "WRONG_JURISDICTION" ? "#ff3b5c" : "#f5a623",
      detail: out.confidence ? `${out.confidence}% confidence · ${out.reason?.slice(0, 70)}` : undefined,
    }),
  },
  {
    key: "runHistorian",
    name: "Legal Historian",
    icon: "⊗",
    color: "#f5a623",
    tagline: "Traces amendment history",
    quote: "History doesn't lie. That provision was repealed in December. The AI learned from the draft.",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getResult: (out: any) => ({
      verdict: out.status === "CURRENT" ? "Law is current"
        : out.status === "AMENDED" ? "Law was amended"
        : "Status unknown",
      color: out.status === "CURRENT" ? "#00d98b" : out.status === "AMENDED" ? "#f5a623" : "#6e6e8a",
      detail: out.note?.slice(0, 90),
    }),
  },
  {
    key: "runDevilsAdvocate",
    name: "Devil's Advocate",
    icon: "⊘",
    color: "#ff6b6b",
    tagline: "Hunts counter-authority",
    quote: "Let me find four reasons this is wrong. Actually — I found six. You're welcome.",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getResult: (out: any) => ({
      verdict: (out.strength ?? "low") === "high" ? "Strong counter-case"
        : (out.strength ?? "low") === "medium" ? "Some counter-evidence"
        : "Weak counter-case",
      color: (out.strength ?? "low") === "high" ? "#ff3b5c" : (out.strength ?? "low") === "medium" ? "#f5a623" : "#00d98b",
      detail: out.counter_authority?.slice(0, 90),
    }),
  },
  {
    key: "runFirmMemory",
    name: "Firm Memory",
    icon: "⊙",
    color: "#00d9d9",
    tagline: "Guards against prior conflicts",
    quote: "We told Barclays exactly the opposite in Q3. This memo would contradict our own prior advisory.",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getResult: (out: any) => ({
      verdict: out.status === "NO_CONFLICT" ? "No prior conflicts"
        : "Contradicts prior work",
      color: out.status === "NO_CONFLICT" ? "#00d98b" : "#ff3b5c",
      detail: out.reference ? `${out.reference.matter} · ${out.reference.date}` : undefined,
    }),
  },
];

// ── Verdict dot ───────────────────────────────────────────────────────────────

function VerdictDot({ color }: { color: string }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: color }} />
      <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: color }} />
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AgentRoster({
  toolParts,
  isRunning,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolParts: any[];
  isRunning: boolean;
}) {
  const agentState = useMemo(() => {
    const state: Record<string, { active: boolean; done: boolean; part: unknown }> = {};
    for (const def of AGENT_DEFS) state[def.key] = { active: false, done: false, part: null };

    for (const p of toolParts) {
      const name = (p.type as string).replace(/^tool-/, "");
      if (!state[name]) continue;
      if (p.state === "output-available" || p.state === "output-error") {
        state[name] = { active: false, done: true, part: p };
      } else if (!state[name].done) {
        state[name] = { active: true, done: false, part: p };
      }
    }
    return state;
  }, [toolParts]);

  const doneCount = Object.values(agentState).filter((s) => s.done).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 space-y-6">

        {/* ── Orchestrator hero ────────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-2xl border transition-all duration-700"
          style={{
            borderColor: isRunning ? "#4a9eff44" : "#1a1a2e",
            background: isRunning
              ? "linear-gradient(160deg, #4a9eff10 0%, #060612 55%)"
              : "#060612",
            boxShadow: isRunning ? "0 0 60px #4a9eff12, 0 0 120px #4a9eff06" : "none",
          }}
        >
          {/* Top colour bleed */}
          {isRunning && (
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, #4a9eff88, transparent)" }}
            />
          )}

          <div className="flex flex-col items-center text-center px-8 py-8">
            {/* Icon with animated rings */}
            <div className="relative mb-5">
              {isRunning && (
                <>
                  <div
                    className="absolute rounded-full animate-pulse"
                    style={{
                      inset: -16,
                      border: "1px solid #4a9eff30",
                    }}
                  />
                  <div
                    className="absolute rounded-full"
                    style={{
                      inset: -28,
                      border: "1px solid #4a9eff14",
                    }}
                  />
                </>
              )}
              <div
                className="relative w-16 h-16 rounded-2xl flex items-center justify-center text-4xl transition-all duration-700"
                style={{
                  backgroundColor: "#4a9eff12",
                  border: `1px solid ${isRunning ? "#4a9eff50" : "#4a9eff20"}`,
                  boxShadow: isRunning ? "0 0 32px #4a9eff40, 0 0 64px #4a9eff1a" : "0 0 10px #4a9eff10",
                  color: isRunning ? "#4a9eff" : "#4a9effaa",
                  filter: isRunning ? "drop-shadow(0 0 10px #4a9eff)" : "none",
                }}
              >
                ⚖
              </div>
            </div>

            <p className="text-[9px] text-blue-400/60 uppercase tracking-[0.2em] mb-1">Opus Orchestrator</p>
            <h2 className="text-xl font-semibold text-white mb-1 tracking-tight">claude-opus-4-8</h2>
            <p className="text-xs text-zinc-500 mb-4">Extended Thinking · Adversarial Reasoning</p>

            <p className="text-sm italic text-zinc-400 max-w-md leading-relaxed mb-6">
              &ldquo;Five agents. Five perspectives. One verdict. I don&rsquo;t deliver confidence — I manufacture doubt.&rdquo;
            </p>

            {/* Status */}
            {isRunning ? (
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-blue-950/40 border border-blue-900/50">
                <VerdictDot color="#4a9eff" />
                <span className="text-xs text-blue-300 font-medium">Orchestrating investigation</span>
              </div>
            ) : doneCount > 0 ? (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="text-emerald-400">✓</span>
                <span>{doneCount} agent{doneCount !== 1 ? "s" : ""} completed</span>
              </div>
            ) : (
              <p className="text-xs text-zinc-700">Waiting for a document to investigate</p>
            )}
          </div>

          {/* Bottom separator */}
          <div className="h-px mx-8 bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

          {/* Capabilities row */}
          <div className="flex items-center justify-center gap-6 px-8 py-3">
            {["Claim extraction", "5-agent dispatch", "Adversarial synthesis", "Verdict scoring"].map((cap) => (
              <span key={cap} className="text-[9px] text-zinc-600 uppercase tracking-wider">{cap}</span>
            ))}
          </div>
        </div>

        {/* ── Section label ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-zinc-800/60" />
          <p className="text-[9px] text-zinc-600 uppercase tracking-[0.2em]">Specialist Agents</p>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-zinc-800/60" />
        </div>

        {/* ── Agent cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {AGENT_DEFS.map((def) => {
            const s = agentState[def.key];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = s.done && (s.part as any)?.output ? def.getResult((s.part as any).output) : null;

            return (
              <div
                key={def.key}
                className="relative overflow-hidden rounded-2xl border flex flex-col transition-all duration-500"
                style={{
                  borderColor: s.active ? `${def.color}55` : s.done ? `${def.color}22` : "#13131f",
                  background: s.active
                    ? `linear-gradient(175deg, ${def.color}12 0%, #060612 45%)`
                    : s.done
                      ? `linear-gradient(175deg, ${def.color}07 0%, #060612 40%)`
                      : "#060612",
                  boxShadow: s.active
                    ? `0 0 40px ${def.color}18, 0 0 80px ${def.color}08`
                    : "none",
                }}
              >
                {/* Top glow line */}
                {s.active && (
                  <div
                    className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(90deg, transparent, ${def.color}99, transparent)` }}
                  />
                )}

                <div className="flex flex-col items-center text-center p-5 flex-1">
                  {/* Icon orb */}
                  <div className="relative mb-4 mt-2">
                    {s.active && (
                      <div
                        className="absolute rounded-2xl animate-pulse"
                        style={{ inset: -8, backgroundColor: `${def.color}10`, border: `1px solid ${def.color}30` }}
                      />
                    )}
                    <div
                      className="relative w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500"
                      style={{
                        backgroundColor: `${def.color}12`,
                        border: `1px solid ${def.color}${s.active ? "55" : s.done ? "30" : "18"}`,
                        color: s.active ? def.color : s.done ? def.color + "cc" : def.color + "44",
                        boxShadow: s.active
                          ? `0 0 24px ${def.color}40, 0 0 48px ${def.color}15`
                          : s.done
                            ? `0 0 12px ${def.color}18`
                            : "none",
                        filter: s.active ? `drop-shadow(0 0 6px ${def.color}cc)` : "none",
                      }}
                    >
                      {def.icon}
                    </div>
                  </div>

                  {/* Name */}
                  <h3
                    className="text-sm font-semibold mb-0.5 tracking-tight transition-colors duration-300"
                    style={{ color: s.active || s.done ? "#f0f0fa" : "#6b7280" }}
                  >
                    {def.name}
                  </h3>

                  {/* Tagline */}
                  <p
                    className="text-[9px] uppercase tracking-widest mb-4 transition-colors duration-300"
                    style={{ color: s.active || s.done ? def.color + "aa" : "#374151" }}
                  >
                    {def.tagline}
                  </p>

                  {/* Quote — hero content */}
                  <p
                    className="text-[11px] italic leading-relaxed flex-1 transition-colors duration-300"
                    style={{ color: s.active ? "rgba(255,255,255,0.65)" : s.done ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.18)" }}
                  >
                    &ldquo;{def.quote}&rdquo;
                  </p>
                </div>

                {/* Status bar */}
                <div
                  className="px-5 py-3 transition-all duration-300"
                  style={{ borderTop: `1px solid ${s.active || s.done ? def.color + "20" : "#13131f"}` }}
                >
                  {s.active ? (
                    <div className="flex items-center gap-2">
                      <VerdictDot color={def.color} />
                      <span className="text-[10px] font-medium" style={{ color: def.color }}>
                        Investigating
                      </span>
                    </div>
                  ) : result ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: result.color }} />
                        <span className="text-[10px] font-medium" style={{ color: result.color }}>
                          {result.verdict}
                        </span>
                      </div>
                      {result.detail && (
                        <p className="text-[9px] text-zinc-600 leading-relaxed line-clamp-2 pl-3.5">
                          {result.detail}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                      <span className="text-[10px] text-zinc-700">Standing by</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
