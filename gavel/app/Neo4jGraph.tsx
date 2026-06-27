"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

interface GNode {
  id: string;
  label: string;
  type: "orchestrator" | "tool" | "claim";
  color: string;
  size: number;
  state?: string;
  subtitle?: string;
  score?: number;
  text?: string;
  x?: number;
  y?: number;
}

interface GLink {
  source: string | GNode;
  target: string | GNode;
  label: string;
}

interface GraphData {
  nodes: GNode[];
  links: GLink[];
}

// ── Canvas shape helpers (same vocabulary as ResearchGraph) ───────────────────

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 6;
    i === 0
      ? ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a))
      : ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  ctx.closePath();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.42;
    i === 0
      ? ctx.moveTo(x + rad * Math.cos(a), y + rad * Math.sin(a))
      : ctx.lineTo(x + rad * Math.cos(a), y + rad * Math.sin(a));
  }
  ctx.closePath();
}

function drawRoundedSquare(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const s = r * 0.82;
  ctx.beginPath();
  ctx.roundRect(x - s, y - s, s * 2, s * 2, r * 0.35);
}

const SPECIALISTS = ["runSourcer", "runJurisdictionist", "runHistorian", "runDevilsAdvocate", "runFirmMemory"];
const CLAIM_TOOLS = ["reportClaim"];

