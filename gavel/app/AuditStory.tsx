"use client";

import { useEffect, useRef, useState } from "react";

// ── Agent config ──────────────────────────────────────────────────────────────

const AGENTS: Record<string, { label: string; color: string; icon: string; shortLabel: string }> = {
  runSourcer:         { label: "Citation Sourcer",  color: "#00d98b", icon: "⊕", shortLabel: "SOURCE" },
  runJurisdictionist: { label: "Jurisdictionist",   color: "#9f7aea", icon: "◉", shortLabel: "JURISD" },
  runHistorian:       { label: "Legal Historian",   color: "#f5a623", icon: "⊗", shortLabel: "HIST"   },
  runDevilsAdvocate:  { label: "Devil's Advocate",  color: "#ff6b6b", icon: "⊘", shortLabel: "DEVIL"  },
  runFirmMemory:      { label: "Firm Memory",       color: "#00d9d9", icon: "⊙", shortLabel: "MEMORY" },
};

const AGENT_ORDER = ["runSourcer", "runJurisdictionist", "runHistorian", "runDevilsAdvocate", "runFirmMemory"];

const BADGE: Record<string, { bg: string; text: string; label: string }> = {
  CITED:               { bg: "#dcfce7", text: "#15803d", label: "CITED" },
  INFERRED:            { bg: "#fef3c7", text: "#92400e", label: "INFERRED" },
  NOT_FOUND:           { bg: "#fee2e2", text: "#b91c1c", label: "NOT FOUND" },
  APPLICABLE:          { bg: "#dcfce7", text: "#15803d", label: "APPLICABLE" },
  WRONG_JURISDICTION:  { bg: "#fee2e2", text: "#b91c1c", label: "WRONG JURISD." },
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

// ── Data extraction ───────────────────────────────────────────────────────────

interface AgentResult {
  toolName: string;
  state: "active" | "done" | "error";
  badgeKey: string | null;
  detail: string;
}

interface ClaimGroup {
  claimKey: string;
  regulation: string;
  article: string;
  text: string;
  score: number | null;
  isComplete: boolean;
  agents: Record<string, AgentResult>;
}

function getBadgeKey(toolName: string, output: Record<string, unknown>): string | null {
  if (toolName === "runSourcer") return output.status as string ?? null;
  if (toolName === "runJurisdictionist") return output.status as string ?? null;
  if (toolName === "runHistorian") return output.status as string ?? null;
  if (toolName === "runDevilsAdvocate") return ((output.strength as string) ?? "").toUpperCase() || null;
  if (toolName === "runFirmMemory") return output.status === "CONTRADICTION_FOUND" ? "CONTRADICTION_FOUND" : "NO_CONFLICT";
  return null;
}

function getDetail(toolName: string, output: Record<string, unknown>): string {
  if (toolName === "runSourcer") {
    if (output.status === "CITED") {
      const q = output.verbatim_quote as string | undefined;
      return q ? `"${q.slice(0, 120)}${q.length > 120 ? "…" : ""}"` : "Verified against primary source text.";
    }
    if (output.status === "NOT_FOUND") return (output.discrepancy as string) ?? "Citation could not be located.";
    return "Citation appears paraphrased — not verbatim.";
  }
  if (toolName === "runJurisdictionist") {
    const conf = output.confidence as number | undefined;
    const reason = ((output.reason as string) ?? "").slice(0, 180);
    return `${conf ? `${conf}% confidence. ` : ""}${reason}`;
  }
  if (toolName === "runHistorian") {
    return ((output.note as string) ?? "").slice(0, 180);
  }
  if (toolName === "runDevilsAdvocate") {
    const auth = output.counter_authority as string ?? "";
    const why = ((output.why_it_undermines as string) ?? "").slice(0, 150);
    return auth ? `${auth}: ${why}` : why;
  }
  if (toolName === "runFirmMemory") {
    if (output.status === "CONTRADICTION_FOUND") {
      const ref = output.reference as Record<string, string> | undefined;
      return ref ? `Conflict with: ${ref.matter} (${ref.date})` : "Contradiction found with prior advice.";
    }
    return "No conflicts with prior firm advice.";
  }
  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildClaimGroups(toolParts: any[]): ClaimGroup[] {
  const groups = new Map<string, ClaimGroup>();

  for (const p of toolParts) {
    const toolName = (p.type as string).replace("tool-", "");

    if (toolName === "reportClaim" && p.output?.claim) {
      const c = p.output.claim;
      const key = `${c.regulation}||${c.article}`;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          claimKey: key,
          regulation: c.regulation ?? "",
          article: c.article ?? "",
          text: c.text ?? "",
          score: p.state === "output-available" ? (p.output.score as number) : null,
          isComplete: p.state === "output-available",
          agents: {},
        });
      } else if (p.state === "output-available") {
        existing.score = p.output.score as number;
        existing.isComplete = true;
      }
      continue;
    }

    if (!AGENTS[toolName]) continue;
    const input = p.input as Record<string, unknown> | null;
    const claim = input?.claim as Record<string, string> | undefined;
    if (!claim) continue;

    const key = `${claim.regulation}||${claim.article}`;
    if (!groups.has(key)) {
      groups.set(key, {
        claimKey: key,
        regulation: claim.regulation ?? "",
        article: claim.article ?? "",
        text: claim.text ?? "",
        score: null,
        isComplete: false,
        agents: {},
      });
    }

    const group = groups.get(key)!;
    const isDone = p.state === "output-available";
    const isError = p.state === "output-error";
    const output = isDone ? (p.output as Record<string, unknown>) : {};

    group.agents[toolName] = {
      toolName,
      state: isDone ? "done" : isError ? "error" : "active",
      badgeKey: isDone ? getBadgeKey(toolName, output) : null,
      detail: isDone ? getDetail(toolName, output) : "",
    };
  }

  return Array.from(groups.values());
}

