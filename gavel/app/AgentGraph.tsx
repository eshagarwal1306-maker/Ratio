"use client";

import { useEffect, useRef, useState } from "react";

// ── Canvas constants ───────────────────────────────────────────────────────────

const CX = 440;
const CY = 300;
const OX = CX / 2;
const OY = CY / 2;
const R_ORBIT = 120;
const R_OPUS  = 32;
const R_AGENT = 21;
const R_CLAIM = 14;

// ── Agent config ──────────────────────────────────────────────────────────────

interface AgentNode {
  key: string;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  angle: number;
  description: string;
  what: string;
  sources: string;
}

const AGENTS: AgentNode[] = [
  {
    key: "extractClaims", label: "Claim Extractor", shortLabel: "EXTRACT", icon: "◈", color: "#4a9eff",
    angle: -Math.PI / 2,
    description: "Reads the document and identifies every discrete legal claim — each regulation, article, and jurisdictional assertion.",
    what: "Parses the full document text and returns a structured list of claims with regulation code, article number, jurisdiction, and verbatim claim text.",
    sources: "Source document only",
  },
  {
    key: "runSourcer", label: "Citation Sourcer", shortLabel: "SOURCER", icon: "⊕", color: "#00d98b",
    angle: -Math.PI / 2 + (2 * Math.PI) / 7,
    description: "Fetches the verbatim article text from EU Cellar and legislation.gov.uk, then checks whether the claim matches word-for-word.",
    what: "For each claim, retrieves the exact statutory text from the official source and compares it character-by-character against what the memo asserts. Returns CITED, INFERRED, or NOT_FOUND.",
    sources: "EUR-Lex · EU Cellar SPARQL · legislation.gov.uk",
  },
  {
    key: "runJurisdictionist", label: "Jurisdictionist", shortLabel: "JX", icon: "◉", color: "#9f7aea",
    angle: -Math.PI / 2 + (4 * Math.PI) / 7,
    description: "Checks whether the cited regulation actually applies to the client entity — critical for UK firms after Brexit.",
    what: "Analyses the client entity description against the territorial and subject-matter scope of the cited regulation. Post-Brexit, many EU instruments ceased to apply to UK-only firms.",
    sources: "EU Cellar · FCA register · ESMA scope guidance",
  },
  {
    key: "runHistorian", label: "Legal Historian", shortLabel: "HIST", icon: "⊗", color: "#f5a623",
    angle: -Math.PI / 2 + (6 * Math.PI) / 7,
    description: "Queries EU Cellar SPARQL for the full amendment history of the cited provision and catches outdated article numbers.",
    what: "Traces the legislative timeline of the cited article — when it was enacted, amended, renumbered, or repealed. AI models often hallucinate article numbers from draft versions.",
    sources: "EU Cellar SPARQL endpoint · legislation.gov.uk amendment tracker",
  },
  {
    key: "runDevilsAdvocate", label: "Devil's Advocate", shortLabel: "DEVIL", icon: "⊘", color: "#ff6b6b",
    angle: -Math.PI / 2 + (8 * Math.PI) / 7,
    description: "Searches legal databases for real counter-authorities that could undermine the advice in court or before a regulator.",
    what: "Constructs the strongest possible opposing argument — finding case law, contrary regulatory guidance, or academic authority that challenges the proposition in the memo.",
    sources: "BAILII · ESMA Q&A · EBA guidelines · academic repositories",
  },
  {
    key: "runFirmMemory", label: "Firm Memory", shortLabel: "MEMORY", icon: "⊙", color: "#00d9d9",
    angle: -Math.PI / 2 + (10 * Math.PI) / 7,
    description: "Checks the firm's prior advice database for contradictions with past legal positions taken for this or similar clients.",
    what: "Runs the claim against a vector store of prior firm opinions, memos, and client advice letters. Surfaces any instance where the firm has taken the opposite position.",
    sources: "Firm memo archive · prior client advisory letters",
  },
  {
    key: "deepResearch", label: "Deep Research", shortLabel: "SEARCH", icon: "⊛", color: "#d0a0ff",
    angle: -Math.PI / 2 + (12 * Math.PI) / 7,
    description: "Scrapes BAILII and regulatory databases live for real case law precedents when the training data is insufficient.",
    what: "Triggered when the Devil's Advocate or Sourcer can't find what they need from their model knowledge. Makes live web requests to retrieve actual judgments and regulations.",
    sources: "BAILII live scrape · EUR-Lex full text · GOV.UK guidance",
  },
];

