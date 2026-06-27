"use client";

import { useEffect, useRef } from "react";

// ─── Node layout ──────────────────────────────────────────────────────────────

const CX = 440;   // canvas width
const CY = 320;   // canvas height
const OX = CX / 2;
const OY = CY / 2;
const R_ORBIT = 130;   // orbit radius for agents
const R_OPUS  = 34;
const R_AGENT = 22;
const R_CLAIM = 16;

interface AgentNode {
  key: string;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  angle: number; // radians
}

const AGENTS: AgentNode[] = [
  { key: "extractClaims",      label: "Extract Claims",   shortLabel: "EXTRACT", icon: "◈", color: "#4a9eff", angle: -Math.PI / 2 },
  { key: "runSourcer",         label: "Sourcer",          shortLabel: "SOURCER", icon: "⊕", color: "#00d98b", angle: -Math.PI / 2 + (2 * Math.PI) / 7 },
  { key: "runJurisdictionist", label: "Jurisdiction",     shortLabel: "JX",      icon: "◉", color: "#9f7aea", angle: -Math.PI / 2 + (4 * Math.PI) / 7 },
  { key: "runHistorian",       label: "Historian",        shortLabel: "HIST",    icon: "⊗", color: "#f5a623", angle: -Math.PI / 2 + (6 * Math.PI) / 7 },
  { key: "runDevilsAdvocate",  label: "Devil's Advocate", shortLabel: "DEVIL",   icon: "⊘", color: "#ff6b6b", angle: -Math.PI / 2 + (8 * Math.PI) / 7 },
  { key: "runFirmMemory",      label: "Firm Memory",      shortLabel: "MEMORY",  icon: "⊙", color: "#00d9d9", angle: -Math.PI / 2 + (10 * Math.PI) / 7 },
  { key: "deepResearch",       label: "Deep Research",    shortLabel: "SEARCH",  icon: "⊛", color: "#d0a0ff", angle: -Math.PI / 2 + (12 * Math.PI) / 7 },
];

function agentPos(a: AgentNode) {
  return {
    x: OX + R_ORBIT * Math.cos(a.angle),
    y: OY + R_ORBIT * Math.sin(a.angle),
  };
}

// ─── State per tool call ──────────────────────────────────────────────────────

type ToolState = "active" | "done" | "error";

interface NodeState {
  state: ToolState;
  result?: string; // status badge text
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
      if (p.state === "output-available" && p.output) {
        claims.push({ score: p.output.score, status: "done" });
      } else if (p.state === "output-error") {
        claims.push({ score: 0, status: "error" });
      } else {
        claims.push({ score: 0, status: "active" });
      }
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
    } else if (p.state === "output-error") {
      state = "error";
    }

    // Later calls with "done" take precedence over earlier "active"
    if (!existing || state === "done" || (state === "error" && existing.state === "active")) {
      nodes[name] = { state, result };
    }
  }
  return { nodes, claims };
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────