// ── Claim card ────────────────────────────────────────────────────────────────

function ClaimCard({ group, index }: { group: ClaimGroup; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const agentsDone = Object.values(group.agents).filter((a) => a.state === "done").length;
  const agentsTotal = AGENT_ORDER.filter((k) => group.agents[k]).length;
  const scoreColor = group.score == null ? "#64748b" : group.score >= 70 ? "#15803d" : group.score >= 40 ? "#92400e" : "#b91c1c";

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e8ecf0",
        borderRadius: 12,
        overflow: "hidden",
        animation: "storySlide 0.35s ease both",
        boxShadow: group.isComplete ? "none" : "0 2px 12px rgba(74,158,255,0.08)",
      }}
    >
      {/* Claim header */}
      <div
        onClick={() => setExpanded((x) => !x)}
        style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          padding: "12px 14px", cursor: "pointer",
          background: group.isComplete ? "#fafafa" : "#fff",
          borderBottom: expanded ? "1px solid #f1f5f9" : "none",
        }}
      >
        {/* Score / index circle */}
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: group.isComplete ? scoreColor + "15" : "#eff6ff",
          border: `1.5px solid ${group.isComplete ? scoreColor + "40" : "#bfdbfe"}`,
        }}>
          {group.isComplete ? (
            <span style={{ fontSize: 11, fontWeight: 800, color: scoreColor }}>{group.score}</span>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6" }}>{index + 1}</span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Regulation + article */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            {group.regulation && (
              <span style={{
                fontSize: 10, fontWeight: 800, color: "#1e293b",
                fontFamily: "monospace", background: "#f1f5f9",
                borderRadius: 4, padding: "2px 6px",
              }}>
                {group.regulation}
              </span>
            )}
            {group.article && (
              <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>
                {group.article}
              </span>
            )}
            {!group.isComplete && (
              <span style={{
                marginLeft: "auto", fontSize: 9, fontWeight: 700, color: "#3b82f6",
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: "50%", background: "#3b82f6",
                  display: "inline-block", animation: "dotPulse 1.2s ease-in-out infinite",
                }} />
                {agentsDone}/{agentsTotal} agents
              </span>
            )}
            {group.isComplete && (
              <span style={{
                marginLeft: "auto", fontSize: 9, fontWeight: 700,
                color: scoreColor, padding: "2px 6px", borderRadius: 4,
                background: scoreColor + "12",
              }}>
                {group.score! >= 70 ? "PROCEED" : group.score! >= 40 ? "REVIEW" : "DO NOT SEND"}
              </span>
            )}
          </div>

          {/* Claim text */}
          {group.text && (
            <p style={{
              fontSize: 11, color: "#475569", lineHeight: 1.55, margin: 0,
              overflow: "hidden", textOverflow: "ellipsis",
              display: "-webkit-box", WebkitLineClamp: expanded ? undefined : 2,
              WebkitBoxOrient: "vertical",
            }}>
              {group.text}
            </p>
          )}
        </div>

        {/* Expand chevron */}
        <span style={{
          fontSize: 10, color: "#94a3b8", flexShrink: 0, marginTop: 4,
          transform: expanded ? "rotate(180deg)" : "none",
          transition: "transform 0.2s",
        }}>
          ▾
        </span>
      </div>

      {/* Agent dots strip (always visible) */}
      <div style={{
        display: "flex", padding: "8px 14px 8px 62px", gap: 6,
        borderBottom: expanded ? "1px solid #f1f5f9" : "none",
        background: "#fcfdfe",
      }}>
        {AGENT_ORDER.map((key) => {
          const ag = AGENTS[key];
          const result = group.agents[key];
          const badge = result?.badgeKey ? BADGE[result.badgeKey] : null;

          if (!result) {
            return (
              <div key={key} style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 20,
                background: "#f8fafc", border: "1px solid #e8ecf0",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e2e8f0", display: "inline-block" }} />
                <span style={{ fontSize: 9, color: "#cbd5e1", fontWeight: 600 }}>{ag.shortLabel}</span>
              </div>
            );
          }

          if (result.state === "active") {
            return (
              <div key={key} style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 20,
                background: ag.color + "12", border: `1px solid ${ag.color}30`,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", background: ag.color,
                  display: "inline-block", animation: "dotPulse 1.2s ease-in-out infinite",
                }} />
                <span style={{ fontSize: 9, color: ag.color, fontWeight: 700 }}>{ag.shortLabel}</span>
              </div>
            );
          }

          return (
            <div key={key} style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "3px 8px", borderRadius: 20,
              background: badge ? badge.bg : ag.color + "12",
              border: `1px solid ${badge ? badge.text + "30" : ag.color + "30"}`,
            }}>
              <span style={{ fontSize: 8, color: badge ? badge.text : ag.color, fontWeight: 800 }}>✓</span>
              <span style={{ fontSize: 9, color: badge ? badge.text : ag.color, fontWeight: 700 }}>
                {badge ? badge.label : ag.shortLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Expanded: agent detail rows */}
      {expanded && (
        <div style={{ padding: "0 14px 12px 14px" }}>
          {AGENT_ORDER.map((key) => {
            const ag = AGENTS[key];
            const result = group.agents[key];
            if (!result || result.state !== "done") return null;
            const badge = result.badgeKey ? BADGE[result.badgeKey] : null;

            return (
              <div key={key} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                padding: "8px 0",
                borderBottom: "1px solid #f8fafc",
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: ag.color + "15", color: ag.color, fontSize: 11, marginTop: 1,
                }}>
                  {ag.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#1e293b" }}>{ag.label}</span>
                    {badge && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "1px 6px",
                        borderRadius: 99, background: badge.bg, color: badge.text,
                      }}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  {result.detail && (
                    <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6, margin: 0 }}>
                      {result.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── AuditStory ────────────────────────────────────────────────────────────────

export function AuditStory({ toolParts }: { toolParts: unknown[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [toolParts.length]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups = buildClaimGroups(toolParts as any[]);
  const completedClaims = groups.filter((g) => g.isComplete).length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractPart = (toolParts as any[]).find(
    (p) => p.type === "tool-extractClaims" && p.state === "output-available"
  );
  const totalClaims: number | null = extractPart?.output?.count ?? extractPart?.output?.length ?? null;

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "14px 14px 32px" }}>
      <style>{`
        @keyframes storySlide {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.35; transform: scale(0.65); }
        }
      `}</style>

      {/* Progress header */}
      {totalClaims !== null && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", marginBottom: 12,
          background: "#f8fafc", border: "1px solid #e2e8f0",
          borderRadius: 8, animation: "storySlide 0.3s ease both",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", animation: completedClaims < totalClaims ? "dotPulse 1.2s ease-in-out infinite" : "none" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>
              {completedClaims < totalClaims
                ? `Verifying claim ${completedClaims + 1} of ${totalClaims}…`
                : `All ${totalClaims} claims verified`}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 80, height: 4, borderRadius: 2, background: "#e2e8f0", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2,
                width: `${totalClaims > 0 ? (completedClaims / totalClaims) * 100 : 0}%`,
                background: completedClaims === totalClaims ? "#22c55e" : "#3b82f6",
                transition: "width 0.5s ease",
              }} />
            </div>
            <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, fontFamily: "monospace" }}>
              {completedClaims}/{totalClaims}
            </span>
          </div>
        </div>
      )}

      {/* Claim groups */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {groups.map((group, i) => (
          <ClaimCard key={group.claimKey} group={group} index={i} />
        ))}
      </div>

      {/* Empty state */}
      {groups.length === 0 && totalClaims === null && (
        <div style={{ textAlign: "center", padding: "56px 20px", color: "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>⚖</div>
          <p style={{ fontSize: 13, fontWeight: 500 }}>Agents are starting up…</p>
          <p style={{ fontSize: 11, marginTop: 4 }}>Claims will appear here as they are extracted</p>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
