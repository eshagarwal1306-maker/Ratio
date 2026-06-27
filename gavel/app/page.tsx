"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Neo4jGraph } from "./Neo4jGraph";
import { AgentRoster } from "./AgentRoster";
import { SourcesPanel, type IndexedDoc } from "./SourcesPanel";

// ─── Demo content ─────────────────────────────────────────────────────────────

const DEMO_MEMO = `MEMO: Re DORA Compliance — TechFinance Ltd

Under DORA Article 30(3), your Master Services Agreement is non-compliant because it lacks ICT sub-outsourcing oversight provisions. UK financial firms must comply with DORA by January 2025 or face penalties up to 2% of global annual turnover under Article 50.

We recommend an immediate review of all third-party ICT contracts to ensure compliance with the sub-outsourcing oversight requirements.`;

const DEMO_ENTITY = "UK-based fintech firm with no EU establishment or EU-regulated subsidiary";

// ─── Pricing (MTok rates, June 2026) ─────────────────────────────────────────
// Opus 4.8: $15 in / $75 out  |  Sonnet 4.6: $3 in / $15 out
const PRICING = {
  "claude-opus-4-8":    { in: 15,  out: 75  },
  "claude-sonnet-4-6":  { in: 3,   out: 15  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClaimResult {
  claim: { text: string; regulation: string; article: string; jurisdiction: string };
  sourcer: { status: "CITED" | "INFERRED" | "NOT_FOUND"; discrepancy?: string; verbatim_quote?: string; match?: boolean };
  jurisdictionist: { status: "APPLICABLE" | "WRONG_JURISDICTION" | "UNCLEAR"; confidence: number; reason: string };
  historian: { status: "CURRENT" | "AMENDED" | "UNKNOWN"; note: string };
  devils_advocate: { counter_authority: string; why_it_undermines: string; strength: "high" | "medium" | "low" };
  firm_memory: { status: "CONTRADICTION_FOUND" | "NO_CONFLICT"; reference?: { matter: string; date: string; position: string } };
  score: number;
  orchestrator_reasoning: string;
}

// ─── Tool metadata ────────────────────────────────────────────────────────────

const TOOL_META: Record<string, { label: string; icon: string; color: string; model: "opus" | "sonnet" }> = {
  extractClaims:        { label: "Extract Claims",     icon: "◈", color: "#4a9eff", model: "sonnet" },
  runSourcer:           { label: "Citation Sourcer",   icon: "⊕", color: "#00d98b", model: "sonnet" },
  runJurisdictionist:   { label: "Jurisdictionist",    icon: "◉", color: "#9f7aea", model: "sonnet" },
  runHistorian:         { label: "Legal Historian",    icon: "⊗", color: "#f5a623", model: "sonnet" },
  runDevilsAdvocate:    { label: "Devil's Advocate",   icon: "⊘", color: "#ff6b6b", model: "sonnet" },
  runFirmMemory:        { label: "Firm Memory",        icon: "⊙", color: "#00d9d9", model: "sonnet" },
  deepResearch:         { label: "Deep Research",      icon: "⊛", color: "#d0a0ff", model: "sonnet" },
  reportClaim:          { label: "Report Claim",       icon: "⊞", color: "#f5a623", model: "opus" },
};

function getToolName(type: string) { return type.replace(/^tool-/, ""); }
function getMeta(type: string) {
  return TOOL_META[getToolName(type)] ?? { label: getToolName(type), icon: "○", color: "#6e6e8a", model: "sonnet" };
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
  CITED: "bg-emerald-950 text-emerald-300 border-emerald-800",
  APPLICABLE: "bg-emerald-950 text-emerald-300 border-emerald-800",
  CURRENT: "bg-emerald-950 text-emerald-300 border-emerald-800",
  NO_CONFLICT: "bg-emerald-950 text-emerald-300 border-emerald-800",
  low: "bg-emerald-950 text-emerald-300 border-emerald-800",
  INFERRED: "bg-amber-950 text-amber-300 border-amber-800",
  UNCLEAR: "bg-amber-950 text-amber-300 border-amber-800",
  AMENDED: "bg-amber-950 text-amber-300 border-amber-800",
  medium: "bg-amber-950 text-amber-300 border-amber-800",
  NOT_FOUND: "bg-rose-950 text-rose-300 border-rose-800",
  WRONG_JURISDICTION: "bg-rose-950 text-rose-300 border-rose-800",
  CONTRADICTION_FOUND: "bg-rose-950 text-rose-300 border-rose-800",
  high: "bg-rose-950 text-rose-300 border-rose-800",
  UNKNOWN: "bg-zinc-900 text-zinc-400 border-zinc-700",
};

function Badge({ label }: { label: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold tracking-widest font-mono ${BADGE_COLORS[label] ?? "bg-zinc-900 text-zinc-400 border-zinc-700"}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

// ─── Pulse ────────────────────────────────────────────────────────────────────

function Pulse({ color }: { color: string }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }} />
      <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: color }} />
    </span>
  );
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score < 40 ? "#ff3b5c" : score < 70 ? "#f5a623" : "#00d98b";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a1a2e" strokeWidth={7} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }} />
    </svg>
  );
}

