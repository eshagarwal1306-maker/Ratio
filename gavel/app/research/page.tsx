"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ResearchGraph } from "../ResearchGraph";

// ── Badge ─────────────────────────────────────────────────────────────────────

const CONF_COLORS: Record<string, string> = {
  high:   "bg-emerald-950 text-emerald-300 border-emerald-800",
  medium: "bg-amber-950 text-amber-300 border-amber-800",
  low:    "bg-zinc-900 text-zinc-400 border-zinc-700",
};

function ConfBadge({ level }: { level: string }) {
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono font-bold uppercase tracking-widest ${CONF_COLORS[level] ?? CONF_COLORS.low}`}>
      {level}
    </span>
  );
}

function SourceBadge({ src }: { src: string }) {
  const colors: Record<string, string> = {
    gmail: "border-red-800 text-red-400",
    harvey: "border-purple-800 text-purple-400",
    lexis: "border-sky-800 text-sky-400",
    notion: "border-slate-700 text-slate-400",
    teams: "border-indigo-800 text-indigo-400",
    web: "border-cyan-800 text-cyan-400",
    "eu-cellar": "border-green-800 text-green-400",
    "eur-lex": "border-violet-800 text-violet-400",
  };
  return (
    <span className={`text-[8px] px-1.5 py-0.5 rounded border font-mono ${colors[src] ?? "border-zinc-700 text-zinc-500"}`}>
      {src}
    </span>
  );
}

// ── Finding card ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FindingCard({ part, index }: { part: any; index: number }) {
  const [open, setOpen] = useState(true);
  const out = part.output;
  if (!out) return null;

  return (
    <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 overflow-hidden">
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-amber-950/20 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="text-amber-400 text-base mt-0.5 shrink-0">★</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[9px] text-zinc-600 font-mono">FINDING {index + 1}</span>
            <ConfBadge level={out.confidence ?? "medium"} />
            {(out.articleRef) && (
              <span className="text-[9px] text-amber-600 font-mono">{out.articleRef}</span>
            )}
          </div>
          <p className="text-xs font-semibold text-amber-200">{out.title}</p>
        </div>
        <span className="text-zinc-600 text-xs shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-amber-900/20">
          <p className="text-[11px] text-zinc-300 leading-relaxed pt-3">{out.finding}</p>
          {Array.isArray(out.sources) && out.sources.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] text-zinc-600 uppercase tracking-widest">Sources:</span>
              {out.sources.map((s: string) => <SourceBadge key={s} src={s} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tool status card ──────────────────────────────────────────────────────────

const TOOL_META: Record<string, { label: string; icon: string; color: string }> = {
  searchLocalDocs:   { label: "Firm Knowledge Base", icon: "⊡", color: "#818cf8" },
  webSearch:         { label: "Perplexity Search",   icon: "⊛", color: "#22d3ee" },
  sparqlQuery:       { label: "EU Cellar SPARQL",    icon: "⊛", color: "#4ade80" },
  fetchCellarArticle:{ label: "EUR-Lex Article",     icon: "⊟", color: "#a78bfa" },
  addCitation:       { label: "Citation Recorded",   icon: "★",  color: "#f59e0b" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ToolStatus({ part }: { part: any }) {
  const toolName = (part.type as string).replace(/^tool-/, "");
  const meta = TOOL_META[toolName] ?? { label: toolName, icon: "○", color: "#6e6e8a" };
  const isDone = part.state === "output-available";
  const isActive = !isDone && part.state !== "output-error";

  if (toolName === "addCitation") return null; // shown as FindingCard

  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-zinc-800/50 bg-zinc-900/20">
      <span style={{ color: meta.color }} className="text-sm shrink-0">{meta.icon}</span>
      <span className="text-[10px] text-zinc-400 flex-1">{meta.label}</span>
      {isActive ? (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: meta.color }} />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: meta.color }} />
        </span>
      ) : isDone ? (
        <span className="text-[9px] text-zinc-600">done</span>
      ) : null}
    </div>
  );
}

// ── Example queries ───────────────────────────────────────────────────────────

const EXAMPLES = [
  "Does DORA apply to UK fintech firms post-Brexit?",
  "What are the ICT sub-outsourcing requirements under DORA Article 30?",
  "How does EBA/GL/2019/04 compare to DORA for UK banks?",
  "What penalties exist for DORA non-compliance?",
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [indexedDocs, setIndexedDocs] = useState<unknown[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  // Load indexed docs from localStorage (written by SourcesPanel)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("gavel_indexed_docs");
      if (stored) setIndexedDocs(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/research",
      body: { indexedDocs },
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (err) => console.error("Research error:", err),
  });

  const isRunning = status === "streaming" || status === "submitted";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allParts: any[] = messages
    .filter((m) => m.role === "assistant")
    .flatMap((m) => m.parts ?? []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolParts: any[] = allParts.filter((p) => (p.type as string).startsWith("tool-"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textParts: any[] = allParts.filter((p) => p.type === "text" || p.type === "reasoning");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const findingParts: any[] = toolParts.filter(
    (p) => p.type === "tool-addCitation" && p.state === "output-available"
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nonFindingTools: any[] = toolParts.filter((p) => p.type !== "tool-addCitation");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const indexedSources = [...new Set((indexedDocs as any[]).map((d: any) => d.source as string))];

  // Final summary from Opus
  const summaryText = textParts
    .filter((p) => p.type === "text" && p.text?.trim())
    .map((p) => p.text as string)
    .join("\n\n")
    .trim();

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [toolParts.length, textParts.length]);

  function runResearch() {
    if (!query.trim() || isRunning) return;
    setSubmittedQuery(query);
    sendMessage({ text: `Research this legal question thoroughly and cite all relevant sources:\n\n${query}` });
  }

  return (
    <main className="min-h-screen bg-[#030308] text-zinc-100 font-mono flex flex-col">

      {/* ── Top nav ── */}
      <div className="border-b border-zinc-800/60 px-5 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-base font-bold tracking-tight text-zinc-400 hover:text-zinc-200 transition-colors">
            ⚖ GAVEL
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-sm font-bold text-amber-400 tracking-tight">Research</span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          {isRunning && (
            <button
              onClick={() => stop()}
              className="px-3 py-1 rounded border border-rose-800/60 text-rose-400 hover:bg-rose-950/40 transition-colors uppercase tracking-widest"
            >
              ■ Stop
            </button>
          )}
          {indexedSources.length > 0 && (
            <span className="text-zinc-600">
              {indexedSources.length} source{indexedSources.length !== 1 ? "s" : ""} connected
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0" style={{ height: "calc(100vh - 45px)" }}>

        {/* ── Left panel ── */}
        <div className="w-full lg:w-[380px] shrink-0 border-r border-zinc-800/60 flex flex-col min-h-0">

          {/* Query input */}
          <div className="p-4 space-y-3 border-b border-zinc-800/40 shrink-0">
            <div>
              <label className="text-[9px] text-zinc-500 uppercase tracking-widest block mb-1.5">
                Research Question
              </label>
              <textarea
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 h-24 resize-none focus:outline-none focus:border-amber-800/60 leading-relaxed placeholder-zinc-700 transition-colors"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a legal research question…"
                disabled={isRunning}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runResearch(); }}
              />
            </div>

            {/* Example queries */}
            {!submittedQuery && (
              <div className="space-y-1">
                <p className="text-[8px] text-zinc-700 uppercase tracking-widest">Examples</p>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setQuery(ex)}
                    className="w-full text-left text-[10px] text-zinc-600 hover:text-zinc-400 px-2 py-1 rounded hover:bg-zinc-900/50 transition-colors leading-relaxed"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}

            {/* Connected sources pill */}
            {indexedSources.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {indexedSources.map((s) => <SourceBadge key={s} src={s} />)}
                <span className="text-[9px] text-zinc-700 self-center">will be searched</span>
              </div>
            )}

            <button
              onClick={runResearch}
              disabled={isRunning || !query.trim()}
              className={`w-full py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all ${
                isRunning
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-amber-500 text-zinc-950 hover:bg-amber-400 cursor-pointer"
              }`}
            >
              {isRunning
                ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">◌</span> Researching…</span>
                : "⊛  Research"}
            </button>
          </div>

          {/* Feed: tool status + findings + summary */}
          <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-2">

            {/* Tool status feed */}
            {nonFindingTools.length > 0 && (
              <div className="space-y-1 mb-3">
                <p className="text-[8px] text-zinc-700 uppercase tracking-widest mb-1.5">Research steps</p>
                {nonFindingTools.map((p, i) => <ToolStatus key={`tool-${i}`} part={p} />)}
              </div>
            )}

            {/* Findings */}
            {findingParts.length > 0 && (
              <div className="space-y-2">
                <p className="text-[8px] text-zinc-500 uppercase tracking-widest">
                  {findingParts.length} finding{findingParts.length !== 1 ? "s" : ""} recorded
                </p>
                {findingParts.map((p, i) => <FindingCard key={`f-${i}`} part={p} index={i} />)}
              </div>
            )}

            {/* Opus summary */}
            {summaryText && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 space-y-2">
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Opus Summary</p>
                <p className="text-[11px] text-zinc-300 leading-relaxed">{summaryText}</p>
              </div>
            )}

            {/* Empty state */}
            {toolParts.length === 0 && !isRunning && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-25 py-12 space-y-3">
                <div className="text-4xl text-amber-400">◎</div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">No research yet</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: fancy research graph ── */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ResearchGraph
            toolParts={toolParts}
            query={submittedQuery}
            isRunning={isRunning}
            indexedSources={indexedSources}
          />
        </div>
      </div>
    </main>
  );
}
