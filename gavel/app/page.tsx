"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { AgentGraph } from "./AgentGraph";
import { Neo4jGraph } from "./Neo4jGraph";
import { PersonaStressTestPanel } from "./PersonaStressTestPanel";
import { VerificationStepper } from "./VerificationStepper";
import { AuditStory } from "./AuditStory";
import { LandingPage } from "./LandingPage";
import type { ClaimResult, GeneratedCitation } from "@/lib/types";

// ─── Phase / Mode ─────────────────────────────────────────────────────────────

type Phase = "mode-select" | "setup" | "running" | "review" | "done";
type Mode = "generate" | "verify";

// ─── Human-readable agent progress steps ─────────────────────────────────────

const STEPS = [
  { key: "extractClaims",      label: "Identifying legal claims",     sub: "Reading document and finding each legal assertion" },
  { key: "runSourcer",         label: "Checking source citations",    sub: "Verifying each cited statute and article exists verbatim" },
  { key: "runJurisdictionist", label: "Verifying jurisdiction",       sub: "Confirming the regulations actually apply to your client" },
  { key: "runHistorian",       label: "Checking currency of law",     sub: "Confirming the law is still in force and articles are correct" },
  { key: "runDevilsAdvocate",  label: "Reviewing counter-arguments",  sub: "Finding opposing case law that could undermine the advice" },
  { key: "runFirmMemory",      label: "Conflict check",               sub: "Checking against the firm's previous positions and advice" },
  { key: "deepResearch",       label: "Researching case law",         sub: "Searching Bailii and regulatory databases for real precedents" },
  { key: "reportClaim",        label: "Finalising claim assessment",  sub: "Calculating overall reliability score for this claim" },
];

const STATUS_VERDICTS: Record<string, { label: string; color: string }> = {
  CITED:                { label: "Source verified",               color: "#047857" },
  INFERRED:             { label: "Source unclear",                color: "#b45309" },
  NOT_FOUND:            { label: "Source not found",              color: "#b91c1c" },
  APPLICABLE:           { label: "Applies to your client",        color: "#047857" },
  WRONG_JURISDICTION:   { label: "Does not apply — wrong jurisdiction", color: "#b91c1c" },
  UNCLEAR:              { label: "Jurisdiction uncertain",        color: "#b45309" },
  CURRENT:              { label: "Law is current",                color: "#047857" },
  AMENDED:              { label: "Law has been amended",          color: "#b45309" },
  UNKNOWN:              { label: "Currency unknown",              color: "#6b7280" },
  NO_CONFLICT:          { label: "No conflicts found",            color: "#047857" },
  CONTRADICTION_FOUND:  { label: "Contradicts prior advice",      color: "#b91c1c" },
  high:                 { label: "Strong counter-argument",       color: "#b91c1c" },
  medium:               { label: "Some counter-argument",         color: "#b45309" },
  low:                  { label: "Weak counter-argument",         color: "#047857" },
};

// ─── Citation type config ─────────────────────────────────────────────────────

const CITATION_TYPE_COLOR: Record<string, string> = {
  legislation:         "#1d4ed8",
  case_law:            "#7c3aed",
  practitioners_guide: "#b45309",
  academic:            "#047857",
};
const CITATION_TYPE_LABEL: Record<string, string> = {
  legislation:         "Legislation",
  case_law:            "Case law",
  practitioners_guide: "Practice guide",
  academic:            "Academic",
};

// ─── Shared UI components ─────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-navy-700" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function StatusDot({ verdict }: { verdict: string }) {
  const v = STATUS_VERDICTS[verdict];
  if (!v) return null;
  return (
    <span
      className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ color: v.color, backgroundColor: v.color + "18", border: `1px solid ${v.color}40` }}
    >
      {v.label}
    </span>
  );
}