const SCORE_COLOR = (s: number) => s < 40 ? "#ff3b5c" : s < 70 ? "#f5a623" : "#00d98b";
const NODE_STATE_COLOR = (s: ToolState) =>
  s === "done" ? undefined : s === "error" ? "#ff3b5c" : "#4a9eff";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function AgentGraph({ toolParts }: { toolParts: any[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef<number>(0);
  const timeRef   = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = CX * dpr;
    canvas.height = CY * dpr;
    canvas.style.width  = `${CX}px`;
    canvas.style.height = `${CY}px`;
    ctx.scale(dpr, dpr);

    function draw(ts: number) {
      timeRef.current = ts;
      ctx!.clearRect(0, 0, CX, CY);

      const { nodes, claims } = extractGraphState(toolParts);
      const pulse = (Math.sin(ts / 400) + 1) / 2; // 0..1 oscillating

      // ── Background ──────────────────────────────────────────────────────────
      ctx!.fillStyle = "#040408";
      ctx!.fillRect(0, 0, CX, CY);

      // ── Orbit ring ──────────────────────────────────────────────────────────
      ctx!.beginPath();
      ctx!.arc(OX, OY, R_ORBIT, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(255,255,255,0.04)";
      ctx!.lineWidth = 1;
      ctx!.setLineDash([4, 8]);
      ctx!.stroke();
      ctx!.setLineDash([]);

      // ── Claim nodes (right side) ─────────────────────────────────────────────
      const claimStartX = CX - 60;
      const claimStartY = CY / 2 - (claims.length - 1) * 28;
      claims.forEach((cl, i) => {
        const x = claimStartX;
        const y = claimStartY + i * 56;
        const col = cl.status === "active" ? "#f5a623" : cl.status === "error" ? "#ff3b5c" : SCORE_COLOR(cl.score);

        // Connecting line from Opus to claim
        ctx!.beginPath();
        ctx!.moveTo(OX + R_OPUS, OY);
        ctx!.lineTo(x - R_CLAIM, y);
        if (cl.status === "active") {
          const offset = (ts / 20) % 24;
          ctx!.setLineDash([6, 10]);
          ctx!.lineDashOffset = -offset;
          ctx!.strokeStyle = `rgba(245,166,35,${0.3 + 0.3 * pulse})`;
        } else {
          ctx!.setLineDash([]);
          ctx!.strokeStyle = "rgba(255,255,255,0.12)";
        }
        ctx!.lineWidth = 1;
        ctx!.stroke();
        ctx!.setLineDash([]);
        ctx!.lineDashOffset = 0;

        // Glow
        if (cl.status === "active") {
          const g = ctx!.createRadialGradient(x, y, 0, x, y, R_CLAIM * 2.5);
          g.addColorStop(0, `rgba(245,166,35,${0.15 * pulse})`);
          g.addColorStop(1, "transparent");
          ctx!.beginPath();
          ctx!.arc(x, y, R_CLAIM * 2.5, 0, Math.PI * 2);
          ctx!.fillStyle = g;
          ctx!.fill();
        }

        // Node circle
        ctx!.beginPath();
        ctx!.arc(x, y, R_CLAIM, 0, Math.PI * 2);
        ctx!.fillStyle = "#0d0d18";
        ctx!.fill();
        ctx!.strokeStyle = col;
        ctx!.lineWidth = cl.status === "active" ? 1.5 + pulse : 1.5;
        ctx!.stroke();

        // Score or #
        ctx!.fillStyle = col;
        ctx!.font = `bold 9px monospace`;
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.fillText(cl.status === "done" ? `${cl.score}` : cl.status === "error" ? "ERR" : `C${i + 1}`, x, y);

        // Label
        ctx!.fillStyle = "rgba(255,255,255,0.3)";
        ctx!.font = `7px monospace`;
        ctx!.fillText(`CLAIM ${i + 1}`, x, y + R_CLAIM + 8);
      });

      // ── Agent nodes + edges ─────────────────────────────────────────────────
      AGENTS.forEach((agent) => {
        const pos = agentPos(agent);
        const ns = nodes[agent.key];
        const isActive = ns?.state === "active";
        const isDone   = ns?.state === "done";
        const isError  = ns?.state === "error";
        const hasState = !!ns;

        // Edge: Opus → Agent
        if (hasState) {
          ctx!.beginPath();
          ctx!.moveTo(OX, OY);
          ctx!.lineTo(pos.x, pos.y);

          if (isActive) {
            const offset = (ts / 15) % 20;
            ctx!.setLineDash([5, 8]);
            ctx!.lineDashOffset = -offset;
            ctx!.strokeStyle = `rgba(${hexToRgb(agent.color)},${0.4 + 0.4 * pulse})`;
            ctx!.lineWidth = 1.5;
          } else if (isDone) {
            ctx!.setLineDash([]);
            ctx!.strokeStyle = `rgba(${hexToRgb(agent.color)},0.25)`;
            ctx!.lineWidth = 1;
          } else {
            ctx!.setLineDash([]);
            ctx!.strokeStyle = `rgba(255,59,92,0.3)`;
            ctx!.lineWidth = 1;
          }
          ctx!.stroke();
          ctx!.setLineDash([]);
          ctx!.lineDashOffset = 0;
        }

        // Glow halo
        if (isActive) {
          const g = ctx!.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, R_AGENT * 3);
          g.addColorStop(0, `rgba(${hexToRgb(agent.color)},${0.2 * pulse})`);
          g.addColorStop(1, "transparent");
          ctx!.beginPath();
          ctx!.arc(pos.x, pos.y, R_AGENT * 3, 0, Math.PI * 2);
          ctx!.fillStyle = g;
          ctx!.fill();
        }

        // Node fill
        ctx!.beginPath();
        ctx!.arc(pos.x, pos.y, R_AGENT, 0, Math.PI * 2);
        ctx!.fillStyle = hasState ? "#0f0f1c" : "#0a0a14";
        ctx!.fill();

        // Border
        const borderColor = isError ? "#ff3b5c" : isDone ? agent.color : isActive ? agent.color : "rgba(255,255,255,0.1)";
        const borderWidth = isActive ? 1.5 + pulse : isDone ? 1.5 : 1;
        ctx!.strokeStyle = borderColor;
        ctx!.lineWidth = borderWidth;
        ctx!.stroke();

        // Icon
        ctx!.fillStyle = hasState ? agent.color : "rgba(255,255,255,0.2)";
        ctx!.font = `bold 13px monospace`;
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.fillText(agent.icon, pos.x, pos.y - 4);

        // Short label
        ctx!.fillStyle = hasState ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)";
        ctx!.font = `6px monospace`;
        ctx!.fillText(agent.shortLabel, pos.x, pos.y + 8);

        // Result badge below node
        if (ns?.result) {
          const bx = pos.x;
          const by = pos.y + R_AGENT + 12;
          ctx!.fillStyle = ns.state === "error" ? "rgba(255,59,92,0.15)" : `rgba(${hexToRgb(agent.color)},0.12)`;
          const tw = ctx!.measureText(ns.result).width + 8;
          ctx!.beginPath();
          roundRect(ctx!, bx - tw / 2, by - 6, tw, 12, 3);
          ctx!.fill();
          ctx!.fillStyle = ns.state === "error" ? "#ff3b5c" : agent.color;
          ctx!.font = `bold 7px monospace`;
          ctx!.textAlign = "center";
          ctx!.textBaseline = "middle";
          ctx!.fillText(ns.result, bx, by);
        }
      });

      // ── Opus orchestrator node (center) ──────────────────────────────────────
      const opusActive = toolParts.some((p) => p.state === "input-available" || p.state === "input-streaming");

      // Outer glow
      if (opusActive) {
        const g = ctx!.createRadialGradient(OX, OY, 0, OX, OY, R_OPUS * 3);
        g.addColorStop(0, `rgba(74,158,255,${0.12 * pulse})`);
        g.addColorStop(1, "transparent");
        ctx!.beginPath();
        ctx!.arc(OX, OY, R_OPUS * 3, 0, Math.PI * 2);
        ctx!.fillStyle = g;
        ctx!.fill();
      }

      // Node
      ctx!.beginPath();
      ctx!.arc(OX, OY, R_OPUS, 0, Math.PI * 2);
      ctx!.fillStyle = "#0d0d1f";
      ctx!.fill();
      ctx!.strokeStyle = opusActive ? `rgba(74,158,255,${0.7 + 0.3 * pulse})` : "rgba(74,158,255,0.5)";
      ctx!.lineWidth = opusActive ? 2 + pulse : 1.5;
      ctx!.stroke();

      // Inner ring
      ctx!.beginPath();
      ctx!.arc(OX, OY, R_OPUS - 7, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(74,158,255,0.2)";
      ctx!.lineWidth = 1;
      ctx!.stroke();

      ctx!.fillStyle = "#4a9eff";
      ctx!.font = `bold 11px monospace`;
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      ctx!.fillText("⚖", OX, OY - 6);
      ctx!.font = `bold 7px monospace`;
      ctx!.fillText("OPUS", OX, OY + 6);
      ctx!.font = `6px monospace`;
      ctx!.fillStyle = "rgba(74,158,255,0.5)";
      ctx!.fillText("orchestrator", OX, OY + 16);

      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [toolParts]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: `${CX}px`, height: `${CY}px` }}
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
