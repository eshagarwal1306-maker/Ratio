"use client";

import { useEffect, useRef } from "react";

// ── Agent config ─────────────────────────────────────────────────────────────

const AGENTS: Record<string, { label: string; color: string; icon: string; quote: string }> = {
  runSourcer:         { label: "Citation Sourcer",  color: "#00d98b", icon: "⊕", quote: "I don't trust what I can't verify word for word. Give me the primary source or I'll find it myself." },
  runJurisdictionist: { label: "Jurisdictionist",   color: "#9f7aea", icon: "◉", quote: "Article 2 is not a formality. It defines who legally exists inside a regulation. Brexit changed everything." },
  runHistorian:       { label: "Legal Historian",   color: "#f5a623", icon: "⊗", quote: "History doesn't lie. That provision was repealed in December. The AI learned from the draft." },
  runDevilsAdvocate:  { label: "Devil's Advocate",  color: "#ff6b6b", icon: "⊘", quote: "Let me find four reasons this is wrong. Actually — I found six. You're welcome." },
  runFirmMemory:      { label: "Firm Memory",       color: "#00d9d9", icon: "⊙", quote: "We told Barclays exactly the opposite in Q3. This memo would contradict our own prior advisory." },
  deepResearch:       { label: "Deep Research",     color: "#8b5cf6", icon: "⊛", quote: "When training data isn't enough, I go live — scraping Bailii and regulatory sources for real precedents." },
};

// ── Badge config ─────────────────────────────────────────────────────────────

const BADGE: Record<string, { bg: string; text: string; label: string }> = {
  CITED:               { bg: "#dcfce7", text: "#15803d", label: "CITED" },
  INFERRED:            { bg: "#fef3c7", text: "#92400e", label: "INFERRED" },
  NOT_FOUND:           { bg: "#fee2e2", text: "#b91c1c", label: "NOT FOUND" },
  APPLICABLE:          { bg: "#dcfce7", text: "#15803d", label: "APPLICABLE" },
  WRONG_JURISDICTION:  { bg: "#fee2e2", text: "#b91c1c", label: "WRONG JURISDICTION" },
  UNCLEAR:             { bg: "#fef3c7", text: "#92400e", label: "UNCLEAR" },
  CURRENT:             { bg: "#dcfce7", text: "#15803d", label: "CURRENT" },
  AMENDED:             { bg: "#fef3c7", text: "#92400e", label: "AMENDED" },
  UNKNOWN:             { bg: "#f1f5f9", text: "#64748b", label: "UNKNOWN" },
  NO_CONFLICT:         { bg: "#dcfce7", text: "#15803d", label: "NO CONFLICT" },
  CONTRADICTION_FOUND: { bg: "#fee2e2", text: "#b91c1c", label: "CONTRADICTION" },
  HIGH:                { bg: "#fee2e2", text: "#b91c1c", label: "HIGH RISK" },
  MEDIUM:              { bg: "#fef3c7", text: "#92400e", label: "MEDIUM RISK" },
  LOW:                 { bg: "#dcfce7", text: "#15803d", label: "LOW RISK" },
};

function getBadgeKey(toolName: string, output: unknown): string | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  if (toolName === "runSourcer") return (o.status as string) ?? null;
  if (toolName === "runJurisdictionist") return (o.status as string) ?? null;
  if (toolName === "runHistorian") return (o.status as string) ?? null;
  if (toolName === "runDevilsAdvocate") {
    const s = (o.strength as string | undefined)?.toUpperCase();
    return s ?? null;
  }
  if (toolName === "runFirmMemory")
    return o.status === "CONTRADICTION_FOUND" ? "CONTRADICTION_FOUND" : "NO_CONFLICT";
  return null;
}

function getResultText(toolName: string, output: unknown): string {
  if (!output || typeof output !== "object") return "";
  const o = output as Record<string, unknown>;

  if (toolName === "runSourcer") {
    if (o.status === "CITED") {
      const q = o.verbatim_quote as string | undefined;
      return `Source verified.${q ? ' "' + q.slice(0, 100) + (q.length > 100 ? "…" : "") + '"' : ""}`;
    }
    if (o.status === "NOT_FOUND") return `Source not found. ${(o.discrepancy as string) ?? ""}`;
    return "Citation paraphrased — treating as inferred.";
  }

  if (toolName === "runJurisdictionist") {
    const conf = o.confidence as number | undefined;
    const reason = ((o.reason as string | undefined) ?? "").slice(0, 150);
    if (o.status === "WRONG_JURISDICTION")
      return `Wrong jurisdiction${conf ? ` (${conf}% confidence)` : ""}. ${reason}`;
    if (o.status === "UNCLEAR") return "Jurisdiction unclear. Analysis inconclusive.";
    return `Jurisdiction confirmed${conf ? ` (${conf}% confidence)` : ""}. ${reason}`;
  }

  if (toolName === "runHistorian") {
    const note = (o.note as string) ?? "";
    if (o.status === "CURRENT") return `Law is current. ${note}`;
    if (o.status === "AMENDED") return `Law has been amended. ${note}`;
    return note;
  }

  if (toolName === "runDevilsAdvocate") {
    const auth = (o.counter_authority as string) ?? "";
    const why = ((o.why_it_undermines as string) ?? "").slice(0, 130);
    return `${auth}: ${why}`;
  }

  if (toolName === "runFirmMemory") {
    if (o.status === "CONTRADICTION_FOUND") {
      const ref = o.reference as Record<string, string> | undefined;
      return `Contradiction found: ${ref?.matter ?? "prior advice on file"}`;
    }
    return "No conflicts with prior advice found.";
  }

  if (toolName === "deepResearch") {
    return typeof o === "string" ? (o as string).slice(0, 200) : "Research complete.";
  }

  return "";
}

