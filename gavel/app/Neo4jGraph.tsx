"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

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

// ── Shape helpers ─────────────────────────────────────────────────────────────

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 6;
    i === 0 ? ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a))
            : ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  ctx.closePath();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.44;
    i === 0 ? ctx.moveTo(x + rad * Math.cos(a), y + rad * Math.sin(a))
            : ctx.lineTo(x + rad * Math.cos(a), y + rad * Math.sin(a));
  }
  ctx.closePath();
}

function drawRoundedSquare(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const s = r * 0.84;
  ctx.beginPath();
  ctx.roundRect(x - s, y - s, s * 2, s * 2, r * 0.38);
}

const SPECIALISTS = ["runSourcer", "runJurisdictionist", "runHistorian", "runDevilsAdvocate", "runFirmMemory"];

function nodeShape(node: GNode): "hexagon" | "star" | "square" | "circle" {
  if (node.type === "orchestrator") return "hexagon";
  if (node.type === "claim" || node.label === "reportClaim") return "star";
  if (SPECIALISTS.includes(node.label)) return "square";
  return "circle";
}

function shapeBegin(ctx: CanvasRenderingContext2D, shape: string, x: number, y: number, r: number) {
  ctx.beginPath();
  if (shape === "hexagon") drawHexagon(ctx, x, y, r);
  else if (shape === "star") drawStar(ctx, x, y, r);
  else if (shape === "square") drawRoundedSquare(ctx, x, y, r);
  else ctx.arc(x, y, r, 0, Math.PI * 2);
}

const AGENT_NAMES: Record<string, string> = {
  orchestrator:        "Opus Orchestrator",
  extractClaims:       "Extract Claims",
  runSourcer:          "Citation Sourcer",
  runJurisdictionist:  "Jurisdictionist",
  runHistorian:        "Legal Historian",
  runDevilsAdvocate:   "Devil's Advocate",
  runFirmMemory:       "Firm Memory",
  deepResearch:        "Deep Research",
  reportClaim:         "Verdict",
};

