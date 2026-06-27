"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

// react-force-graph-2d has no SSR support
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

// ─── Types matching our /api/graph response ───────────────────────────────────

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
  // injected by force-graph at runtime:
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

// ─── Component ────────────────────────────────────────────────────────────────

export function Neo4jGraph({ isRunning }: { isRunning: boolean }) {
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [tooltip, setTooltip] = useState<{ node: GNode; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const [dims, setDims] = useState({ w: 800, h: 500 });

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: width, h: height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Configure d3 forces for better node spread when graph data loads
  useEffect(() => {
    if (!graphRef.current || graph.nodes.length === 0) return;
    const fg = graphRef.current;
    fg.d3Force("charge")?.strength(-350);
    fg.d3Force("link")?.distance(100).strength(0.5);
    fg.d3Force("center")?.strength(0.05);
  }, [graph.nodes.length]);

  // Poll /api/graph while running — server tracks latest auditId
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

  // Custom node canvas painter
  const paintNode = useCallback((node: GNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const r = (node.size ?? 8) * (node.type === "orchestrator" ? 1.6 : 1);
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const color = node.color ?? "#6e6e8a";
    const isActive = node.state === "active";
    const time = Date.now();

    // Animated glow ring for active nodes
    if (isActive) {
      const pulse = (Math.sin(time / 350) + 1) / 2;
      const glowR = r * (2 + pulse);
      const grad = ctx.createRadialGradient(x, y, r, x, y, glowR);
      grad.addColorStop(0, color + "55");
      grad.addColorStop(1, color + "00");
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, 2 * Math.PI);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Outer ring for orchestrator
    if (node.type === "orchestrator") {
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, 2 * Math.PI);
      ctx.strokeStyle = color + "40";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Node circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = "#0d0d1f";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = node.type === "orchestrator" ? 2 : isActive ? 2 : 1.5;
    ctx.stroke();

    // Icon / label inside
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const icons: Record<string, string> = {
      orchestrator: "⚖",
      extractClaims: "◈",
      runSourcer: "⊕",
      runJurisdictionist: "◉",
      runHistorian: "⊗",
      runDevilsAdvocate: "⊘",
      runFirmMemory: "⊙",
      deepResearch: "⊛",
      reportClaim: "⊞",
    };
    const icon = node.type === "claim"
      ? String(node.score ?? "?")
      : icons[node.label] ?? icons[node.type] ?? "○";

    ctx.fillStyle = color;
    ctx.font = `bold ${node.type === "orchestrator" ? Math.max(10, r * 0.7) : Math.max(8, r * 0.65)}px monospace`;
    ctx.fillText(icon, x, y - (node.type === "orchestrator" ? 3 : 2));

    // Sub label
    const shortLabel: Record<string, string> = {
      orchestrator: "OPUS", extractClaims: "EXTRACT", runSourcer: "SOURCER",
      runJurisdictionist: "JX", runHistorian: "HIST", runDevilsAdvocate: "DEVIL",
      runFirmMemory: "MEM", deepResearch: "SEARCH", reportClaim: "REPORT",
    };
    const sub = node.type === "claim" ? "CLAIM" : (shortLabel[node.label] ?? node.label.slice(0, 6).toUpperCase());
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `${Math.max(5, r * 0.4)}px monospace`;
    ctx.fillText(sub, x, y + r * 0.5);

    // Subtitle badge below node
    if (node.subtitle && globalScale > 0.6) {
      const bw = ctx.measureText(node.subtitle).width + 8;
      const bh = 11;
      const bx = x - bw / 2;
      const by = y + r + 4;
      ctx.fillStyle = color + "22";
      ctx.strokeStyle = color + "66";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = `bold 6px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(node.subtitle, x, by + bh / 2);
    }

    // Full name label below everything
    const fullNames: Record<string, string> = {
      orchestrator: "OPUS", extractClaims: "Extract Claims", runSourcer: "Sourcer",
      runJurisdictionist: "Jurisdictionist", runHistorian: "Historian",
      runDevilsAdvocate: "Devil's Advocate", runFirmMemory: "Firm Memory",
      deepResearch: "Deep Research", reportClaim: "Report Claim",
    };
    const fullName = node.type === "claim"
      ? `Score: ${node.score}/100`
      : (fullNames[node.label] ?? node.label);
    const labelY = y + r + (node.subtitle ? 20 : 10);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `${Math.max(6, 8 / globalScale)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(fullName, x, labelY);
  }, []);

  // Link canvas painter — animated dashed lines for active edges, solid for done
  const paintLink = useCallback((link: GLink, ctx: CanvasRenderingContext2D) => {
    const src = link.source as GNode;
    const tgt = link.target as GNode;
    // source/target can still be string IDs before force-sim resolves them
    if (typeof src === "string" || typeof tgt === "string") return;
    if (src.x === undefined || tgt.x === undefined) return;

    const isActive = tgt.state === "active";
    const color = tgt.color ?? "#6e6e8a";
    const sx = src.x!; const sy = src.y!;
    const tx = tgt.x!; const ty = tgt.y!;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);

    if (isActive) {
      const offset = (Date.now() / 20) % 20;
      ctx.setLineDash([5, 8]);
      ctx.lineDashOffset = -offset;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = color + "70";
      ctx.lineWidth = 1.5;
    }
    ctx.stroke();

    // Draw arrowhead at target end
    const dx = tx - sx;
    const dy = ty - sy;
    const angle = Math.atan2(dy, dx);
    const targetR = (tgt.size ?? 8) + 3;
    const ax = tx - Math.cos(angle) * targetR;
    const ay = ty - Math.sin(angle) * targetR;
    const arrLen = 7;
    const arrSpread = 0.45;

    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - arrLen * Math.cos(angle - arrSpread), ay - arrLen * Math.sin(angle - arrSpread));
    ctx.lineTo(ax - arrLen * Math.cos(angle + arrSpread), ay - arrLen * Math.sin(angle + arrSpread));
    ctx.closePath();
    ctx.fillStyle = isActive ? color : color + "70";
    ctx.fill();

    ctx.restore();
  }, []);

  const handleNodeHover = useCallback((node: GNode | null, evt?: MouseEvent) => {
    if (!node || !evt) { setTooltip(null); return; }
    setTooltip({ node, x: evt.offsetX + 12, y: evt.offsetY + 12 });
  }, []);

  if (graph.nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-4">
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
    <div ref={containerRef} className="relative w-full h-full bg-[#040408]">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ForceGraph2D
        ref={graphRef}
        width={dims.w}
        height={dims.h}
        graphData={graph as any}
        backgroundColor="#040408"
        nodeCanvasObject={paintNode as any}
        nodeCanvasObjectMode={() => "replace"}
        linkCanvasObject={paintLink as any}
        linkCanvasObjectMode={() => "replace"}
        onNodeHover={handleNodeHover as any}
        onEngineStop={() => graphRef.current?.zoomToFit(400, 80)}
        nodeLabel=""
        cooldownTicks={150}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.35}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 rounded-lg border border-zinc-700 bg-zinc-900/95 p-3 text-xs max-w-xs shadow-xl"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-bold text-sm" style={{ color: tooltip.node.color }}>
              {tooltip.node.label}
            </span>
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest">
              {tooltip.node.type}
            </span>
          </div>
          {tooltip.node.subtitle && (
            <p className="text-zinc-300 mb-1">{tooltip.node.subtitle}</p>
          )}
          {tooltip.node.text && (
            <p className="text-zinc-500 italic text-[11px] leading-relaxed line-clamp-3">
              "{tooltip.node.text}"
            </p>
          )}
          {tooltip.node.score !== undefined && (
            <p className="mt-1 font-bold" style={{ color: tooltip.node.color }}>
              Score: {tooltip.node.score}/100
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 space-y-1 pointer-events-none">
        {[
          { color: "#4a9eff", label: "Opus Orchestrator" },
          { color: "#00d98b", label: "Specialist Agent" },
          { color: "#ff3b5c", label: "Claim (score < 40)" },
          { color: "#f5a623", label: "Claim (score 40–70)" },
          { color: "#00d98b", label: "Claim (score 70+)" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
            <span className="text-[9px] text-zinc-600">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