// ─── Thought / reasoning card ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ThoughtCard({ part }: { part: any }) {
  const [open, setOpen] = useState(false);
  const isReasoning = part.type === "reasoning";
  const text: string = part.text ?? "";
  const isEmpty = !text.trim();

  if (isEmpty) return null;

  const preview = text.slice(0, 160).trim();
  const isLong = text.length > 160;

  return (
    <div className={`rounded-lg border overflow-hidden ${
      isReasoning
        ? "border-purple-900/40 bg-purple-950/10"
        : "border-zinc-800/40 bg-zinc-900/20"
    }`}>
      <button
        onClick={() => isLong && setOpen(!open)}
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left"
      >
        {/* Icon */}
        <span className={`text-xs mt-0.5 shrink-0 ${isReasoning ? "text-purple-400" : "text-zinc-500"}`}>
          {isReasoning ? "◎" : "◦"}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] uppercase tracking-widest font-bold ${
              isReasoning ? "text-purple-500" : "text-zinc-600"
            }`}>
              {isReasoning ? "Extended Thinking" : "Opus"}
            </span>
          </div>
          <p className={`text-[11px] leading-relaxed ${isReasoning ? "text-purple-200/70" : "text-zinc-400"} ${
            !open && isLong ? "line-clamp-3" : ""
          }`}>
            {open ? text : preview}{isLong && !open ? "…" : ""}
          </p>
        </div>

        {isLong && (
          <span className="text-[9px] text-zinc-700 shrink-0 mt-1">{open ? "▲" : "▼"}</span>
        )}
      </button>
    </div>
  );
}

// ─── Tool card with expandable detail ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ToolCard({ part }: { part: any }) {
  const [open, setOpen] = useState(false);
  const meta = getMeta(part.type as string);
  const isDone   = part.state === "output-available";
  const isError  = part.state === "output-error";
  const isActive = !isDone && !isError;

  // Subtitle
  let subtitle = "";
  if (part.state === "input-streaming") subtitle = "generating call…";
  else if (part.state === "input-available") subtitle = "executing…";
  else if (isError) subtitle = part.errorText ?? "error";
  else if (isDone && part.type === "tool-extractClaims") {
    subtitle = `${(part.output as { count: number })?.count ?? "?"} claims extracted`;
  } else if (isDone && part.type === "tool-reportClaim") {
    subtitle = `score ${(part.output as ClaimResult)?.score ?? "?"}/100`;
  } else if (isDone && part.type === "tool-runSourcer") {
    subtitle = (part.output as { status: string })?.status ?? "done";
  } else if (isDone && part.type === "tool-runJurisdictionist") {
    const o = part.output as { status: string; confidence: number };
    subtitle = `${o?.status?.replace(/_/g, " ") ?? "done"} · ${o?.confidence ?? "?"}% confidence`;
  } else if (isDone && part.type === "tool-runHistorian") {
    subtitle = (part.output as { status: string })?.status ?? "done";
  } else if (isDone && part.type === "tool-runDevilsAdvocate") {
    const o = part.output as { strength: string };
    subtitle = `${o?.strength ?? "?"} counter-argument strength`;
  } else if (isDone && part.type === "tool-runFirmMemory") {
    subtitle = (part.output as { status: string })?.status?.replace(/_/g, " ") ?? "done";
  } else if (isDone && part.type === "tool-deepResearch") {
    subtitle = "research complete";
  } else if (isDone) {
    subtitle = "done";
  }

  const claimText: string | undefined =
    (part.input as { claim?: { text?: string } })?.claim?.text ??
    (part.type === "tool-deepResearch" ? (part.input as { task?: string })?.task : undefined);

  const scoreValue = isDone && part.type === "tool-reportClaim"
    ? (part.output as ClaimResult)?.score
    : null;

  return (
    <div className={`rounded-lg border overflow-hidden transition-all duration-200 ${
      isError  ? "border-rose-800/50 bg-rose-950/10" :
      isDone   ? "border-zinc-800/60 bg-zinc-900/20" :
      "border-zinc-700/40 bg-zinc-900/40"
    }`}>
      {/* Header row — always visible */}
      <button
        onClick={() => isDone && setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/3 transition-colors"
      >
        <span className="text-sm font-bold shrink-0" style={{ color: meta.color }}>{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-200 tracking-wide">{meta.label}</span>
            {isActive && <Pulse color={meta.color} />}
            {isDone && <span className="text-[9px] text-zinc-600 tracking-widest">DONE</span>}
            {isError && <span className="text-[9px] text-rose-500 tracking-widest">ERROR</span>}
          </div>
          {subtitle && <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{subtitle}</p>}
        </div>

        {/* Score or chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {scoreValue !== null && scoreValue !== undefined && (
            <span className="text-sm font-bold tabular-nums" style={{
              color: scoreValue < 40 ? "#ff3b5c" : scoreValue < 70 ? "#f5a623" : "#00d98b",
            }}>{scoreValue}/100</span>
          )}
          {isDone && (
            <span className="text-zinc-600 text-xs">{open ? "▲" : "▼"}</span>
          )}
        </div>
      </button>

      {/* Claim snippet */}
      {claimText && !open && (
        <div className="px-3 pb-2 border-t border-white/5">
          <p className="text-[10px] text-zinc-600 italic mt-1.5 leading-relaxed line-clamp-1">
            "{claimText}"
          </p>
        </div>
      )}

      {/* Expanded detail */}
      {open && isDone && (
        <div className="border-t border-zinc-800/60 p-3 space-y-2">
          <div>
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1">Input</p>
            <pre className="text-[10px] text-zinc-400 bg-zinc-950/60 rounded p-2 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
              {JSON.stringify(part.input, null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1">Output</p>
            <pre className="text-[10px] text-zinc-400 bg-zinc-950/60 rounded p-2 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
              {JSON.stringify(part.output, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Claim result card ────────────────────────────────────────────────────────

function ClaimCard({ result, index }: { result: ClaimResult; index: number }) {
  const [expanded, setExpanded] = useState(true);
  const score = result.score;
  const scoreColor = score < 40 ? "text-rose-400" : score < 70 ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 bg-zinc-900/40 hover:bg-zinc-900/70 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] text-zinc-500 font-mono shrink-0">CLAIM {index + 1}</span>
          <span className="text-[10px] text-zinc-400 font-mono shrink-0">{result.claim.regulation} {result.claim.article}</span>
          <span className="text-[10px] text-zinc-500 truncate italic">"{result.claim.text.slice(0, 90)}{result.claim.text.length > 90 ? "…" : ""}"</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xl font-bold tabular-nums font-mono ${scoreColor}`}>
            {score}<span className="text-sm text-zinc-600">/100</span>
          </span>
          <span className="text-zinc-600 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-5 py-4 space-y-4 border-t border-zinc-800">
          <p className="text-sm text-zinc-400 italic border-l-2 border-zinc-700 pl-3 leading-relaxed">
            {result.claim.text}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: TOOL_META.runSourcer.icon, color: TOOL_META.runSourcer.color, label: "Citation Sourcer", status: result.sourcer.status, detail: result.sourcer.discrepancy ?? result.sourcer.verbatim_quote },
              { icon: TOOL_META.runJurisdictionist.icon, color: TOOL_META.runJurisdictionist.color, label: "Jurisdictionist", status: result.jurisdictionist.status, detail: `${result.jurisdictionist.confidence}% · ${result.jurisdictionist.reason}` },
              { icon: TOOL_META.runHistorian.icon, color: TOOL_META.runHistorian.color, label: "Historian", status: result.historian.status, detail: result.historian.note },
              { icon: TOOL_META.runDevilsAdvocate.icon, color: TOOL_META.runDevilsAdvocate.color, label: "Devil's Advocate", status: result.devils_advocate.strength.toUpperCase(), detail: `${result.devils_advocate.counter_authority}: ${result.devils_advocate.why_it_undermines}` },
              { icon: TOOL_META.runFirmMemory.icon, color: TOOL_META.runFirmMemory.color, label: "Firm Memory", status: result.firm_memory.status, detail: result.firm_memory.status === "CONTRADICTION_FOUND" && result.firm_memory.reference ? `${result.firm_memory.reference.matter} (${result.firm_memory.reference.date})` : "No contradictions found." },
            ].map((row) => (
              <div key={row.label} className="rounded-lg border border-zinc-800/80 bg-zinc-900/20 px-3 py-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: row.color }}>{row.icon}</span>
                  <span className="text-[10px] text-zinc-500 tracking-wider uppercase">{row.label}</span>
                </div>
                <Badge label={row.status} />
                {row.detail && <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-3">{row.detail}</p>}
              </div>
            ))}
          </div>
          {result.orchestrator_reasoning && (
            <div className="border border-zinc-800 rounded-lg px-4 py-3 bg-zinc-900/30">
              <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1.5">Opus Reasoning</p>
              <p className="text-xs text-zinc-400 leading-relaxed">{result.orchestrator_reasoning}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Cost estimator ───────────────────────────────────────────────────────────

function estimateCost(toolParts: unknown[]): number {
  // Rough heuristic: each tool call ≈ 2k tokens in + 500 out on Sonnet,
  // plus orchestrator Opus overhead ≈ 5k in + 1k out per tool call round
  const n = toolParts.length;
  const sonnetCalls = Math.max(0, n - 1); // all except reportClaim
  const opusCalls = n; // every call goes through Opus first
  const sonnetCost = sonnetCalls * (2000 / 1e6 * PRICING["claude-sonnet-4-6"].in + 500 / 1e6 * PRICING["claude-sonnet-4-6"].out);
  const opusCost   = opusCalls   * (5000 / 1e6 * PRICING["claude-opus-4-8"].in  + 1000 / 1e6 * PRICING["claude-opus-4-8"].out);
  return sonnetCost + opusCost;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [docText, setDocText] = useState(DEMO_MEMO);
  const [entity, setEntity]   = useState(DEMO_ENTITY);
  const [tab, setTab]         = useState<"feed" | "agents" | "graph">("feed");
  const [leftTab, setLeftTab] = useState<"sources" | "audit">("sources");
  const [indexedDocs, setIndexedDocs] = useState<IndexedDoc[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/audit" }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (err) => console.error("Chat error:", err),
  });

  const isRunning = status === "streaming" || status === "submitted";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allParts: any[] = messages.filter((m) => m.role === "assistant").flatMap((m) => m.parts ?? []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolParts: any[] = allParts.filter((p) => (p.type as string).startsWith("tool-"));
  // Feed includes text, reasoning (extended thinking), and tool parts — in natural order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feedParts: any[] = allParts.filter((p) =>
    (p.type as string).startsWith("tool-") || p.type === "text" || p.type === "reasoning"
  );

  const claimResults: ClaimResult[] = toolParts
    .filter((p) => p.type === "tool-reportClaim" && p.state === "output-available")
    .map((p) => p.output as ClaimResult);

  const overallScore = claimResults.length > 0
    ? Math.round(claimResults.reduce((s, r) => s + r.score, 0) / claimResults.length)
    : null;

  const estimatedCost = estimateCost(toolParts);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [toolParts.length]);

  useEffect(() => {
    if (isRunning && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
      const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current!) / 1000)), 1000);
      return () => clearInterval(id);
    }
    if (!isRunning) startTimeRef.current = null;
  }, [isRunning]);

  function runAudit() {
    if (!docText.trim() || isRunning) return;
    setElapsed(null);
    setLeftTab("audit");

    const firmContext = indexedDocs.length > 0
      ? `\n\nFIRM KNOWLEDGE BASE (${indexedDocs.length} documents indexed from connected sources):\n` +
        indexedDocs.map((d) => `[${d.source.toUpperCase()}] ${d.title}: ${d.snippet}`).join("\n")
      : "";

    sendMessage({
      text: `Audit this legal document.\nENTITY: ${entity}\n\nDOCUMENT:\n${docText}${firmContext}`,
    });
  }

  const verdict = overallScore === null ? null :
    overallScore < 40 ? { text: "DO NOT SEND",      sub: "Partner review required",   color: "text-rose-400",    border: "border-rose-900/60"    } :
    overallScore < 70 ? { text: "REVIEW REQUIRED",  sub: "Revise before sending",      color: "text-amber-400",   border: "border-amber-900/60"   } :
                        { text: "PROCEED",           sub: "Standard review only",       color: "text-emerald-400", border: "border-emerald-900/60" };

  return (
    <main className="min-h-screen bg-[#040408] text-zinc-100 font-mono flex flex-col">

      {/* ── Top bar ── */}
      <div className="border-b border-zinc-800/60 px-5 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold tracking-tight text-white">⚖ GAVEL</span>
          <span className="text-[9px] text-zinc-600 uppercase tracking-widest hidden sm:block">Legal AI Reasoning Auditor</span>
          <Link href="/research" className="text-[10px] text-amber-500 hover:text-amber-300 border border-amber-900/60 px-2.5 py-1 rounded transition-colors uppercase tracking-widest hidden sm:block">
            ⊛ Research
          </Link>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-zinc-600">
          {toolParts.length > 0 && (
            <span className="text-zinc-500">
              ~${estimatedCost.toFixed(3)} est.
            </span>
          )}
          {isRunning && elapsed !== null && <span className="text-blue-400 tabular-nums">{elapsed}s</span>}
          {isRunning && (
            <button
              onClick={() => stop()}
              className="px-3 py-1 rounded border border-rose-800/60 text-rose-400 text-[10px] uppercase tracking-widest hover:bg-rose-950/40 transition-colors"
            >
              ■ Stop
            </button>
          )}
        </div>
      </div>

      {/* ── Body: two columns ── */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0" style={{ height: "calc(100vh - 45px)" }}>

        {/* ── Left panel ── */}
        <div className="w-full lg:w-[380px] shrink-0 border-r border-zinc-800/60 flex flex-col overflow-hidden">
          {/* Left tab bar */}
          <div className="flex border-b border-zinc-800/60 shrink-0">
            {(["sources", "audit"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setLeftTab(t)}
                className={`flex-1 py-2 text-[10px] uppercase tracking-widest transition-colors relative ${
                  leftTab === t ? "text-zinc-100" : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {t === "sources" ? "Sources" : "Audit"}
                {t === "sources" && indexedDocs.length > 0 && (
                  <span className="absolute top-1.5 right-3 text-[7px] bg-blue-500 text-white rounded-full px-1 font-mono">
                    {indexedDocs.length}
                  </span>
                )}
                {leftTab === t && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-zinc-300" />
                )}
              </button>
            ))}
          </div>

          {/* Left panel content */}
          <div className="flex-1 overflow-y-auto">
            {leftTab === "sources" ? (
              <SourcesPanel onIndexed={setIndexedDocs} />
            ) : (
              <div className="p-4 space-y-4">
                {/* Sources context pill */}
                {indexedDocs.length > 0 && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-blue-900/50 bg-blue-950/20">
                    <span className="text-blue-400 text-xs">⊡</span>
                    <span className="text-[10px] text-blue-300">{indexedDocs.length} docs from connected sources will enrich Firm Memory</span>
                  </div>
                )}

                <div>
                  <label className="text-[9px] text-zinc-500 uppercase tracking-widest block mb-1.5">AI-Generated Legal Document</label>
                  <textarea
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 h-44 resize-none focus:outline-none focus:border-zinc-600 leading-relaxed placeholder-zinc-700"
                    value={docText}
                    onChange={(e) => setDocText(e.target.value)}
                    placeholder="Paste an AI-generated legal memo or contract clause…"
                    disabled={isRunning}
                  />
                </div>

                <div>
                  <label className="text-[9px] text-zinc-500 uppercase tracking-widest block mb-1.5">Entity Description</label>
                  <input
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 placeholder-zinc-700"
                    value={entity}
                    onChange={(e) => setEntity(e.target.value)}
                    placeholder="e.g. UK-based fintech with no EU establishment"
                    disabled={isRunning}
                  />
                </div>

                <button
                  onClick={runAudit}
                  disabled={isRunning || !docText.trim()}
                  className={`w-full py-2.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all ${
                    isRunning ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : "bg-white text-zinc-950 hover:bg-zinc-200 cursor-pointer"
                  }`}
                >
                  {isRunning
                    ? <span className="flex items-center justify-center gap-2"><span className="animate-spin inline-block">◌</span> Running…</span>
                    : "▶  Run GAVEL Audit"}
                </button>

                {/* Stats */}
                {toolParts.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <StatBox label="Tool calls" value={toolParts.length} />
                    <StatBox label="Claims" value={claimResults.length} />
                    <StatBox label="Est. cost" value={`$${estimatedCost.toFixed(3)}`} color="#f5a623" />
                  </div>
                )}

                {/* Score / verdict */}
                {verdict && overallScore !== null && (
                  <div className={`rounded-xl border ${verdict.border} p-4`}>
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                        <ScoreRing score={overallScore} size={72} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-base font-bold tabular-nums" style={{
                            color: overallScore < 40 ? "#ff3b5c" : overallScore < 70 ? "#f5a623" : "#00d98b",
                          }}>{overallScore}</span>
                        </div>
                      </div>
                      <div>
                        <p className={`text-sm font-bold tracking-wider ${verdict.color}`}>{verdict.text}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{verdict.sub}</p>
                        <p className="text-[10px] text-zinc-600 mt-1">GAVEL score / 100</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pricing */}
                {toolParts.length > 0 && (
                  <div className="rounded-lg border border-zinc-800/60 p-3 text-[10px] text-zinc-600 space-y-1">
                    <p className="text-zinc-500 uppercase tracking-widest mb-1">Pricing basis</p>
                    <p>Opus 4.8 — $15/MTok in · $75/MTok out</p>
                    <p>Sonnet 4.6 — $3/MTok in · $15/MTok out</p>
                    <p className="text-zinc-700 mt-1">Estimate based on ~{toolParts.length} calls at avg token heuristics.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: live feed + graph tabs ── */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Tab bar */}
          <div className="px-4 py-2.5 border-b border-zinc-800/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1">
              {(["feed", "agents", "graph"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded text-[10px] uppercase tracking-widest transition-colors ${
                    tab === t
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  {t === "feed" ? "Activity Feed" : t === "agents" ? "Agents" : "Agent Graph"}
                </button>
              ))}
              {isRunning && <Pulse color="#4a9eff" />}
            </div>
            <span className="text-[9px] text-zinc-600">
              {toolParts.length > 0 ? `${toolParts.length} calls` : ""}
            </span>
          </div>

          {/* Feed view */}
          {tab === "feed" && (
            <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {feedParts.length === 0 && !isRunning && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20 space-y-3 pointer-events-none">
                  <div className="text-5xl">⚖</div>
                  <p className="text-xs text-zinc-500 uppercase tracking-widest">Run an audit to see live agent activity</p>
                </div>
              )}
              {feedParts.map((part, i) => {
                if ((part.type as string).startsWith("tool-")) {
                  return <ToolCard key={`${part.toolCallId ?? i}-${i}`} part={part} />;
                }
                return <ThoughtCard key={`thought-${i}`} part={part} />;
              })}
            </div>
          )}

          {/* Agents roster view */}
          {tab === "agents" && (
            <div className="flex-1 overflow-hidden">
              <AgentRoster toolParts={toolParts} isRunning={isRunning} />
            </div>
          )}

          {/* Neo4j graph view */}
          {tab === "graph" && (
            <div className="flex-1 overflow-hidden bg-[#040408]">
              <Neo4jGraph isRunning={isRunning} />
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: claim results ── */}
      {claimResults.length > 0 && (
        <div className="border-t border-zinc-800/60 p-4 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest">Claim Audit Results</span>
            <span className="text-[9px] text-zinc-600">{claimResults.length} claim{claimResults.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-3">
            {claimResults.map((r, i) => <ClaimCard key={i} result={r} index={i} />)}
          </div>
        </div>
      )}
    </main>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 py-2 px-2 text-center">
      <p className="text-[9px] text-zinc-600 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-bold mt-0.5" style={{ color: color ?? "#c8c8d8" }}>{value}</p>
    </div>
  );
}