function agentPos(a: AgentNode) {
  return { x: OX + R_ORBIT * Math.cos(a.angle), y: OY + R_ORBIT * Math.sin(a.angle) };
}

// ── State extraction ──────────────────────────────────────────────────────────

type ToolState = "active" | "done" | "error";

interface NodeState {
  state: ToolState;
  result?: string;
  callCount: number;
  lastOutput?: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractGraphState(toolParts: any[]): {
  nodes: Record<string, NodeState>;
  claims: { score: number; status: ToolState }[];
} {
  const nodes: Record<string, NodeState> = {};
  const claims: { score: number; status: ToolState }[] = [];

  for (const p of toolParts) {
    const name = (p.type as string).replace(/^tool-/, "");

    if (name === "reportClaim") {
      if (p.state === "output-available" && p.output) claims.push({ score: p.output.score, status: "done" });
      else if (p.state === "output-error") claims.push({ score: 0, status: "error" });
      else claims.push({ score: 0, status: "active" });
      continue;
    }

    let state: ToolState = "active";
    let result: string | undefined;
    let lastOutput: Record<string, unknown> | undefined;

    if (p.state === "output-available") {
      state = "done";
      lastOutput = p.output as Record<string, unknown>;
      if (name === "runJurisdictionist") result = (p.output?.status as string)?.replace(/_/g, " ");
      else if (name === "runSourcer")    result = p.output?.status as string;
      else if (name === "runHistorian")  result = p.output?.status as string;
      else if (name === "runDevilsAdvocate") result = (p.output?.strength as string)?.toUpperCase();
      else if (name === "runFirmMemory") result = p.output?.status === "CONTRADICTION_FOUND" ? "CONFLICT" : "CLEAR";
      else if (name === "extractClaims") result = `${p.output?.count ?? "?"} claims`;
      else if (name === "deepResearch")  result = "done";
    } else if (p.state === "output-error") {
      state = "error";
    }

    const existing = nodes[name];
    const callCount = (existing?.callCount ?? 0) + (state === "active" || state === "done" ? 1 : 0);

    if (!existing || state === "done" || (state === "error" && existing.state === "active")) {
      nodes[name] = { state, result, callCount, lastOutput };
    } else {
      nodes[name].callCount = callCount;
    }
  }

  return { nodes, claims };
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

const SCORE_COLOR = (s: number) => s < 40 ? "#ff3b5c" : s < 70 ? "#f5a623" : "#00d98b";

// ── Detail panel ──────────────────────────────────────────────────────────────

function getLastFinding(agent: AgentNode, ns: NodeState | undefined): string {
  if (!ns?.lastOutput) return "";
  const o = ns.lastOutput;

  if (agent.key === "runSourcer") {
    if (o.status === "CITED") return `"${((o.verbatim_quote as string) ?? "").slice(0, 140)}…"`;
    if (o.status === "NOT_FOUND") return (o.discrepancy as string) ?? "Source could not be located in primary databases.";
    return "Citation appears paraphrased — not verbatim match.";
  }
  if (agent.key === "runJurisdictionist") {
    return `${o.confidence ?? "?"}% confidence — ${((o.reason as string) ?? "").slice(0, 160)}`;
  }
  if (agent.key === "runHistorian") return ((o.note as string) ?? "").slice(0, 180);
  if (agent.key === "runDevilsAdvocate") {
    const auth = o.counter_authority as string ?? "";
    const why = ((o.why_it_undermines as string) ?? "").slice(0, 140);
    return auth ? `${auth}: ${why}` : why;
  }
  if (agent.key === "runFirmMemory") {
    if (o.status === "CONTRADICTION_FOUND") {
      const ref = o.reference as Record<string, string> | undefined;
      return ref ? `Conflict with: ${ref.matter} (${ref.date})` : "Contradiction found with prior firm advice.";
    }
    return "No conflicts found with prior firm positions.";
  }
  return "";
}

interface SelectedAgent {
  agent: AgentNode | null; // null = orchestrator
  ns: NodeState | undefined;
}

function DetailPanel({ selected, totalClaims }: { selected: SelectedAgent; totalClaims: number }) {
  const isOrchestrator = selected.agent === null;
  const agent = selected.agent;
  const ns = selected.ns;

  const stateColor = !ns ? "rgba(255,255,255,0.3)"
    : ns.state === "done" ? (agent?.color ?? "#4a9eff")
    : ns.state === "active" ? "#f5a623"
    : "#ff3b5c";

  const stateLabel = !ns ? "Waiting"
    : ns.state === "done" ? "Complete"
    : ns.state === "active" ? "Running…"
    : "Error";

  const finding = agent && ns ? getLastFinding(agent, ns) : "";

  if (isOrchestrator) {
    return (
      <div style={{ padding: "16px 18px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4a9eff", flexShrink: 0 }} />
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.06em" }}>
            RATIO ORCHESTRATOR
          </span>
          <span style={{ marginLeft: "auto", fontSize: 10, color: "#4a9eff", fontWeight: 600 }}>Active</span>
        </div>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, lineHeight: 1.65, marginBottom: 10 }}>
          Claude Sonnet 4.6 coordinates all specialist agents — decides call order, fans out parallel tool calls per claim, and synthesises the final RATIO score.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {["5 agents", `${totalClaims} claims`, "Parallel execution"].map((tag) => (
            <span key={tag} style={{
              fontSize: 9, fontWeight: 700, color: "#4a9eff",
              background: "rgba(74,158,255,0.12)", border: "1px solid rgba(74,158,255,0.25)",
              padding: "2px 8px", borderRadius: 4, letterSpacing: "0.04em",
            }}>{tag}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 18px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: agent!.color, flexShrink: 0 }} />
        <span style={{ color: "#fff", fontSize: 12, fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.05em" }}>
          {agent!.label.toUpperCase()}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          {ns && (
            <span style={{ fontSize: 9, fontWeight: 700, color: stateColor, background: stateColor + "18", border: `1px solid ${stateColor}30`, padding: "2px 7px", borderRadius: 4 }}>
              {stateLabel}
            </span>
          )}
          {ns?.callCount && ns.callCount > 1 && (
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
              ×{ns.callCount} calls
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, lineHeight: 1.65, marginBottom: 8 }}>
        {agent!.description}
      </p>

      {/* What it actually does */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
        <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
          What it does
        </p>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 10.5, lineHeight: 1.6, margin: 0 }}>
          {agent!.what}
        </p>
      </div>

      {/* Sources */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: finding ? 8 : 0 }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Searches:
        </span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{agent!.sources}</span>
      </div>

      {/* Most recent finding */}
      {finding && (
        <div style={{
          background: agent!.color + "12", border: `1px solid ${agent!.color}25`,
          borderRadius: 6, padding: "8px 10px",
        }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: agent!.color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
            Latest finding
          </p>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 10.5, lineHeight: 1.6, margin: 0 }}>
            {finding}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function AgentGraph({ toolParts }: { toolParts: any[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef<number>(0);
  const [selected, setSelected] = useState<SelectedAgent | null>(null);

  const { nodes, claims } = extractGraphState(toolParts);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CX / rect.width;
    const scaleY = CY / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const { nodes: ns } = extractGraphState(toolParts);

    if (dist(cx, cy, OX, OY) <= R_OPUS + 8) {
      setSelected((prev) => prev?.agent === null ? null : { agent: null, ns: undefined });
      return;
    }

    for (const agent of AGENTS) {
      const pos = agentPos(agent);
      if (dist(cx, cy, pos.x, pos.y) <= R_AGENT + 8) {
        setSelected((prev) =>
          prev?.agent?.key === agent.key ? null : { agent, ns: ns[agent.key] }
        );
        return;
      }
    }

    setSelected(null);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = CX * dpr; canvas.height = CY * dpr;
    canvas.style.width  = `${CX}px`;
    canvas.style.height = `${CY}px`;
    ctx.scale(dpr, dpr);

    function draw(ts: number) {
      ctx!.clearRect(0, 0, CX, CY);
      const { nodes: ns, claims: cl } = extractGraphState(toolParts);
      const pulse = (Math.sin(ts / 400) + 1) / 2;

      // Background
      ctx!.fillStyle = "#040408";
      ctx!.fillRect(0, 0, CX, CY);

      // Orbit ring
      ctx!.beginPath(); ctx!.arc(OX, OY, R_ORBIT, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(255,255,255,0.05)"; ctx!.lineWidth = 1;
      ctx!.setLineDash([4, 8]); ctx!.stroke(); ctx!.setLineDash([]);

      // Claim nodes (right side)
      const claimStartX = CX - 52;
      const claimStartY = CY / 2 - (cl.length - 1) * 24;
      cl.forEach((c, i) => {
        const x = claimStartX; const y = claimStartY + i * 48;
        const col = c.status === "active" ? "#f5a623" : c.status === "error" ? "#ff3b5c" : SCORE_COLOR(c.score);

        ctx!.beginPath(); ctx!.moveTo(OX + R_OPUS, OY); ctx!.lineTo(x - R_CLAIM, y);
        if (c.status === "active") {
          ctx!.setLineDash([5, 9]); ctx!.lineDashOffset = -((ts / 18) % 22);
          ctx!.strokeStyle = `rgba(245,166,35,${0.3 + 0.3 * pulse})`;
        } else {
          ctx!.setLineDash([]); ctx!.strokeStyle = "rgba(255,255,255,0.1)";
        }
        ctx!.lineWidth = 1; ctx!.stroke();
        ctx!.setLineDash([]); ctx!.lineDashOffset = 0;

        ctx!.beginPath(); ctx!.arc(x, y, R_CLAIM, 0, Math.PI * 2);
        ctx!.fillStyle = "#0d0d18"; ctx!.fill();
        ctx!.strokeStyle = col; ctx!.lineWidth = c.status === "active" ? 1.5 + pulse : 1.5; ctx!.stroke();
        ctx!.fillStyle = col; ctx!.font = `bold 9px monospace`; ctx!.textAlign = "center"; ctx!.textBaseline = "middle";
        ctx!.fillText(c.status === "done" ? `${c.score}` : c.status === "error" ? "ERR" : `C${i + 1}`, x, y);
        ctx!.fillStyle = "rgba(255,255,255,0.28)"; ctx!.font = "6px monospace";
        ctx!.fillText(`C${i + 1}`, x, y + R_CLAIM + 7);
      });

      // Agent nodes
      AGENTS.forEach((agent) => {
        const pos = agentPos(agent);
        const agNs = ns[agent.key];
        const isActive = agNs?.state === "active";
        const isDone   = agNs?.state === "done";
        const isError  = agNs?.state === "error";
        const hasState = !!agNs;
        const isSelected = selected?.agent?.key === agent.key;

        // Connector line
        if (hasState) {
          ctx!.beginPath(); ctx!.moveTo(OX, OY); ctx!.lineTo(pos.x, pos.y);
          if (isActive) {
            ctx!.setLineDash([5, 8]); ctx!.lineDashOffset = -((ts / 14) % 18);
            ctx!.strokeStyle = `rgba(${hexToRgb(agent.color)},${0.4 + 0.4 * pulse})`;
            ctx!.lineWidth = 1.5;
          } else if (isDone) {
            ctx!.setLineDash([]); ctx!.strokeStyle = `rgba(${hexToRgb(agent.color)},0.2)`;
            ctx!.lineWidth = 1;
          } else {
            ctx!.setLineDash([]); ctx!.strokeStyle = "rgba(255,59,92,0.3)";
            ctx!.lineWidth = 1;
          }
          ctx!.stroke(); ctx!.setLineDash([]); ctx!.lineDashOffset = 0;
        }

        // Glow
        if (isActive || isSelected) {
          const g = ctx!.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, R_AGENT * 3);
          const opacity = isSelected ? 0.25 : 0.15 * pulse;
          g.addColorStop(0, `rgba(${hexToRgb(agent.color)},${opacity})`);
          g.addColorStop(1, "transparent");
          ctx!.beginPath(); ctx!.arc(pos.x, pos.y, R_AGENT * 3, 0, Math.PI * 2);
          ctx!.fillStyle = g; ctx!.fill();
        }

        // Circle
        ctx!.beginPath(); ctx!.arc(pos.x, pos.y, R_AGENT, 0, Math.PI * 2);
        ctx!.fillStyle = hasState ? "#0f0f1c" : "#0a0a14"; ctx!.fill();
        const borderColor = isError ? "#ff3b5c" : (isDone || isActive) ? agent.color : "rgba(255,255,255,0.1)";
        ctx!.strokeStyle = isSelected ? "#fff" : borderColor;
        ctx!.lineWidth = isSelected ? 2.5 : isActive ? 1.5 + pulse : isDone ? 1.5 : 1;
        ctx!.stroke();

        // Icon + short label
        ctx!.fillStyle = hasState ? agent.color : "rgba(255,255,255,0.2)";
        ctx!.font = "bold 12px monospace"; ctx!.textAlign = "center"; ctx!.textBaseline = "middle";
        ctx!.fillText(agent.icon, pos.x, pos.y - 4);
        ctx!.fillStyle = hasState ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.15)";
        ctx!.font = "5.5px monospace"; ctx!.fillText(agent.shortLabel, pos.x, pos.y + 8);

        // Result badge
        if (agNs?.result) {
          const bx = pos.x; const by = pos.y + R_AGENT + 11;
          ctx!.font = "bold 7px monospace";
          const tw = ctx!.measureText(agNs.result).width + 8;
          ctx!.fillStyle = agNs.state === "error" ? "rgba(255,59,92,0.15)" : `rgba(${hexToRgb(agent.color)},0.12)`;
          ctx!.beginPath(); roundRect(ctx!, bx - tw / 2, by - 6, tw, 12, 3); ctx!.fill();
          ctx!.fillStyle = agNs.state === "error" ? "#ff3b5c" : agent.color;
          ctx!.textAlign = "center"; ctx!.textBaseline = "middle";
          ctx!.fillText(agNs.result, bx, by);
        }
      });

      // Orchestrator (centre)
      const opusActive = toolParts.some((p) => p.state === "input-available" || p.state === "input-streaming");
      const isOpusSel  = selected?.agent === null && selected !== null;

      if (opusActive || isOpusSel) {
        const g = ctx!.createRadialGradient(OX, OY, 0, OX, OY, R_OPUS * 3);
        g.addColorStop(0, `rgba(74,158,255,${isOpusSel ? 0.2 : 0.1 * pulse})`);
        g.addColorStop(1, "transparent");
        ctx!.beginPath(); ctx!.arc(OX, OY, R_OPUS * 3, 0, Math.PI * 2);
        ctx!.fillStyle = g; ctx!.fill();
      }

      ctx!.beginPath(); ctx!.arc(OX, OY, R_OPUS, 0, Math.PI * 2);
      ctx!.fillStyle = "#0d0d1f"; ctx!.fill();
      ctx!.strokeStyle = isOpusSel ? "#fff" : (opusActive ? `rgba(74,158,255,${0.7 + 0.3 * pulse})` : "rgba(74,158,255,0.5)");
      ctx!.lineWidth = isOpusSel ? 2.5 : opusActive ? 2 + pulse : 1.5; ctx!.stroke();

      // Inner ring
      ctx!.beginPath(); ctx!.arc(OX, OY, R_OPUS - 6, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(74,158,255,0.18)"; ctx!.lineWidth = 1; ctx!.stroke();

      ctx!.fillStyle = "#4a9eff"; ctx!.font = "bold 8px Georgia, serif";
      ctx!.textAlign = "center"; ctx!.textBaseline = "middle";
      ctx!.fillText("RATIO", OX, OY - 4);
      ctx!.font = "5px monospace"; ctx!.fillStyle = "rgba(74,158,255,0.45)";
      ctx!.fillText("orchestrator", OX, OY + 8);

      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolParts, selected]);

  const totalClaims = claims.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#040408" }}>
      {/* Canvas */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          style={{ display: "block", cursor: "pointer", maxWidth: "100%", maxHeight: "100%" }}
        />
      </div>

      {/* Click hint (no selection) */}
      {!selected && (
        <div style={{
          padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)",
          textAlign: "center",
        }}>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>
            Click any node to see what it&apos;s doing
          </p>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          selected={selected}
          totalClaims={totalClaims}
        />
      )}

      {/* Live status row */}
      <div style={{
        padding: "6px 16px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: selected ? "none" : "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ display: "flex", gap: 10 }}>
          {Object.entries(nodes).filter(([, ns]) => ns.state === "active").map(([key]) => {
            const ag = AGENTS.find((a) => a.key === key);
            if (!ag) return null;
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: ag.color, display: "inline-block", animation: "agPulse 1.2s infinite" }} />
                <span style={{ fontSize: 9, color: ag.color, fontFamily: "monospace", fontWeight: 700 }}>{ag.shortLabel}</span>
              </div>
            );
          })}
        </div>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>
          {claims.filter((c) => c.status === "done").length}/{totalClaims > 0 ? totalClaims : "?"} claims
        </span>
      </div>

      <style>{`
        @keyframes agPulse { 0%,100%{opacity:1}50%{opacity:0.3} }
      `}</style>
    </div>
  );
}