function CitationRow({ cit, index }: { cit: GeneratedCitation; index: number }) {
  const color = CITATION_TYPE_COLOR[cit.type] ?? "#64748b";
  const label = CITATION_TYPE_LABEL[cit.type] ?? cit.type;
  return (
    <div className="flex gap-4 py-5 border-b border-slate-100 group">
      <span className="text-xs text-slate-300 font-mono pt-0.5 w-5 shrink-0 text-right select-none">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-slate-900 leading-snug mb-1">{cit.title}</p>
        <p className="text-[11px] font-mono text-slate-400 mb-2">{cit.reference}</p>
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
            {label}
          </span>
          <span className="text-slate-200">·</span>
          <span className="text-[12px] text-slate-500 truncate">{cit.relevance}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Step progress (running phase) ────────────────────────────────────────────

const PARALLEL_AGENTS = [
  { key: "runSourcer",         label: "Source",       color: "#00d98b" },
  { key: "runJurisdictionist", label: "Jurisdiction", color: "#9f7aea" },
  { key: "runHistorian",       label: "Currency",     color: "#f5a623" },
  { key: "runDevilsAdvocate",  label: "Counter",      color: "#ff6b6b" },
  { key: "runFirmMemory",      label: "Conflicts",    color: "#00d9d9" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StepProgress({ toolParts }: { toolParts: any[] }) {
  const extractParts = toolParts.filter((p) => p.type === "tool-extractClaims");
  const extractDone = extractParts.some((p) => p.state === "output-available");
  const extractRunning = !extractDone && extractParts.length > 0;
  const extractCount = extractDone ? (extractParts[extractParts.length - 1]?.output?.count ?? extractParts[extractParts.length - 1]?.output?.length ?? "?") : null;

  const reportParts = toolParts.filter((p) => p.type === "tool-reportClaim");
  const claimsDone = reportParts.filter((p) => p.state === "output-available").length;
  const claimsRunning = reportParts.filter((p) => p.state !== "output-available" && p.state !== "output-error").length;
  const totalClaims = extractCount ?? (claimsDone + claimsRunning);

  const agentStates = PARALLEL_AGENTS.map((a) => {
    const parts = toolParts.filter((p) => p.type === `tool-${a.key}`);
    const done = parts.filter((p) => p.state === "output-available").length;
    const running = parts.filter((p) => p.state !== "output-available" && p.state !== "output-error").length;
    const errored = parts.filter((p) => p.state === "output-error").length;
    const total = done + running + errored;
    return { ...a, done, running, errored, total };
  });

  const totalAgentDone = agentStates.reduce((s, a) => s + a.done, 0);
  const totalAgentMax = PARALLEL_AGENTS.length * (totalClaims as number || 1);
  const overallPct = Math.min(100, Math.round((totalAgentDone / totalAgentMax) * 100));

  const step2Active = extractDone || claimsDone > 0 || agentStates.some((a) => a.total > 0);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pt-4">

      {/* Step 1: Extract */}
      <div className={`rounded-2xl border p-5 transition-all ${
        extractDone ? "border-slate-200 bg-slate-50" :
        extractRunning ? "border-blue-200 bg-blue-50" :
        "border-slate-100 bg-white opacity-60"
      }`}>
        <div className="flex items-center gap-3 mb-1">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            extractDone ? "bg-green-100 text-green-700" :
            extractRunning ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"
          }`}>
            {extractDone ? "✓" : extractRunning ? "1" : "1"}
          </div>
          <p className={`text-sm font-semibold ${
            extractDone ? "text-slate-700" : extractRunning ? "text-[#1c3461]" : "text-slate-400"
          }`}>
            Identify legal claims
            {extractDone && extractCount && (
              <span className="ml-2 text-xs font-normal text-slate-500">{extractCount} claims found</span>
            )}
          </p>
          {extractRunning && <Spinner />}
        </div>
        <p className="text-xs text-slate-400 ml-9">Reading document and extracting each legal assertion</p>
      </div>

      {/* Step 2: Parallel verification grid */}
      <div className={`rounded-2xl border p-5 transition-all ${
        step2Active ? "border-slate-200 bg-white" : "border-slate-100 bg-white opacity-40"
      }`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            step2Active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"
          }`}>
            2
          </div>
          <p className={`text-sm font-semibold ${step2Active ? "text-[#1c3461]" : "text-slate-400"}`}>
            Parallel verification
            {claimsDone > 0 && (
              <span className="ml-2 text-xs font-normal text-slate-500">{claimsDone} of {totalClaims} claims done</span>
            )}
          </p>
        </div>

        {/* Agent columns */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          {agentStates.map((a) => {
            const pct = a.total > 0 ? Math.round((a.done / a.total) * 100) : 0;
            const isRunning = a.running > 0;
            return (
              <div key={a.key} className="flex flex-col items-center gap-2">
                <div
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: a.total > 0 ? a.color : "#cbd5e1" }}
                >
                  {a.label}
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: a.color }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {a.total > 0 ? (isRunning ? <span style={{ color: a.color }}>●</span> : `${a.done}/${a.total}`) : "–"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Overall progress bar */}
        {step2Active && (
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>Overall</span>
              <span>{overallPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${overallPct}%`, backgroundColor: "#1c3461" }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Running phase: document with live agent cursor ───────────────────────────

function findInDoc(docText: string, article: string, regulation: string): { start: number; end: number } | null {
  const lower = docText.toLowerCase();
  if (article && regulation) {
    const full = `${regulation} ${article}`;
    const idx = lower.indexOf(full.toLowerCase());
    if (idx >= 0) return { start: idx, end: idx + full.length };
  }
  if (article) {
    const idx = lower.indexOf(article.toLowerCase());
    if (idx >= 0) return { start: idx, end: idx + article.length };
  }
  if (regulation) {
    const idx = lower.indexOf(regulation.toLowerCase());
    if (idx >= 0) return { start: idx, end: idx + regulation.length };
  }
  return null;
}

type RunSegState = "plain" | "active" | "done-good" | "done-warn" | "done-bad";
interface RunSeg { text: string; state: RunSegState }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRunSegs(docText: string, toolParts: any[]): RunSeg[] {
  // Completed claims with scores
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completed = toolParts
    .filter((p) => p.type === "tool-reportClaim" && p.state === "output-available" && p.output?.claim)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => ({ claim: p.output.claim, score: p.output.score as number }));

  // Active claims (sourcer or jurisdictionist in flight)
  const activeIds = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeClaims: any[] = [];
  toolParts
    .filter(
      (p) =>
        (p.type === "tool-runSourcer" || p.type === "tool-runJurisdictionist") &&
        p.state !== "output-available" &&
        p.state !== "output-error" &&
        p.input?.claim
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .forEach((p: any) => {
      const c = p.input.claim;
      const id = `${c.regulation}|${c.article}`;
      if (!activeIds.has(id)) { activeIds.add(id); activeClaims.push(c); }
    });

  type Span = { start: number; end: number; state: RunSegState };
  const spans: Span[] = [];

  for (const item of completed) {
    const pos = findInDoc(docText, item.claim.article ?? "", item.claim.regulation ?? "");
    if (pos) {
      const st: RunSegState = item.score >= 70 ? "done-good" : item.score >= 40 ? "done-warn" : "done-bad";
      spans.push({ ...pos, state: st });
    }
  }
  for (const claim of activeClaims) {
    const pos = findInDoc(docText, claim.article ?? "", claim.regulation ?? "");
    if (pos && !spans.some((s) => s.start === pos.start)) {
      spans.push({ ...pos, state: "active" });
    }
  }

  spans.sort((a, b) => a.start - b.start);
  const clean: Span[] = [];
  for (const sp of spans) {
    const prev = clean[clean.length - 1];
    if (!prev || sp.start >= prev.end) clean.push(sp);
  }

  const segs: RunSeg[] = [];
  let cur = 0;
  for (const sp of clean) {
    if (sp.start > cur) segs.push({ text: docText.slice(cur, sp.start), state: "plain" });
    segs.push({ text: docText.slice(sp.start, sp.end), state: sp.state });
    cur = sp.end;
  }
  if (cur < docText.length) segs.push({ text: docText.slice(cur), state: "plain" });
  return segs;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RunningDocPanel({ docText, toolParts }: { docText: string; toolParts: any[] }) {
  const segs = buildRunSegs(docText, toolParts);
  const hasActive = segs.some((s) => s.state === "active");

  return (
    <div className="flex-1 overflow-y-auto bg-white" style={{ padding: "48px 56px 72px" }}>
      <style>{`
        @keyframes activePulse {
          0%, 100% { background-color: #dbeafe; }
          50%       { background-color: #bfdbfe; }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.35; transform: scale(0.65); }
        }
      `}</style>

      {/* Scan bar while active */}
      {hasActive && (
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 10px", marginBottom: 24,
          background: "#eff6ff", border: "1px solid #bfdbfe",
          borderRadius: 8, fontSize: 12, color: "#1d4ed8",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            backgroundColor: "#3b82f6", display: "inline-block",
            animation: "dotPulse 1.2s ease-in-out infinite",
          }} />
          Agent cursor active — analysing highlighted citation
        </div>
      )}

      <div
        className="max-w-[680px] mx-auto text-[15px] leading-8 text-slate-800 whitespace-pre-wrap"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {segs.map((seg, i) => {
          if (seg.state === "plain") return <span key={i}>{seg.text}</span>;

          if (seg.state === "active") {
            return (
              <span
                key={i}
                style={{
                  borderRadius: 3,
                  padding: "1px 2px",
                  animation: "activePulse 1.4s ease-in-out infinite",
                  cursor: "default",
                  outline: "1.5px solid #93c5fd",
                }}
              >
                {seg.text}
              </span>
            );
          }

          const uc =
            seg.state === "done-good" ? "#22c55e"
            : seg.state === "done-warn" ? "#f59e0b"
            : "#ef4444";
          return (
            <span
              key={i}
              style={{
                textDecoration: "underline",
                textDecorationStyle: "wavy",
                textDecorationColor: uc,
                textDecorationThickness: "2px",
                padding: "0 1px",
              }}
            >
              {seg.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Done phase: document view ────────────────────────────────────────────────

function DocumentTab({ keptResults, docTitle }: { keptResults: ClaimResult[]; docTitle: string }) {
  const [exporting, setExporting] = useState(false);
  const overallScore = keptResults.length
    ? Math.round(keptResults.reduce((s, r) => s + r.score, 0) / keptResults.length)
    : 0;
  const verdict = overallScore >= 70 ? "Proceed" : overallScore >= 40 ? "Review Required" : "Do Not Send";
  const verdictColor = overallScore >= 70 ? "#047857" : overallScore >= 40 ? "#b45309" : "#b91c1c";

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/export-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keptResults, docTitle }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ratio-report.docx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function handleEmail() {
    const summary = keptResults.map((r, i) =>
      `Claim ${i + 1} (Score: ${r.score}/100)\n"${r.claim.text.slice(0, 150)}"\n` +
      `Citation: ${STATUS_VERDICTS[r.sourcer.status]?.label ?? r.sourcer.status}\n` +
      `Jurisdiction: ${STATUS_VERDICTS[r.jurisdictionist.status]?.label ?? r.jurisdictionist.status}`
    ).join("\n\n");
    const subject = encodeURIComponent(`RATIO Verification Report — ${new Date().toLocaleDateString("en-GB")}`);
    const body = encodeURIComponent(
      `RATIO VERIFICATION REPORT\n${"─".repeat(40)}\n` +
      `Date: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}\n` +
      `Overall assessment: ${verdict} (${overallScore}/100)\n` +
      `Claims reviewed: ${keptResults.length}\n\n${"─".repeat(40)}\n\n${summary}\n\n` +
      `Generated by RATIO — AI Legal Reasoning Auditor`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#1c3461" }}
          >
            {exporting ? <Spinner /> : null}
            {exporting ? "Exporting…" : "Download Report (.docx)"}
          </button>
          <button
            onClick={handleEmail}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all"
          >
            ✉ Send by Email
          </button>
          <div className="flex-1" />
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Overall Assessment</p>
            <p className="text-lg font-bold" style={{ color: verdictColor }}>
              {verdict} <span className="text-sm font-normal text-slate-400">({overallScore}/100)</span>
            </p>
          </div>
        </div>

        {/* Report */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-7 py-5 border-b border-slate-100 bg-slate-50">
            <h2 className="text-base font-bold text-slate-900">{docTitle || "RATIO Verification Report"}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              {" · "}{keptResults.length} claim{keptResults.length !== 1 ? "s" : ""} reviewed and kept
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {keptResults.map((result, i) => {
              const score = result.score;
              const scoreColor = score >= 70 ? "#047857" : score >= 40 ? "#b45309" : "#b91c1c";
              return (
                <div key={i} className="px-7 py-5 space-y-4">
                  <div className="flex items-start gap-4">
                    <div
                      className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: scoreColor + "18", color: scoreColor, border: `2px solid ${scoreColor}40` }}
                    >
                      {score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Claim {i + 1} · {result.claim.regulation} {result.claim.article}
                      </p>
                      <blockquote className="text-sm text-slate-700 italic leading-relaxed">
                        "{result.claim.text}"
                      </blockquote>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-16">
                    {[
                      { label: "Citation", verdict: result.sourcer.status, detail: result.sourcer.discrepancy ?? result.sourcer.verbatim_quote },
                      { label: "Jurisdiction", verdict: result.jurisdictionist.status, detail: `${result.jurisdictionist.confidence}% confidence — ${result.jurisdictionist.reason}` },
                      { label: "Currency of law", verdict: result.historian.status, detail: result.historian.note },
                      { label: "Counter-arguments", verdict: result.devils_advocate.strength, detail: `${result.devils_advocate.counter_authority}` },
                      { label: "Conflict check", verdict: result.firm_memory.status, detail: result.firm_memory.reference ? `${result.firm_memory.reference.matter} (${result.firm_memory.reference.date})` : undefined },
                    ].map((f) => (
                      <div key={f.label} className="flex items-start gap-2">
                        <span className="text-xs text-slate-400 pt-0.5 shrink-0 w-28">{f.label}</span>
                        <StatusDot verdict={f.verdict} />
                      </div>
                    ))}
                  </div>

                  {result.orchestrator_reasoning && (
                    <p className="text-xs text-slate-500 italic leading-relaxed pl-16 border-l-2 border-slate-200 ml-16">
                      {result.orchestrator_reasoning}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-center text-slate-400 pb-4">
          This report was produced by RATIO — an AI legal reasoning auditor. It does not constitute legal advice.
          All findings should be reviewed by a qualified solicitor.
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("mode-select");
  const [mode, setMode] = useState<Mode | null>(null);
  const [docText, setDocText] = useState("");
  const [entity, setEntity] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [citationLoading, setCitationLoading] = useState(false);
  const [exportingCitations, setExportingCitations] = useState(false);
  const [citations, setCitations] = useState<GeneratedCitation[]>([]);
  const [enrichedDoc, setEnrichedDoc] = useState("");
  const [keptResults, setKeptResults] = useState<ClaimResult[]>([]);
  const [doneTab, setDoneTab] = useState<"document" | "simulation">("document");
  const [rightTab, setRightTab] = useState<"story" | "graph">("story");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, setMessages, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/audit" }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (err) => console.error("Chat error:", err),
  });

  const isRunning = status === "streaming" || status === "submitted";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allParts: any[] = messages.filter((m) => m.role === "assistant").flatMap((m) => m.parts ?? []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolParts: any[] = allParts.filter((p) => (p.type as string).startsWith("tool-"));

  const claimResults: ClaimResult[] = toolParts
    .filter((p) => p.type === "tool-reportClaim" && p.state === "output-available")
    .map((p) => p.output as ClaimResult);

  // Auto-transition: running → review when audit completes
  useEffect(() => {
    if (phase === "running" && !isRunning && claimResults.length > 0) {
      setPhase("review");
    }
  }, [phase, isRunning, claimResults.length]);

  // ── File upload ──────────────────────────────────────────────────────────────

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadFile(file);
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadError("");
    setCitations([]);
    setEnrichedDoc("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract-text", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) {
        setUploadError(data.error);
      } else {
        setDocText(data.text ?? "");
      }
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // ── Citation generation ──────────────────────────────────────────────────────

  async function generateCitations() {
    if (!docText.trim() || citationLoading) return;
    setCitationLoading(true);
    setCitations([]);
    setEnrichedDoc("");
    try {
      const res = await fetch("/api/generate-citations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText: docText }),
      });
      const data = await res.json();
      setCitations(data.citations ?? []);
      setEnrichedDoc(data.enriched_document ?? docText);
    } catch (e) {
      console.error(e);
    } finally {
      setCitationLoading(false);
    }
  }

  // ── Export citations as .docx ────────────────────────────────────────────────

  async function exportCitationsDocx() {
    if (exportingCitations) return;
    setExportingCitations(true);
    try {
      const res = await fetch("/api/export-citations-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citations, enrichedDoc, docTitle: "RATIO Source Discovery Report" }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ratio-sources.docx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingCitations(false);
    }
  }

  // ── Email citations ───────────────────────────────────────────────────────────

  function emailCitations() {
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const lines = citations.map((c, i) => {
      const typeLabel: Record<string, string> = { legislation: "Legislation", case_law: "Case Law", practitioners_guide: "Practice Guide", academic: "Academic" };
      return `${i + 1}. ${typeLabel[c.type] ?? c.type}: ${c.title}\n   Ref: ${c.reference}\n   ${c.relevance}`;
    });
    const subject = encodeURIComponent(`RATIO Source Discovery Report — ${dateStr}`);
    const body = encodeURIComponent(
      `RATIO SOURCE DISCOVERY REPORT\n${"─".repeat(40)}\n` +
      `Date: ${dateStr}\n` +
      `Sources found: ${citations.length}\n\n${"─".repeat(40)}\n\n` +
      lines.join("\n\n") +
      `\n\n${"─".repeat(40)}\nGenerated by RATIO — Legal Reasoning Auditor\nNot legal advice.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }

  // ── Start audit ──────────────────────────────────────────────────────────────

  function startAudit(textOverride?: string) {
    const text = textOverride ?? docText;
    if (!text.trim() || isRunning) return;
    setMessages([]); // clear previous run's tool parts
    setPhase("running");
    setRightTab("story");
    sendMessage({
      text: `Audit this legal document.\nENTITY: ${entity || "Entity not specified"}\n\nDOCUMENT:\n${text}`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Mode select ──────────────────────────────────────────────────────────────

  if (phase === "mode-select") {
    return (
      <LandingPage
        onVerify={() => { setMode("verify"); setPhase("setup"); }}
        onFind={() => { setMode("generate"); setPhase("setup"); }}
      />
    );
  }

  // ── Setup ─────────────────────────────────────────────────────────────────────

  if (phase === "setup") {
    const isGenerate = mode === "generate";
    const hasCitations = citations.length > 0;
    const canProceed = docText.trim().length > 20;

    // ── Citation results — full-page two-column layout ──────────────────────────
    if (hasCitations) {
      return (
        <main className="h-screen flex flex-col bg-white">
          <header style={{
            borderBottom: "1px solid #e0dbd4",
            padding: "0 24px", height: 56,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#ffffff", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button
                onClick={() => { setCitations([]); setEnrichedDoc(""); }}
                style={{ fontSize: 12, color: "#9ca3af", cursor: "pointer", background: "none", border: "none" }}
              >
                ← Back
              </button>
              <span style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 800, letterSpacing: "0.08em", color: "#0d0d0d" }}>
                RATIO
              </span>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>·</span>
              <span style={{ fontSize: 13, color: "#555" }}>{citations.length} sources found</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={emailCitations}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 6, cursor: "pointer",
                  background: "transparent",
                  border: "1px solid #ddd9d1",
                  fontSize: 12, fontWeight: 600, color: "#555",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f2efe8")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                ✉ Send by email
              </button>
              <button
                onClick={exportCitationsDocx}
                disabled={exportingCitations}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 6, cursor: exportingCitations ? "not-allowed" : "pointer",
                  background: "transparent",
                  border: "1px solid #ddd9d1",
                  fontSize: 12, fontWeight: 600, color: "#555",
                  opacity: exportingCitations ? 0.5 : 1,
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (!exportingCitations) e.currentTarget.style.background = "#f2efe8"; }}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {exportingCitations ? "Exporting…" : "↓ Download .docx"}
              </button>
              <button
                onClick={() => startAudit(enrichedDoc || docText)}
                style={{
                  padding: "7px 18px", borderRadius: 6, cursor: "pointer",
                  background: "#0d1f3c", color: "#fff",
                  border: "none", fontSize: 12, fontWeight: 700,
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                Verify all sources →
              </button>
            </div>
          </header>

          <div className="flex flex-1 min-h-0">
            {/* Citation list */}
            <div className="flex-1 overflow-y-auto px-12 py-6">
              <div className="max-w-2xl mx-auto">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">
                  Sources
                </p>
                {citations.map((c, i) => <CitationRow key={i} cit={c} index={i} />)}
              </div>
            </div>

            {/* Document preview */}
            {enrichedDoc && (
              <div className="w-96 shrink-0 border-l border-slate-100 overflow-y-auto bg-slate-50/50">
                <div className="px-6 py-6">
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-4">
                    Document with citations
                  </p>
                  <div
                    className="text-[12px] text-slate-600 leading-relaxed whitespace-pre-wrap"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {enrichedDoc}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      );
    }

    return (
      <main style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f2efe8" }}>
        <style>{`
          .setup-upload:hover { border-color: #0d1f3c !important; background: #faf9f6 !important; }
          .setup-input:focus { outline: none; border-color: #0d1f3c !important; box-shadow: 0 0 0 3px rgba(13,31,60,0.08) !important; }
          .setup-cta:hover:not(:disabled) { background: #1a3560 !important; transform: translateY(-1px); }
          .setup-cta { transition: background 0.15s, transform 0.15s; }
        `}</style>

        {/* Minimal top nav */}
        <nav style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 32px", height: 52,
          background: "#ffffff",
          borderBottom: "1px solid #e0dbd4",
          flexShrink: 0,
        }}>
          <button
            onClick={() => { setPhase("mode-select"); setCitations([]); setEnrichedDoc(""); setDocText(""); }}
            style={{ fontSize: 12, color: "#999", cursor: "pointer", background: "none", border: "none", display: "flex", alignItems: "center", gap: 4 }}
          >
            ← Back
          </button>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 800, letterSpacing: "0.08em", color: "#0d0d0d" }}>
            RATIO
          </span>
          <div style={{ width: 60 }} />
        </nav>

        {/* Split-panel body */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

          {/* ── Left: briefing panel ─────────────────────────────────────────── */}
          <div style={{
            width: 320, flexShrink: 0,
            background: "#0d1f3c",
            padding: "36px 28px",
            display: "flex", flexDirection: "column",
            overflowY: "auto",
          }}>
            <p style={{
              fontSize: 9, fontWeight: 700, color: "#334155",
              letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16,
            }}>
              {isGenerate ? "Source Discovery + Audit" : "Legal Audit"}
            </p>
            <h2 style={{
              fontFamily: "Georgia, serif",
              fontSize: 20, fontWeight: 700, color: "#f0f4f8",
              lineHeight: 1.25, marginBottom: 10,
            }}>
              {isGenerate
                ? "Find and verify every citation"
                : "Audit every claim in your document"}
            </h2>
            <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.65, marginBottom: 32 }}>
              {isGenerate
                ? "RATIO searches EUR-Lex, BAILII, and legislation.gov.uk for relevant sources — then runs all five agents to verify each one."
                : "Five adversarial specialists will examine every legal claim in your document simultaneously."}
            </p>

            {/* Agent list */}
            <div style={{ flex: 1 }}>
              {[
                { num: "I",   name: "Citation Sourcer",   desc: "Verifies article text verbatim against EUR-Lex and legislation.gov.uk" },
                { num: "II",  name: "Jurisdictionist",    desc: "Checks applicability post-Brexit for your specific entity and jurisdiction" },
                { num: "III", name: "Legal Historian",    desc: "Traces amendment history — catches stale article numbers" },
                { num: "IV",  name: "Devil's Advocate",   desc: "Surfaces the counter-authority opposing counsel will raise" },
                { num: "V",   name: "Firm Memory",        desc: "Flags contradictions with prior firm opinions and advice" },
              ].map((a, i) => (
                <div key={a.num} style={{
                  padding: "13px 0",
                  borderBottom: i < 4 ? "1px solid #1a2e4a" : "none",
                  display: "flex", gap: 14, alignItems: "flex-start",
                }}>
                  <span style={{
                    fontFamily: "Georgia, serif",
                    fontSize: 10, fontWeight: 700, color: "#334155",
                    width: 18, flexShrink: 0, paddingTop: 1,
                  }}>{a.num}</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 2 }}>{a.name}</p>
                    <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ paddingTop: 20, borderTop: "1px solid #1a2e4a" }}>
              <p style={{ fontSize: 10, color: "#334155", letterSpacing: "0.04em" }}>
                ~3 minutes · citation by citation
              </p>
            </div>
          </div>

          {/* ── Right: form panel ────────────────────────────────────────────── */}
          <div style={{
            flex: 1, overflowY: "auto",
            background: "#f2efe8",
            display: "flex", justifyContent: "center",
            padding: "44px 40px",
          }}>
            <div style={{ width: "100%", maxWidth: 500 }}>

              {/* Upload zone */}
              <div
                className="setup-upload"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "1.5px dashed #c8c4bb",
                  borderRadius: 10,
                  padding: "28px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: "#ffffff",
                  transition: "border-color 0.15s, background 0.15s",
                  marginBottom: 16,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf,.docx,.doc"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {uploading ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "#0d1f3c" }}>
                    <Spinner />
                    <p style={{ fontSize: 13, fontWeight: 500 }}>Reading your document…</p>
                  </div>
                ) : (
                  <>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background: "#f2efe8", border: "1px solid #e0dbd4",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 12px", fontSize: 16,
                    }}>
                      ↑
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0d0d0d", marginBottom: 4 }}>
                      Drop your document, or click to browse
                    </p>
                    <p style={{ fontSize: 11, color: "#9ca3af" }}>PDF, Word (.docx) or plain text (.txt)</p>
                  </>
                )}
              </div>

              {uploadError && (
                <p style={{ fontSize: 12, color: "#991b1b", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", marginBottom: 16 }}>
                  {uploadError}
                </p>
              )}

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: "#ddd9d1" }} />
                <span style={{ fontSize: 11, color: "#9ca3af" }}>or paste below</span>
                <div style={{ flex: 1, height: 1, background: "#ddd9d1" }} />
              </div>

              {/* Text area */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#555", letterSpacing: "0.04em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                  Document text
                </label>
                <textarea
                  className="setup-input"
                  style={{
                    width: "100%", background: "#ffffff",
                    border: "1px solid #ddd9d1", borderRadius: 8,
                    padding: "12px 14px", fontSize: 13, color: "#0d0d0d",
                    height: 180, resize: "none", lineHeight: 1.65,
                    fontFamily: "Georgia, serif",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  value={docText}
                  onChange={(e) => { setDocText(e.target.value); setCitations([]); setEnrichedDoc(""); }}
                  placeholder={isGenerate
                    ? "Paste your document text here…"
                    : "Paste the legal document or memo here…"}
                />
                {docText.length > 0 && (
                  <p style={{ fontSize: 10, color: "#9ca3af", textAlign: "right", marginTop: 4 }}>
                    {docText.length.toLocaleString()} characters
                  </p>
                )}
              </div>

              {/* Client description */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#555", letterSpacing: "0.04em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                  Client context
                  <span style={{ fontSize: 10, fontWeight: 400, color: "#9ca3af", textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>
                    used for jurisdiction analysis
                  </span>
                </label>
                <input
                  className="setup-input"
                  style={{
                    width: "100%", background: "#ffffff",
                    border: "1px solid #ddd9d1", borderRadius: 8,
                    padding: "11px 14px", fontSize: 13, color: "#0d0d0d",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                  placeholder="e.g. UK-based fintech firm, no EU establishment"
                />
              </div>

              {isGenerate && (
                <button
                  className="setup-cta"
                  onClick={generateCitations}
                  disabled={!canProceed || citationLoading}
                  style={{
                    width: "100%", padding: "13px 0",
                    background: "#0d1f3c", color: "#fff",
                    border: "none", borderRadius: 8,
                    fontSize: 13, fontWeight: 700,
                    cursor: canProceed && !citationLoading ? "pointer" : "not-allowed",
                    opacity: canProceed && !citationLoading ? 1 : 0.4,
                    letterSpacing: "0.02em",
                  }}
                >
                  {citationLoading
                    ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Spinner /> Searching for sources…</span>
                    : "Find Sources →"}
                </button>
              )}

              {!isGenerate && (
                <button
                  className="setup-cta"
                  onClick={() => startAudit()}
                  disabled={!canProceed}
                  style={{
                    width: "100%", padding: "13px 0",
                    background: "#0d1f3c", color: "#fff",
                    border: "none", borderRadius: 8,
                    fontSize: 13, fontWeight: 700,
                    cursor: canProceed ? "pointer" : "not-allowed",
                    opacity: canProceed ? 1 : 0.4,
                    letterSpacing: "0.02em",
                  }}
                >
                  Begin Audit →
                </button>
              )}

            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Running ───────────────────────────────────────────────────────────────────

  if (phase === "running") {
    const reportDone = toolParts.filter((p) => p.type === "tool-reportClaim" && p.state === "output-available").length;
    const extractCount = (() => {
      const ep = toolParts.find((p) => p.type === "tool-extractClaims" && p.state === "output-available");
      return ep ? (ep.output?.count ?? ep.output?.length ?? null) : null;
    })();

    return (
      <main className="h-screen flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 800, letterSpacing: "0.08em", color: "#0d0d0d" }}>RATIO</span>
            {entity && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-sm text-slate-500 truncate max-w-xs">{entity}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Progress summary */}
            {extractCount !== null && (
              <span className="text-xs text-slate-400 font-mono">
                {reportDone} / {extractCount} claims
              </span>
            )}
            {/* Live dot */}
            {isRunning && (
              <span className="flex items-center gap-1.5 text-xs text-blue-500 font-medium">
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  backgroundColor: "#3b82f6", display: "inline-block",
                  animation: "dotPulse 1.2s ease-in-out infinite",
                }} />
                Live
              </span>
            )}
            {!isRunning && claimResults.length > 0 && (
              <span className="text-xs text-green-600 font-medium">✓ Complete — moving to review…</span>
            )}
            {isRunning && (
              <button
                onClick={() => stop()}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Stop
              </button>
            )}
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0">
          {/* Left: full document with cursor */}
          <RunningDocPanel docText={docText} toolParts={toolParts} />

          {/* Right: story + graph */}
          <div
            style={{ width: 460, borderLeft: "1px solid #e8ecf0", background: "#f8fafc", display: "flex", flexDirection: "column" }}
            className="shrink-0"
          >
            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-white shrink-0">
              {(["story", "graph"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setRightTab(t)}
                  className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors relative ${
                    rightTab === t ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {t === "story" ? "Audit Story" : "Agent Graph"}
                  {rightTab === t && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: "#1c3461" }} />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {rightTab === "story" && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <AuditStory toolParts={toolParts} />
              </div>
            )}
            {rightTab === "graph" && (
              <div className="flex-1 overflow-hidden flex items-center justify-center bg-[#040408]">
                <AgentGraph toolParts={toolParts} />
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ── Review ────────────────────────────────────────────────────────────────────

  if (phase === "review") {
    return (
      <main className="min-h-screen flex flex-col" style={{ backgroundColor: "#f7f6f3" }}>
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 800, letterSpacing: "0.08em", color: "#0d0d0d" }}>RATIO</span>
            <span className="text-sm text-slate-400">Review findings</span>
          </div>
          <p className="text-sm text-slate-500">
            {claimResults.length} claim{claimResults.length !== 1 ? "s" : ""} to review
          </p>
        </header>
        <div className="flex-1 flex min-h-0" style={{ height: "calc(100vh - 65px)" }}>
          <VerificationStepper
            claimResults={claimResults}
            docText={docText}
            onComplete={(kept) => { setKeptResults(kept); setPhase("done"); }}
          />
        </div>
      </main>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex flex-col" style={{ backgroundColor: "#f7f6f3" }}>
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold" style={{ color: "#1c3461" }}>RATIO</span>
          <span className="text-sm text-slate-400">Verification complete</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">
            {keptResults.length} of {claimResults.length} claims kept
          </span>
          <button
            onClick={() => { setPhase("mode-select"); setKeptResults([]); }}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            New Audit
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-1 shrink-0">
        {(["document", "simulation"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setDoneTab(t)}
            className={`px-5 py-3 text-sm font-medium transition-colors relative ${
              doneTab === t ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t === "document" ? "Verification Report" : "Persona Stress Test"}
            {doneTab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: "#1c3461" }} />}
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0">
        {doneTab === "document" && keptResults.length > 0 && (
          <DocumentTab keptResults={keptResults} docTitle="RATIO Verification Report" />
        )}
        {doneTab === "document" && keptResults.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <p>No claims were kept. Try running the verification again.</p>
          </div>
        )}
        {doneTab === "simulation" && (
          <div className="flex-1 overflow-hidden">
            <PersonaStressTestPanel claimResults={keptResults.length > 0 ? keptResults : claimResults} />
          </div>
        )}
      </div>
    </main>
  );
}