const AGENT_ICONS: Record<string, string> = {
  orchestrator:        "⚖",
  extractClaims:       "◈",
  runSourcer:          "⊕",
  runJurisdictionist:  "◉",
  runHistorian:        "⊗",
  runDevilsAdvocate:   "⊘",
  runFirmMemory:       "⊙",
  deepResearch:        "⊛",
  reportClaim:         "★",
};

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
    fg.d3Force("charge")?.strength(-480);
    fg.d3Force("link")?.distance(140).strength(0.45);
    fg.d3Force("center")?.strength(0.04);
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
    const r = (node.size ?? 8) * (node.type === "orchestrator" ? 1.85 : 1);
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const color = node.color ?? "#6e6e8a";
    const isActive = node.state === "active";
    const isDone   = node.state === "done";
    const isClaim  = node.type === "claim";
    const t = Date.now();
    const shape = nodeShape(node);

    ctx.save();

    // ── Atmosphere glow ───────────────────────────────────────────────────
    if (isActive) {
      const pulse = (Math.sin(t / 260) + 1) / 2;
      const glowR = r * (3.2 + pulse * 0.7);
      const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, glowR);
      glow.addColorStop(0, color + "70");
      glow.addColorStop(0.5, color + "28");
      glow.addColorStop(1, color + "00");
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    } else if (isDone && !isClaim) {
      const subtleGlowR = r * 1.8;
      const subtleGlow = ctx.createRadialGradient(x, y, r, x, y, subtleGlowR);
      subtleGlow.addColorStop(0, color + "20");
      subtleGlow.addColorStop(1, color + "00");
      ctx.beginPath();
      ctx.arc(x, y, subtleGlowR, 0, Math.PI * 2);
      ctx.fillStyle = subtleGlow;
      ctx.fill();
    }

    // ── Orchestrator orbital rings ─────────────────────────────────────────
    if (node.type === "orchestrator") {
      const slowPulse = (Math.sin(t / 1400) + 1) / 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 6 + slowPulse * 5, 0, Math.PI * 2);
      ctx.strokeStyle = color + "48";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r + 17 + slowPulse * 3, 0, Math.PI * 2);
      ctx.strokeStyle = color + "22";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r + 28 + slowPulse, 0, Math.PI * 2);
      ctx.strokeStyle = color + "0e";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // ── Dark background fill ──────────────────────────────────────────────
    shapeBegin(ctx, shape, x, y, r);
    ctx.fillStyle = "#050511";
    ctx.fill();

    // ── Inner radial gradient (depth) ─────────────────────────────────────
    shapeBegin(ctx, shape, x, y, r);
    const innerGrad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, 0, x, y, r);
    innerGrad.addColorStop(0, color + (isClaim ? "3a" : "20"));
    innerGrad.addColorStop(1, color + "00");
    ctx.fillStyle = innerGrad;
    ctx.fill();

    // ── Claim score fill ──────────────────────────────────────────────────
    if (isClaim) {
      const score = node.score ?? 50;
      const scoreColor = score < 40 ? "#ff3b5c" : score < 70 ? "#f5a623" : "#00d98b";
      shapeBegin(ctx, shape, x, y, r);
      const scoreGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
      scoreGrad.addColorStop(0, scoreColor + "40");
      scoreGrad.addColorStop(1, scoreColor + "00");
      ctx.fillStyle = scoreGrad;
      ctx.fill();
    }

    // ── Border ────────────────────────────────────────────────────────────
    shapeBegin(ctx, shape, x, y, r);
    ctx.strokeStyle = color + (isActive ? "ee" : isDone ? "99" : "50");
    ctx.lineWidth = node.type === "orchestrator" ? 2.5 : isActive ? 2.2 : isDone ? 1.8 : 1.2;
    ctx.stroke();

    // ── Icon / score ─────────────────────────────────────────────────────
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (isClaim) {
      const score = node.score ?? "?";
      const scoreColor = typeof score === "number" && score < 40 ? "#ff7080"
        : typeof score === "number" && score < 70 ? "#ffb347" : "#4ade80";
      ctx.fillStyle = scoreColor;
      ctx.font = `bold ${Math.max(9, r * 0.72)}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(String(score), x, y - 1);
      ctx.fillStyle = scoreColor + "99";
      ctx.font = `${Math.max(5, r * 0.32)}px -apple-system, system-ui, sans-serif`;
      ctx.fillText("/100", x, y + r * 0.56);
    } else {
      const icon = AGENT_ICONS[node.label] ?? AGENT_ICONS[node.type] ?? "●";
      ctx.fillStyle = isActive ? color : isDone ? color + "dd" : color + "77";
      ctx.font = `bold ${Math.max(9, r * 0.7)}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(icon, x, y);
    }

    // ── Name label below ─────────────────────────────────────────────────
    if (globalScale > 0.25) {
      const name = isClaim ? "Claim" : (AGENT_NAMES[node.label] ?? node.label);
      const labelY = y + r + 11;
      const fontSize = Math.max(7, 9.5 / globalScale);
      ctx.font = `${isDone || isActive ? 500 : 400} ${fontSize}px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = isActive
        ? "rgba(255,255,255,0.88)"
        : isDone
          ? "rgba(255,255,255,0.65)"
          : "rgba(255,255,255,0.25)";
      ctx.fillText(name, x, labelY);
    }

    ctx.restore();
  }, []);

  const handleNodeHover = useCallback((node: GNode | null, evt?: MouseEvent) => {
    if (!node || !evt || !isFinite(evt.offsetX) || !isFinite(evt.offsetY)) {
      setTooltip(null);
      return;
    }
    setTooltip({ node, x: evt.offsetX + 14, y: evt.offsetY + 14 });
  }, []);

  const bgStyle = {
    background: "radial-gradient(ellipse at 50% 30%, #0f0f38 0%, #07071e 50%, #020209 100%)",
    backgroundImage:
      "radial-gradient(ellipse at 50% 30%, #0f0f38 0%, #07071e 50%, #020209 100%), radial-gradient(circle, #15153a 1px, transparent 1px)",
    backgroundSize: "100% 100%, 32px 32px",
  };

  if (graph.nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-5" style={bgStyle}>
        <div className="opacity-40">
          <div className="text-5xl text-blue-400 animate-pulse mb-3">⚖</div>
          <p className="text-sm text-zinc-300 font-semibold tracking-wide">Evidence Map</p>
          <p className="text-[11px] text-zinc-600 mt-1">
            {isRunning ? "Waiting for the first agent call…" : "Submit a document to begin the investigation"}
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
        onEngineStop={() => graphRef.current?.zoomToFit(500, 90)}
        nodeLabel=""
        cooldownTicks={150}
        d3AlphaDecay={0.013}
        d3VelocityDecay={0.33}
        linkDirectionalParticles={(link: any) => {
          const tgt = link.target as GNode;
          if (typeof tgt === "string") return 3;
          if (tgt.type === "claim" || tgt.label === "reportClaim") return 5;
          if (SPECIALISTS.includes(tgt.label)) return 4;
          return 3;
        }}
        linkDirectionalParticleWidth={(link: any) => {
          const tgt = link.target as GNode;
          if (typeof tgt === "string") return 2;
          if (tgt.type === "claim") return 4;
          return 2.5;
        }}
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleColor={(link: any) => {
          const tgt = link.target as GNode;
          if (typeof tgt === "string") return "#6e6e8a66";
          return (tgt.color ?? "#6e6e8a") + "bb";
        }}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={(link: any) => {
          const tgt = link.target as GNode;
          if (typeof tgt === "string") return "#6e6e8a44";
          return (tgt.color ?? "#6e6e8a") + "55";
        }}
        linkColor={(link: any) => {
          const tgt = link.target as GNode;
          if (typeof tgt === "string") return "#6e6e8a22";
          return (tgt.color ?? "#6e6e8a") + "38";
        }}
        linkWidth={1}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 rounded-2xl border border-white/10 bg-black/80 p-4 text-xs max-w-xs shadow-2xl backdrop-blur-md"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: tooltip.node.color }}
            />
            <span className="font-semibold text-sm text-white">
              {tooltip.node.type === "claim"
                ? `Score: ${tooltip.node.score ?? "?"}/100`
                : (AGENT_NAMES[tooltip.node.label] ?? tooltip.node.label)}
            </span>
          </div>
          {tooltip.node.subtitle && (
            <p className="text-zinc-300 text-[11px] mb-1.5">{tooltip.node.subtitle}</p>
          )}
          {tooltip.node.text && (
            <p className="text-zinc-500 italic text-[11px] leading-relaxed line-clamp-3">
              &ldquo;{tooltip.node.text}&rdquo;
            </p>
          )}
          {tooltip.node.score !== undefined && (
            <div className="mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${tooltip.node.score}%`,
                  backgroundColor: (tooltip.node.score ?? 0) < 40 ? "#ff3b5c"
                    : (tooltip.node.score ?? 0) < 70 ? "#f5a623" : "#00d98b",
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Live badge */}
      {isRunning && (
        <div className="absolute top-4 right-4 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-black/60 border border-blue-900/60 backdrop-blur-sm shadow-lg">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-400" />
          </span>
          <span className="text-[10px] text-blue-300 font-medium tracking-widest">Investigating</span>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 space-y-2 pointer-events-none">
        <p className="text-[8px] text-zinc-700 uppercase tracking-widest mb-1">The Investigation</p>
        {[
          { symbol: "⬡", color: "#4a9eff", label: "Orchestrator" },
          { symbol: "▪", color: "#00d98b", label: "Investigator"  },
          { symbol: "★", color: "#f5a623", label: "Finding"       },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <span className="text-sm" style={{ color: l.color }}>{l.symbol}</span>
            <span className="text-[10px] text-zinc-500">{l.label}</span>
          </div>
        ))}
        <div className="border-t border-zinc-800/50 pt-1.5">
          <span className="text-[8px] text-zinc-700">Flowing particles = live signal</span>
        </div>
      </div>
    </div>
  );
}
