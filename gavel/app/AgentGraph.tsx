"use client";

import { useEffect, useRef, useState } from "react";

const CX = 440;
const CY = 320;
const OX = CX / 2;
const OY = CY / 2;
const R_ORBIT = 130;
const R_OPUS  = 34;
const R_AGENT = 22;
const R_CLAIM = 16;

interface AgentNode {
  key: string;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  angle: number;
  description: string;
}

const AGENTS: AgentNode[] = [
  { key: "extractClaims",      label: "Extract Claims",   shortLabel: "EXTRACT", icon: "◈", color: "#4a9eff", angle: -Math.PI / 2,                        description: "Parses the document into structured legal claims with regulation, article and jurisdiction." },
  { key: "runSourcer",         label: "Sourcer",          shortLabel: "SOURCER", icon: "⊕", color: "#00d98b", angle: -Math.PI / 2 + (2 * Math.PI) / 7,    description: "Fetches verbatim article text from EU Cellar and checks if the claim matches word-for-word." },
  { key: "runJurisdictionist", label: "Jurisdiction",     shortLabel: "JX",      icon: "◉", color: "#9f7aea", angle: -Math.PI / 2 + (4 * Math.PI) / 7,    description: "Checks whether the regulation actually applies to the client entity — critical for UK firms post-Brexit." },
  { key: "runHistorian",       label: "Historian",        shortLabel: "HIST",    icon: "⊗", color: "#f5a623", angle: -Math.PI / 2 + (6 * Math.PI) / 7,    description: "Queries EU Cellar SPARQL for amendment history. Catches outdated article numbers." },
  { key: "runDevilsAdvocate",  label: "Devil's Advocate", shortLabel: "DEVIL",   icon: "⊘", color: "#ff6b6b", angle: -Math.PI / 2 + (8 * Math.PI) / 7,    description: "Searches Bailii and legal databases for real counter-authorities that could undermine the advice." },
  { key: "runFirmMemory",      label: "Firm Memory",      shortLabel: "MEMORY",  icon: "⊙", color: "#00d9d9", angle: -Math.PI / 2 + (10 * Math.PI) / 7,   description: "Checks for contradictions with the firm's past legal positions and previous client advice." },
  { key: "deepResearch",       label: "Deep Research",    shortLabel: "SEARCH",  icon: "⊛", color: "#d0a0ff", angle: -Math.PI / 2 + (12 * Math.PI) / 7,   description: "Scrapes Bailii and regulatory databases for real case law precedents on demand." },
];

function agentPos(a: AgentNode) {
  return { x: OX + R_ORBIT * Math.cos(a.angle), y: OY + R_ORBIT * Math.sin(a.angle) };
}

type ToolState = "active" | "done" | "error";
interface NodeState { state: ToolState; result?: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractGraphState(toolParts: any[]): { nodes: Record<string, NodeState>; claims: { score: number; status: ToolState }[] } {
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
    const existing = nodes[name];
    let state: ToolState = "active";
    let result: string | undefined;
    if (p.state === "output-available") {
      state = "done";
      if (name === "runJurisdictionist") result = p.output?.status?.replace(/_/g, " ");
      else if (name === "runSourcer")    result = p.output?.status;
      else if (name === "runHistorian")  result = p.output?.status;
      else if (name === "runDevilsAdvocate") result = p.output?.strength?.toUpperCase();
      else if (name === "runFirmMemory") result = p.output?.status === "CONTRADICTION_FOUND" ? "CONFLICT" : "CLEAR";
      else if (name === "extractClaims") result = `${p.output?.count ?? "?"} claims`;
      else if (name === "deepResearch")  result = "done";
    } else if (p.state === "output-error") { state = "error"; }
    if (!existing || state === "done" || (state === "error" && existing.state === "active")) nodes[name] = { state, result };
  }
  return { nodes, claims };
}

const SCORE_COLOR = (s: number) => s < 40 ? "#ff3b5c" : s < 70 ? "#f5a623" : "#00d98b";

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