function nodeShape(node: GNode): "hexagon" | "star" | "square" | "circle" {
  if (node.type === "orchestrator") return "hexagon";
  if (node.type === "claim" || CLAIM_TOOLS.includes(node.label)) return "star";
  if (SPECIALISTS.includes(node.label)) return "square";
  return "circle";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Neo4jGraph({ isRunning }: { isRunning: boolean }) {
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [tooltip, setTooltip] = useState<{ node: GNode; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const [dims, setDims] = useState({ w: 800, h: 500 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: width, h: height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!graphRef.current || graph.nodes.length === 0) return;
    const fg = graphRef.current;
    fg.d3Force("charge")?.strength(-420);
    fg.d3Force("link")?.distance(130).strength(0.5);
    fg.d3Force("center")?.strength(0.05);
  }, [graph.nodes.length]);

  useEffect(() => {
    async function fetch_() {
      const res = await fetch("/api/graph");
      const data: GraphData = await res.json();
      if (data.nodes?.length) setGraph(data);
    }
    fetch_();
    if (!isRunning) return;
    const id = setInterval(fetch_, 2500);
    return () => clearInterval(id);
  }, [isRunning]);

  const paintNode = useCallback((node: GNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const r = (node.size ?? 8) * (node.type === "orchestrator" ? 1.6 : 1);
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const color = node.color ?? "#6e6e8a";
    const isActive = node.state === "active";
    const isDone   = node.state === "done";
    const t = Date.now();
    const shape = nodeShape(node);

    ctx.save();

    // Radial glow for active nodes
    if (isActive) {
      const pulse = (Math.sin(t / 280) + 1) / 2;
      const glowR = r * (2.8 + pulse * 0.8);
      const grad = ctx.createRadialGradient(x, y, r * 0.5, x, y, glowR);
      grad.addColorStop(0, color + "77");
      grad.addColorStop(1, color + "00");
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Dual animated rings for orchestrator
    if (node.type === "orchestrator") {
      const pulse = (Math.sin(t / 900) + 1) / 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 6 + pulse * 3, 0, Math.PI * 2);
      ctx.strokeStyle = color + "35";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r + 14 + pulse * 2, 0, Math.PI * 2);
      ctx.strokeStyle = color + "18";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Shape fill
    ctx.beginPath();
    switch (shape) {
      case "hexagon": drawHexagon(ctx, x, y, r); break;
      case "star":    drawStar(ctx, x, y, r);    break;
      case "square":  drawRoundedSquare(ctx, x, y, r); break;
      default:        ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = "#080818";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = node.type === "orchestrator" ? 2.5 : isActive ? 2.2 : isDone ? 1.8 : 1.2;
    ctx.stroke();

    // Icon
    const icons: Record<string, string> = {
      orchestrator: "⚖",
      extractClaims: "◈", runSourcer: "⊕",
      runJurisdictionist: "◉", runHistorian: "⊗",
      runDevilsAdvocate: "⊘", runFirmMemory: "⊙",
      deepResearch: "⊛", reportClaim: "⊞",
    };
    const icon = node.type === "claim"
      ? String(node.score ?? "?")
      : icons[node.label] ?? "○";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.font = `bold ${node.type === "orchestrator" ? Math.max(10, r * 0.7) : Math.max(8, r * 0.65)}px monospace`;
    ctx.fillText(icon, x, y - 2);

    // Sub-text inside node
    const shortLabels: Record<string, string> = {
      orchestrator: "OPUS", extractClaims: "EXTRACT", runSourcer: "SOURCER",
      runJurisdictionist: "JX", runHistorian: "HIST",
      runDevilsAdvocate: "DEVIL", runFirmMemory: "MEM",
      deepResearch: "SEARCH", reportClaim: "REPORT",
    };
    const sub = node.type === "claim" ? "CLAIM" : (shortLabels[node.label] ?? node.label.slice(0, 6).toUpperCase());
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.font = `${Math.max(5, r * 0.38)}px monospace`;
    ctx.fillText(sub, x, y + r * 0.52);

    // Subtitle badge
    if (node.subtitle && globalScale > 0.6) {
      const bw = ctx.measureText(node.subtitle).width + 8;
      const bh = 11;
      const bx = x - bw / 2;
      const by = y + r + 5;
      ctx.fillStyle = color + "22";
      ctx.strokeStyle = color + "55";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = "bold 6px monospace";
      ctx.textAlign = "center";
      ctx.fillText(node.subtitle, x, by + bh / 2);
    }

    // Full label below node
    const fullNames: Record<string, string> = {
      orchestrator: "OPUS", extractClaims: "Extract Claims",
      runSourcer: "Sourcer", runJurisdictionist: "Jurisdictionist",
      runHistorian: "Historian", runDevilsAdvocate: "Devil's Advocate",
      runFirmMemory: "Firm Memory", deepResearch: "Deep Research",
      reportClaim: "Report Claim",
    };
    const fullName = node.type === "claim"
      ? `Score: ${node.score}/100`
      : (fullNames[node.label] ?? node.label);
    const labelY = y + r + (node.subtitle ? 22 : 12);
    ctx.fillStyle = isDone || isActive ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)";
    ctx.font = `${Math.max(6, 8 / globalScale)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(fullName, x, labelY);

    ctx.restore();
  }, []);

  const handleNodeHover = useCallback((node: GNode | null, evt?: MouseEvent) => {
    if (!node || !evt || !isFinite(evt.offsetX) || !isFinite(evt.offsetY)) {
      setTooltip(null);
      return;
    }
    setTooltip({ node, x: evt.offsetX + 12, y: evt.offsetY + 12 });
  }, []);

  const bgStyle = {
    background: "radial-gradient(ellipse at 50% 40%, #0d0d2e 0%, #030308 65%)",
    backgroundImage:
      "radial-gradient(ellipse at 50% 40%, #0d0d2e 0%, #030308 65%), radial-gradient(circle, #1a1a3a 1px, transparent 1px)",
    backgroundSize: "100% 100%, 28px 28px",
  };

  if (graph.nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-4" style={bgStyle}>
        <div className="text-4xl text-blue-500 animate-pulse">◌</div>
        <div className="space-y-1">
          <p className="text-xs text-zinc-300 font-mono tracking-widest">NEO4J AGENT GRAPH</p>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
            {isRunning ? "Waiting for first agent call…" : "Run an audit to populate the graph"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full" style={bgStyle}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ForceGraph2D
        ref={graphRef}
        width={dims.w}
        height={dims.h}
        graphData={graph as any}
        backgroundColor="transparent"
        nodeCanvasObject={paintNode as any}
        nodeCanvasObjectMode={() => "replace"}
        onNodeHover={handleNodeHover as any}
        onEngineStop={() => graphRef.current?.zoomToFit(400, 80)}
        nodeLabel=""
        cooldownTicks={150}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.35}
        linkDirectionalParticles={(link: any) => {
          const tgt = link.target as GNode;
          if (typeof tgt === "string") return 3;
          if (tgt.type === "claim") return 4;
          if (SPECIALISTS.includes(tgt.label)) return 5;
          if (CLAIM_TOOLS.includes(tgt.label)) return 4;
          return 3;
        }}
        linkDirectionalParticleWidth={(link: any) => {
          const tgt = link.target as GNode;
          if (typeof tgt === "string") return 2;
          if (tgt.type === "claim" || CLAIM_TOOLS.includes(tgt.label)) return 3.5;
          return 2.5;
        }}
        linkDirectionalParticleSpeed={0.0045}
        linkDirectionalParticleColor={(link: any) => {
          const tgt = link.target as GNode;
          if (typeof tgt === "string") return "#6e6e8a88";
          return (tgt.color ?? "#6e6e8a") + "cc";
        }}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={(link: any) => {
          const tgt = link.target as GNode;
          if (typeof tgt === "string") return "#6e6e8a55";
          return (tgt.color ?? "#6e6e8a") + "66";
        }}
        linkColor={(link: any) => {
          const tgt = link.target as GNode;
          if (typeof tgt === "string") return "#6e6e8a28";
          return (tgt.color ?? "#6e6e8a") + "40";
        }}
        linkWidth={1.2}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 rounded-xl border border-zinc-700/60 bg-zinc-900/95 p-3 text-xs max-w-xs shadow-2xl backdrop-blur-sm"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-bold text-sm" style={{ color: tooltip.node.color }}>
              {tooltip.node.label}
            </span>
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest border border-zinc-700 px-1 rounded">
              {tooltip.node.type}
            </span>
          </div>
          {tooltip.node.subtitle && (
            <p className="text-zinc-300 mb-1">{tooltip.node.subtitle}</p>
          )}
          {tooltip.node.text && (
            <p className="text-zinc-500 italic text-[11px] leading-relaxed line-clamp-3">
              &ldquo;{tooltip.node.text}&rdquo;
            </p>
          )}
          {tooltip.node.score !== undefined && (
            <p className="mt-1 font-bold" style={{ color: tooltip.node.color }}>
              Score: {tooltip.node.score}/100
            </p>
          )}
        </div>
      )}

      {/* Live indicator */}
      {isRunning && (
        <div className="absolute top-3 right-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/50 border border-zinc-800 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
          </span>
          <span className="text-[9px] text-blue-400 font-mono tracking-widest">AUDITING</span>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 space-y-1.5 pointer-events-none">
        {[
          { color: "#4a9eff", label: "Orchestrator",     shape: "⬡" },
          { color: "#00d98b", label: "Specialist Agent", shape: "▪" },
          { color: "#f5a623", label: "Claim / Report",   shape: "★" },
          { color: "#6e6e8a", label: "Other tool",       shape: "●" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <span className="text-[10px] shrink-0" style={{ color: l.color }}>{l.shape}</span>
            <span className="text-[9px] text-zinc-600">{l.label}</span>
          </div>
        ))}
        <div className="border-t border-zinc-800 pt-1 mt-1">
          <span className="text-[8px] text-zinc-700">Particles = live agent data flow</span>
        </div>
      </div>
    </div>
  );
}
