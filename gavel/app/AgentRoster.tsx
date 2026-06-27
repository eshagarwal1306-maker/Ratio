"use client";

import { useMemo } from "react";

// ── Shared sub-components ──────────────────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
  CITED: "bg-emerald-950 text-emerald-300 border-emerald-800",
  APPLICABLE: "bg-emerald-950 text-emerald-300 border-emerald-800",
  CURRENT: "bg-emerald-950 text-emerald-300 border-emerald-800",
  NO_CONFLICT: "bg-emerald-950 text-emerald-300 border-emerald-800",
  low: "bg-emerald-950 text-emerald-300 border-emerald-800",
  LOW: "bg-emerald-950 text-emerald-300 border-emerald-800",
  INFERRED: "bg-amber-950 text-amber-300 border-amber-800",
  UNCLEAR: "bg-amber-950 text-amber-300 border-amber-800",
  AMENDED: "bg-amber-950 text-amber-300 border-amber-800",
  medium: "bg-amber-950 text-amber-300 border-amber-800",
  MEDIUM: "bg-amber-950 text-amber-300 border-amber-800",
  NOT_FOUND: "bg-rose-950 text-rose-300 border-rose-800",
  WRONG_JURISDICTION: "bg-rose-950 text-rose-300 border-rose-800",
  CONTRADICTION_FOUND: "bg-rose-950 text-rose-300 border-rose-800",
  high: "bg-rose-950 text-rose-300 border-rose-800",
  HIGH: "bg-rose-950 text-rose-300 border-rose-800",
  UNKNOWN: "bg-zinc-900 text-zinc-400 border-zinc-700",
};

function Badge({ label }: { label: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold tracking-widest font-mono ${BADGE_COLORS[label] ?? "bg-zinc-900 text-zinc-400 border-zinc-700"}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function Pulse({ color }: { color: string }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }} />
      <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: color }} />
    </span>
  );
}

// ── Agent definitions ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GetResult = (out: any) => { badge: string; detail?: string };