interface Popup { key: string; label: string; description: string; color: string; x: number; y: number; state?: NodeState }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function AgentGraph({ toolParts }: { toolParts: any[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef<number>(0);
  const [popup, setPopup] = useState<Popup | null>(null);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CX / rect.width;
    const scaleY = CY / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const { nodes } = extractGraphState(toolParts);

    if (dist(cx, cy, OX, OY) <= R_OPUS + 6) {
      setPopup(popup?.key === "orchestrator" ? null : {
        key: "orchestrator", label: "GAVEL Orchestrator", color: "#4a9eff",
        description: "Sonnet orchestrates all specialist agents — decides call order, batches parallel tool calls, and synthesises the final GAVEL score.",
        x: OX, y: OY,
      });
      return;
    }

    for (const agent of AGENTS) {
      const pos = agentPos(agent);
      if (dist(cx, cy, pos.x, pos.y) <= R_AGENT + 6) {
        if (popup?.key === agent.key) { setPopup(null); return; }
        setPopup({ key: agent.key, label: agent.label, description: agent.description, color: agent.color, x: pos.x, y: pos.y, state: nodes[agent.key] });
        return;
      }
    }

    setPopup(null);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = CX * dpr; canvas.height = CY * dpr;
    canvas.style.width = `${CX}px`; canvas.style.height = `${CY}px`;
    ctx.scale(dpr, dpr);

    function draw(ts: number) {
      ctx!.clearRect(0, 0, CX, CY);
      const { nodes, claims } = extractGraphState(toolParts);
      const pulse = (Math.sin(ts / 400) + 1) / 2;

      ctx!.fillStyle = "#040408"; ctx!.fillRect(0, 0, CX, CY);

      ctx!.beginPath(); ctx!.arc(OX, OY, R_ORBIT, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(255,255,255,0.04)"; ctx!.lineWidth = 1;
      ctx!.setLineDash([4, 8]); ctx!.stroke(); ctx!.setLineDash([]);

      const claimStartX = CX - 60;
      const claimStartY = CY / 2 - (claims.length - 1) * 28;
      claims.forEach((cl, i) => {
        const x = claimStartX; const y = claimStartY + i * 56;
        const col = cl.status === "active" ? "#f5a623" : cl.status === "error" ? "#ff3b5c" : SCORE_COLOR(cl.score);
        ctx!.beginPath(); ctx!.moveTo(OX + R_OPUS, OY); ctx!.lineTo(x - R_CLAIM, y);
        if (cl.status === "active") {
          const offset = (ts / 20) % 24; ctx!.setLineDash([6, 10]); ctx!.lineDashOffset = -offset;
          ctx!.strokeStyle = `rgba(245,166,35,${0.3 + 0.3 * pulse})`;
        } else { ctx!.setLineDash([]); ctx!.strokeStyle = "rgba(255,255,255,0.12)"; }
        ctx!.lineWidth = 1; ctx!.stroke(); ctx!.setLineDash([]); ctx!.lineDashOffset = 0;
        if (cl.status === "active") {
          const g = ctx!.createRadialGradient(x, y, 0, x, y, R_CLAIM * 2.5);
          g.addColorStop(0, `rgba(245,166,35,${0.15 * pulse})`); g.addColorStop(1, "transparent");
          ctx!.beginPath(); ctx!.arc(x, y, R_CLAIM * 2.5, 0, Math.PI * 2); ctx!.fillStyle = g; ctx!.fill();
        }
        ctx!.beginPath(); ctx!.arc(x, y, R_CLAIM, 0, Math.PI * 2); ctx!.fillStyle = "#0d0d18"; ctx!.fill();
        ctx!.strokeStyle = col; ctx!.lineWidth = cl.status === "active" ? 1.5 + pulse : 1.5; ctx!.stroke();
        ctx!.fillStyle = col; ctx!.font = "bold 9px monospace"; ctx!.textAlign = "center"; ctx!.textBaseline = "middle";
        ctx!.fillText(cl.status === "done" ? `${cl.score}` : cl.status === "error" ? "ERR" : `C${i + 1}`, x, y);
        ctx!.fillStyle = "rgba(255,255,255,0.3)"; ctx!.font = "7px monospace"; ctx!.fillText(`CLAIM ${i + 1}`, x, y + R_CLAIM + 8);
      });

      AGENTS.forEach((agent) => {
        const pos = agentPos(agent); const ns = nodes[agent.key];
        const isActive = ns?.state === "active"; const isDone = ns?.state === "done"; const isError = ns?.state === "error"; const hasState = !!ns;
        if (hasState) {
          ctx!.beginPath(); ctx!.moveTo(OX, OY); ctx!.lineTo(pos.x, pos.y);
          if (isActive) {
            const offset = (ts / 15) % 20; ctx!.setLineDash([5, 8]); ctx!.lineDashOffset = -offset;
            ctx!.strokeStyle = `rgba(${hexToRgb(agent.color)},${0.4 + 0.4 * pulse})`; ctx!.lineWidth = 1.5;
          } else if (isDone) { ctx!.setLineDash([]); ctx!.strokeStyle = `rgba(${hexToRgb(agent.color)},0.25)`; ctx!.lineWidth = 1; }
          else { ctx!.setLineDash([]); ctx!.strokeStyle = "rgba(255,59,92,0.3)"; ctx!.lineWidth = 1; }
          ctx!.stroke(); ctx!.setLineDash([]); ctx!.lineDashOffset = 0;
        }
        if (isActive) {
          const g = ctx!.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, R_AGENT * 3);
          g.addColorStop(0, `rgba(${hexToRgb(agent.color)},${0.2 * pulse})`); g.addColorStop(1, "transparent");
          ctx!.beginPath(); ctx!.arc(pos.x, pos.y, R_AGENT * 3, 0, Math.PI * 2); ctx!.fillStyle = g; ctx!.fill();
        }
        const isSelected = popup?.key === agent.key;
        ctx!.beginPath(); ctx!.arc(pos.x, pos.y, R_AGENT, 0, Math.PI * 2); ctx!.fillStyle = hasState ? "#0f0f1c" : "#0a0a14"; ctx!.fill();
        const borderColor = isError ? "#ff3b5c" : isDone ? agent.color : isActive ? agent.color : "rgba(255,255,255,0.1)";
        ctx!.strokeStyle = isSelected ? "#fff" : borderColor; ctx!.lineWidth = isSelected ? 2 : (isActive ? 1.5 + pulse : isDone ? 1.5 : 1); ctx!.stroke();
        ctx!.fillStyle = hasState ? agent.color : "rgba(255,255,255,0.2)"; ctx!.font = "bold 13px monospace"; ctx!.textAlign = "center"; ctx!.textBaseline = "middle";
        ctx!.fillText(agent.icon, pos.x, pos.y - 4);
        ctx!.fillStyle = hasState ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)"; ctx!.font = "6px monospace"; ctx!.fillText(agent.shortLabel, pos.x, pos.y + 8);
        if (ns?.result) {
          const bx = pos.x; const by = pos.y + R_AGENT + 12;
          ctx!.fillStyle = ns.state === "error" ? "rgba(255,59,92,0.15)" : `rgba(${hexToRgb(agent.color)},0.12)`;
          const tw = ctx!.measureText(ns.result).width + 8;
          ctx!.beginPath(); roundRect(ctx!, bx - tw / 2, by - 6, tw, 12, 3); ctx!.fill();
          ctx!.fillStyle = ns.state === "error" ? "#ff3b5c" : agent.color; ctx!.font = "bold 7px monospace"; ctx!.textAlign = "center"; ctx!.textBaseline = "middle";
          ctx!.fillText(ns.result, bx, by);
        }
      });

      const opusActive = toolParts.some((p) => p.state === "input-available" || p.state === "input-streaming");
      const isOpusSelected = popup?.key === "orchestrator";
      if (opusActive) {
        const g = ctx!.createRadialGradient(OX, OY, 0, OX, OY, R_OPUS * 3);
        g.addColorStop(0, `rgba(74,158,255,${0.12 * pulse})`); g.addColorStop(1, "transparent");
        ctx!.beginPath(); ctx!.arc(OX, OY, R_OPUS * 3, 0, Math.PI * 2); ctx!.fillStyle = g; ctx!.fill();
      }
      ctx!.beginPath(); ctx!.arc(OX, OY, R_OPUS, 0, Math.PI * 2); ctx!.fillStyle = "#0d0d1f"; ctx!.fill();
      ctx!.strokeStyle = isOpusSelected ? "#fff" : (opusActive ? `rgba(74,158,255,${0.7 + 0.3 * pulse})` : "rgba(74,158,255,0.5)");
      ctx!.lineWidth = isOpusSelected ? 2.5 : (opusActive ? 2 + pulse : 1.5); ctx!.stroke();
      ctx!.beginPath(); ctx!.arc(OX, OY, R_OPUS - 7, 0, Math.PI * 2); ctx!.strokeStyle = "rgba(74,158,255,0.2)"; ctx!.lineWidth = 1; ctx!.stroke();
      ctx!.fillStyle = "#4a9eff"; ctx!.font = "bold 11px monospace"; ctx!.textAlign = "center"; ctx!.textBaseline = "middle";
      ctx!.fillText("⚖", OX, OY - 6); ctx!.font = "bold 7px monospace"; ctx!.fillText("SONNET", OX, OY + 6);
      ctx!.font = "6px monospace"; ctx!.fillStyle = "rgba(74,158,255,0.5)"; ctx!.fillText("orchestrator", OX, OY + 16);

      frameRef.current = requestAnimationFrame(draw);
    }
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [toolParts, popup]);

  const { nodes } = extractGraphState(toolParts);

  return (
    <div style={{ position: "relative", width: CX, height: CY }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{ display: "block", cursor: "pointer" }}
      />

      {popup && (() => {
        const popupW = 200;
        const popupH = popup.state?.result ? 110 : 90;
        let left = popup.x - popupW / 2;
        let top = popup.y - R_OPUS - popupH - 10;
        if (top < 4) top = popup.y + R_AGENT + 14;
        if (left < 4) left = 4;
        if (left + popupW > CX - 4) left = CX - popupW - 4;

        const stateLabel = popup.state?.state === "done" ? "Done"
          : popup.state?.state === "active" ? "Running…"
          : popup.state?.state === "error" ? "Error"
          : "Waiting";
        const stateColor = popup.state?.state === "done" ? popup.color
          : popup.state?.state === "active" ? "#f5a623"
          : popup.state?.state === "error" ? "#ff3b5c"
          : "rgba(255,255,255,0.3)";

        // suppress unused var warning — nodes used for type narrowing above
        void nodes;

        return (
          <div
            style={{
              position: "absolute", left, top, width: popupW,
              background: "rgba(10,10,20,0.97)", border: `1px solid ${popup.color}40`,
              borderRadius: 10, padding: "10px 12px", boxShadow: `0 0 20px ${popup.color}22`,
              pointerEvents: "none", zIndex: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: popup.color, flexShrink: 0 }} />
              <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>
                {popup.label.toUpperCase()}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: stateColor, fontFamily: "monospace", fontWeight: 600 }}>
                {stateLabel}
              </span>
            </div>
            {popup.state?.result && (
              <div style={{ marginBottom: 6, padding: "2px 7px", borderRadius: 4, display: "inline-block",
                backgroundColor: `${popup.color}18`, border: `1px solid ${popup.color}30`,
                color: popup.color, fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>
                {popup.state.result}
              </div>
            )}
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, lineHeight: 1.5, margin: 0 }}>
              {popup.description}
            </p>
          </div>
        );
      })()}
    </div>
  );
}