// ── Card ─────────────────────────────────────────────────────────────────────

interface Card {
  id: string;
  toolName: string;
  input: unknown;
  output: unknown;
  state: string;
}

function AuditCard({ card }: { card: Card }) {
  const ag = AGENTS[card.toolName];
  if (!ag) return null;

  const isDone = card.state === "output-available";
  const isError = card.state === "output-error";
  const isActive = !isDone && !isError;

  const badgeKey = isDone ? getBadgeKey(card.toolName, card.output) : null;
  const badge = badgeKey ? BADGE[badgeKey] : null;
  const resultText = isDone ? getResultText(card.toolName, card.output) : null;

  const input = card.input as Record<string, unknown> | null;
  const claim = input?.claim as Record<string, string> | undefined;
  const claimLabel = claim ? (claim.article || claim.regulation || "") : "";

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e8ecf0",
        borderLeft: `3px solid ${ag.color}`,
        borderRadius: "0 10px 10px 0",
        padding: "12px 14px",
        marginBottom: 10,
        boxShadow: isActive ? `0 2px 16px ${ag.color}22` : "0 1px 4px rgba(0,0,0,0.05)",
        transition: "box-shadow 0.4s",
        animation: "storySlide 0.35s ease both",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 7 }}>
        <div
          style={{
            width: 20, height: 20, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, flexShrink: 0,
            backgroundColor: ag.color + "18", color: ag.color,
            border: `1.5px solid ${ag.color}40`,
          }}
        >
          {ag.icon}
        </div>

        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{ag.label}</span>

        {claimLabel && (
          <span style={{
            fontSize: 10, color: "#94a3b8", fontFamily: "monospace",
            background: "#f1f5f9", borderRadius: 4, padding: "1px 5px",
          }}>
            {claimLabel}
          </span>
        )}

        <span style={{
          fontSize: 10, color: "#94a3b8", padding: "1px 6px",
          background: "#f8fafc", borderRadius: 4, border: "1px solid #e2e8f0",
        }}>
          Sonnet 4.6
        </span>

        {isActive && (
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: ag.color, fontWeight: 600 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              backgroundColor: ag.color, display: "inline-block",
              animation: "dotPulse 1.2s ease-in-out infinite",
            }} />
            Analysing
          </span>
        )}

        {badge && (
          <span style={{
            marginLeft: isActive ? 0 : "auto",
            fontSize: 10, fontWeight: 700,
            padding: "2px 9px", borderRadius: 99,
            backgroundColor: badge.bg, color: badge.text, letterSpacing: "0.03em",
          }}>
            {badge.label}
          </span>
        )}
      </div>

      {/* Quote */}
      <p style={{
        fontSize: 11, color: "#94a3b8", fontStyle: "italic",
        lineHeight: 1.55, margin: "0 0 8px",
        paddingLeft: 6, borderLeft: "2px solid #f1f5f9",
      }}>
        &ldquo;{ag.quote}&rdquo;
      </p>

      {/* Result */}
      {resultText && (
        <p style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6, margin: 0 }}>
          {resultText}
        </p>
      )}
    </div>
  );
}

// ── AuditStory ────────────────────────────────────────────────────────────────

interface AuditStoryProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolParts: any[];
}

export function AuditStory({ toolParts }: AuditStoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [toolParts.length]);

  // Summary card from extractClaims
  const extractPart = toolParts.find(
    (p) => p.type === "tool-extractClaims" && p.state === "output-available"
  );
  const claimCount: number | null =
    extractPart?.output?.count ?? extractPart?.output?.length ?? null;

  // Build story cards (agent tools only)
  const agentKeys = new Set(Object.keys(AGENTS));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cards: Card[] = (toolParts as any[]).reduce((acc: Card[], p, i: number) => {
    const name = (p.type as string).replace("tool-", "");
    if (agentKeys.has(name)) {
      acc.push({ id: `${p.type}-${i}`, toolName: name, input: p.input, output: p.output, state: p.state });
    }
    return acc;
  }, []);

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "16px 16px 32px" }}>
      <style>{`
        @keyframes storySlide {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.35; transform: scale(0.65); }
        }
      `}</style>

      {/* Extract claims summary card */}
      {claimCount !== null && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", background: "#f8fafc",
          border: "1px solid #e2e8f0", borderLeft: "3px solid #1c3461",
          borderRadius: "0 10px 10px 0", marginBottom: 12,
          animation: "storySlide 0.35s ease both",
        }}>
          <span style={{ color: "#1c3461", fontSize: 15 }}>◆</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
            {claimCount} legal claims extracted from document
          </span>
        </div>
      )}

      {/* Agent cards */}
      {cards.map((card) => <AuditCard key={card.id} card={card} />)}

      {/* Empty state */}
      {cards.length === 0 && claimCount === null && (
        <div style={{ textAlign: "center", padding: "56px 20px", color: "#94a3b8" }}>
          <div style={{ fontSize: 30, marginBottom: 12 }}>⚖</div>
          <p style={{ fontSize: 13 }}>Agents are starting up…</p>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