const AGENT_DEFS: Array<{
  key: string; name: string; icon: string; color: string;
  model: string; tagline: string; description: string;
  tools: string[]; getResult: GetResult;
}> = [
  {
    key: "runSourcer",
    name: "Citation Sourcer",
    icon: "⊕",
    color: "#00d98b",
    model: "Sonnet 4.6",
    tagline: "EUR-Lex article verification",
    description: "Fetches verbatim text from EUR-Lex and compares it against the AI claim. Detects hallucinated citations and misquoted provisions.",
    tools: ["fetchCellarArticle"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getResult: (out: any) => ({
      badge: out.status,
      detail: (out.discrepancy || out.verbatim_quote)?.slice(0, 100),
    }),
  },
  {
    key: "runJurisdictionist",
    name: "Jurisdictionist",
    icon: "◉",
    color: "#9f7aea",
    model: "Sonnet 4.6",
    tagline: "EU scope & jurisdiction analysis",
    description: "Checks Article 2 scope provisions. Catches post-Brexit errors — UK-only firms are frequently outside EU regulatory scope.",
    tools: ["fetchCellarArticle"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getResult: (out: any) => ({
      badge: out.status,
      detail: `${out.confidence}% · ${out.reason?.slice(0, 90)}`,
    }),
  },
  {
    key: "runHistorian",
    name: "Legal Historian",
    icon: "⊗",
    color: "#f5a623",
    model: "Sonnet 4.6",
    tagline: "Amendment & currency checks",
    description: "Queries EU Cellar SPARQL for in-force status and amendments. Detects AI models citing outdated draft article numbers.",
    tools: ["checkAmendments", "sparqlQuery"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getResult: (out: any) => ({
      badge: out.status,
      detail: out.note?.slice(0, 100),
    }),
  },
  {
    key: "runDevilsAdvocate",
    name: "Devil's Advocate",
    icon: "⊘",
    color: "#ff6b6b",
    model: "Sonnet 4.6",
    tagline: "Counter-authority research",
    description: "Searches for real cases, EBA/FCA guidance, and academic commentary that undermine or qualify the cited provision.",
    tools: ["webSearch", "sparqlQuery"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getResult: (out: any) => ({
      badge: (out.strength ?? "low").toUpperCase(),
      detail: out.counter_authority,
    }),
  },
  {
    key: "runFirmMemory",
    name: "Firm Memory",
    icon: "⊙",
    color: "#00d9d9",
    model: "In-house",
    tagline: "Prior position conflict detection",
    description: "Scans the firm's past client advisories and matter records for positions that contradict the current claim.",
    tools: ["corpus search"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getResult: (out: any) => ({
      badge: out.status,
      detail: out.reference ? `${out.reference.matter} (${out.reference.date})` : undefined,
    }),
  },
];

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

  const completedCalls = toolParts.filter((p) => p.state === "output-available").length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">

        {/* Orchestrator banner */}
        <div
          className="rounded-xl border p-4 transition-all duration-500"
          style={{
            borderColor: isRunning ? "#4a9eff55" : "#27272a",
            backgroundColor: isRunning ? "#4a9eff08" : "#0d0d1f",
          }}
        >
          <div className="flex items-start gap-4">
            <div className="relative shrink-0 mt-0.5">
              <span className="text-2xl" style={{ color: isRunning ? "#4a9eff" : "#374151" }}>⚖</span>
              {isRunning && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-400">
                  <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-75" />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-sm font-bold text-zinc-100 tracking-wide">Orchestrator</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded border border-blue-800/60 text-blue-400 font-mono">
                  claude-opus-4-8
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded border border-purple-800/50 text-purple-400 font-mono">
                  Extended Thinking
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Adversarial multi-agent coordinator. Dispatches 5 specialist agents per claim, synthesises findings
                under adversarial framing, and produces a GAVEL verdict with full reasoning trace.
              </p>
            </div>
            <div className="shrink-0 text-right">
              {isRunning ? (
                <div className="flex items-center gap-1.5">
                  <Pulse color="#4a9eff" />
                  <span className="text-[10px] text-blue-400 font-mono tracking-widest">ACTIVE</span>
                </div>
              ) : completedCalls > 0 ? (
                <span className="text-[10px] text-zinc-500 font-mono">{completedCalls} calls done</span>
              ) : (
                <span className="text-[10px] text-zinc-700 font-mono tracking-widest">IDLE</span>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-800/60" />
          <span className="text-[9px] text-zinc-600 uppercase tracking-widest">Specialist Agents</span>
          <div className="flex-1 h-px bg-zinc-800/60" />
        </div>

        {/* 5 agent cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {AGENT_DEFS.map((def) => {
            const s = agentState[def.key];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = s.done && (s.part as any)?.output ? def.getResult((s.part as any).output) : null;

            return (
              <div
                key={def.key}
                className="rounded-xl border p-4 transition-all duration-300 flex flex-col"
                style={{
                  borderColor: s.active ? def.color + "66" : s.done ? def.color + "28" : "#27272a",
                  backgroundColor: s.active ? def.color + "06" : s.done ? def.color + "04" : "#0d0d1f",
                  boxShadow: s.active ? `0 0 20px ${def.color}15` : "none",
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="relative">
                    <span
                      className="text-3xl font-bold leading-none transition-all duration-300"
                      style={{ color: s.active || s.done ? def.color : "#374151" }}
                    >
                      {def.icon}
                    </span>
                    {s.active && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                        style={{ backgroundColor: def.color }}
                      >
                        <span
                          className="absolute inset-0 rounded-full animate-ping opacity-75"
                          style={{ backgroundColor: def.color }}
                        />
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-600 font-mono">
                    {def.model}
                  </span>
                </div>

                {/* Name + tagline */}
                <div className="mb-2">
                  <h3 className="text-xs font-bold text-zinc-200 tracking-wide">{def.name}</h3>
                  <p className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: def.color + "99" }}>
                    {def.tagline}
                  </p>
                </div>

                {/* Description */}
                <p className="text-[10px] text-zinc-600 leading-relaxed mb-3 flex-1">{def.description}</p>

                {/* Tool badges */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {def.tools.map((t) => (
                    <span key={t} className="text-[8px] px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-700 font-mono">
                      {t}
                    </span>
                  ))}
                </div>

                {/* Status */}
                <div
                  className="pt-2.5 mt-auto"
                  style={{ borderTop: `1px solid ${s.active || s.done ? def.color + "22" : "#27272a"}` }}
                >
                  {s.active ? (
                    <div className="flex items-center gap-2">
                      <Pulse color={def.color} />
                      <span className="text-[10px] font-bold tracking-widest" style={{ color: def.color }}>
                        RUNNING
                      </span>
                    </div>
                  ) : s.done && result ? (
                    <div className="space-y-1.5">
                      <Badge label={result.badge} />
                      {result.detail && (
                        <p className="text-[10px] text-zinc-500 leading-relaxed line-clamp-2">{result.detail}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-700 tracking-widest">IDLE</span>
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
