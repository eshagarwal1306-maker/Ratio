"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

interface RNode {
  id: string;
  type: "query" | "api" | "source" | "finding" | "concept";
  label: string;
  color: string;
  size: number;
  state: "idle" | "active" | "done";
  detail?: string;
  x?: number;
  y?: number;
}

interface RLink {
  source: string | RNode;
  target: string | RNode;
  label: string;
  linkType: "search" | "found" | "citation" | "result";
}

const SOURCE_COLORS: Record<string, string> = {
  gmail: "#ea4335",
  harvey: "#7c3aed",
  lexis: "#0ea5e9",
  notion: "#94a3b8",
  teams: "#6264a7",
};

// ── Graph builder ─────────────────────────────────────────────────────────────

function buildGraph(toolParts: unknown[], query: string, indexedSources: string[]) {
  const nodeMap = new Map<string, RNode>();
  const links: RLink[] = [];

  function addNode(node: RNode) {
    if (nodeMap.has(node.id)) {
      const existing = nodeMap.get(node.id)!;
      if (node.state === "active" || node.state === "done") existing.state = node.state;
      if (node.detail) existing.detail = node.detail;
    } else {
      nodeMap.set(node.id, { ...node });
    }
  }

  function linkExists(src: string, tgt: string) {
    return links.some(
      (l) =>
        (l.source === src || (l.source as RNode)?.id === src) &&
        (l.target === tgt || (l.target as RNode)?.id === tgt)
    );
  }

  // Query node always present
  addNode({
    id: "query",
    type: "query",
    label: query.length > 38 ? query.slice(0, 36) + "…" : query,
    color: "#f5a623",
    size: 22,
    state: "done",
  });

  // Show pre-indexed sources as faint nodes
  for (const src of indexedSources) {
    addNode({
      id: `src-${src}`,
      type: "source",
      label: src,
      color: SOURCE_COLORS[src] ?? "#6e6e8a",
      size: 11,
      state: "idle",
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const part of toolParts as any[]) {
    const toolName = (part.type as string).replace(/^tool-/, "");
    const isDone = part.state === "output-available";
    const isActive = part.state === "input-available" || part.state === "input-streaming";
    const state: RNode["state"] = isDone ? "done" : isActive ? "active" : "idle";

    switch (toolName) {
      case "webSearch": {
        addNode({ id: "perplexity", type: "api", label: "Perplexity", color: "#22d3ee", size: 13, state });
        if (!linkExists("query", "perplexity"))
          links.push({ source: "query", target: "perplexity", label: "web search", linkType: "search" });
        break;
      }

      case "sparqlQuery": {
        addNode({ id: "cellar", type: "api", label: "EU Cellar", color: "#4ade80", size: 13, state });
        if (!linkExists("query", "cellar"))
          links.push({ source: "query", target: "cellar", label: "SPARQL", linkType: "search" });
        break;
      }

      case "fetchCellarArticle": {
        addNode({ id: "eurlex", type: "api", label: "EUR-Lex", color: "#a78bfa", size: 12, state });
        if (!linkExists("query", "eurlex"))
          links.push({ source: "query", target: "eurlex", label: "article text", linkType: "search" });
        break;
      }

      case "searchLocalDocs": {
        addNode({ id: "kb", type: "api", label: "Firm KB", color: "#818cf8", size: 13, state });
        if (!linkExists("query", "kb"))
          links.push({ source: "query", target: "kb", label: "firm memory", linkType: "search" });

        if (isDone && part.output?.results) {
          for (const doc of part.output.results) {
            const srcId = `src-${doc.source}`;
            addNode({
              id: srcId,
              type: "source",
              label: doc.source,
              color: SOURCE_COLORS[doc.source] ?? "#6e6e8a",
              size: 11,
              state: "done",
              detail: doc.snippet?.slice(0, 80),
            });
            if (!linkExists("kb", srcId))
              links.push({ source: "kb", target: srcId, label: "", linkType: "found" });
          }
        }
        break;
      }

      case "addCitation": {
        if (isDone && part.output) {
          const fid = `finding-${part.toolCallId ?? Math.random()}`;
          addNode({
            id: fid,
            type: "finding",
            label: (part.output.title as string)?.slice(0, 28) ?? "Finding",
            color: "#f59e0b",
            size: 15,
            state: "done",
            detail: part.output.finding as string,
          });

          const srcs: string[] = Array.isArray(part.output.sources) ? part.output.sources : [];
          if (srcs.length === 0) {
            links.push({ source: "query", target: fid, label: "finding", linkType: "citation" });
          } else {
            for (const s of srcs) {
              const candidates = [`src-${s}`, s, "perplexity", "kb"];
              const src = candidates.find((c) => nodeMap.has(c)) ?? "query";
              links.push({ source: src, target: fid, label: "cited", linkType: "citation" });
            }
          }
        }
        break;
      }
    }
  }

  return { nodes: Array.from(nodeMap.values()), links };
}

// ── Canvas helpers ─────────────────────────────────────────────────────────────

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
    const rad = i % 2 === 0 ? r : r * 0.42;
    i === 0 ? ctx.moveTo(x + rad * Math.cos(a), y + rad * Math.sin(a))
             : ctx.lineTo(x + rad * Math.cos(a), y + rad * Math.sin(a));
  }
  ctx.closePath();
}

function drawRoundedSquare(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const s = r * 0.82;
  ctx.beginPath();
  ctx.roundRect(x - s, y - s, s * 2, s * 2, r * 0.35);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ResearchGraphProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolParts: any[];
  query: string;
  isRunning: boolean;
  indexedSources: string[];
}

export function ResearchGraph({ toolParts, query, isRunning, indexedSources }: ResearchGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const [dims, setDims] = useState({ w: 900, h: 600 });
  const [tooltip, setTooltip] = useState<{ node: RNode; x: number; y: number } | null>(null);

  const graph = useMemo(
    () => buildGraph(toolParts, query || "Research Query", indexedSources),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toolParts.length, query, indexedSources.join(",")]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: width, h: height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Configure d3 forces for radial spread
  useEffect(() => {
    if (!graphRef.current || graph.nodes.length === 0) return;
    const fg = graphRef.current;
    fg.d3Force("charge")?.strength(-600);
    fg.d3Force("link")?.distance(130).strength(0.6);
    fg.d3Force("center")?.strength(0.08);
  }, [graph.nodes.length]);

  const paintNode = useCallback((node: RNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const r = node.size;
    const color = node.color;
    const isActive = node.state === "active";
    const isDone = node.state === "done";
    const t = Date.now();

    ctx.save();

    // Outer animated glow ring for active nodes
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

    // Extra ring for query node
    if (node.type === "query") {
      const pulse = (Math.sin(t / 900) + 1) / 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 6 + pulse * 3, 0, Math.PI * 2);
      ctx.strokeStyle = color + "30";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r + 12 + pulse * 2, 0, Math.PI * 2);
      ctx.strokeStyle = color + "15";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Node shape fill
    ctx.beginPath();
    switch (node.type) {
      case "query":   drawHexagon(ctx, x, y, r); break;
      case "finding": drawStar(ctx, x, y, r); break;
      case "source":  drawRoundedSquare(ctx, x, y, r); break;
      default:        ctx.arc(x, y, r, 0, Math.PI * 2);
    }

    // Fill with dark background
    ctx.fillStyle = "#080818";
    ctx.fill();

    // Stroke border
    ctx.strokeStyle = color;
    ctx.lineWidth = node.type === "query" ? 2.5 : isActive ? 2.2 : isDone ? 1.8 : 1;
    ctx.stroke();

    // Icon inside node
    const icons: Record<string, string> = {
      query: "◎", api: "⊛", source: "⊡", finding: "★", concept: "◈",
    };
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.max(8, r * 0.65)}px monospace`;
    ctx.fillText(icons[node.type] ?? "○", x, y);

    // Label below node
    if (globalScale > 0.35) {
      ctx.fillStyle = isDone || isActive ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.2)";
      const fontSize = Math.max(6, 8.5 / globalScale);
      ctx.font = `${fontSize}px monospace`;
      ctx.fillText(node.label, x, y + r + (node.type === "source" ? r * 0.9 : r * 0.7) + 4);
    }

    ctx.restore();
  }, []);

  const handleNodeHover = useCallback((node: RNode | null, evt?: MouseEvent) => {
    if (!node || !evt) { setTooltip(null); return; }
    setTooltip({ node, x: evt.offsetX + 14, y: evt.offsetY + 14 });
  }, []);

  if (!query && graph.nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center opacity-25 space-y-4">
        <div className="text-4xl text-amber-400 animate-pulse">◎</div>
        <p className="text-xs text-zinc-400 font-mono tracking-widest uppercase">Enter a research query to begin</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{
        background: "radial-gradient(ellipse at 50% 40%, #0d0d2e 0%, #030308 65%)",
        backgroundImage: "radial-gradient(ellipse at 50% 40%, #0d0d2e 0%, #030308 65%), radial-gradient(circle, #1a1a3a 1px, transparent 1px)",
        backgroundSize: "100% 100%, 28px 28px",
      }}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ForceGraph2D
        ref={graphRef}
        width={dims.w}
        height={dims.h}
        graphData={graph as any}
        backgroundColor="transparent"
        nodeCanvasObject={paintNode as any}
        nodeCanvasObjectMode={() => "replace"}
        linkCanvasObjectMode={() => "after"}
        nodeLabel=""
        onNodeHover={handleNodeHover as any}
        onEngineStop={() => graphRef.current?.zoomToFit(500, 100)}
        cooldownTicks={180}
        d3AlphaDecay={0.012}
        d3VelocityDecay={0.38}
        // ── Particles (the fancy bit) ──────────────────────────────────────
        linkDirectionalParticles={(link: any) => {
          const lt = (link as RLink).linkType;
          if (lt === "citation") return 4;
          if (lt === "search") return 5;
          if (lt === "found") return 3;
          return 2;
        }}
        linkDirectionalParticleWidth={(link: any) => {
          const lt = (link as RLink).linkType;
          return lt === "citation" ? 3.5 : lt === "search" ? 2.5 : 2;
        }}
        linkDirectionalParticleSpeed={(link: any) => {
          const lt = (link as RLink).linkType;
          return lt === "search" ? 0.006 : lt === "citation" ? 0.004 : 0.003;
        }}
        linkDirectionalParticleColor={(link: any) => {
          const lt = (link as RLink).linkType;
          const tgt = (link as RLink).target;
          const color = typeof tgt === "string" ? "#f5a623" : (tgt as RNode).color;
          return lt === "citation" ? color + "ee" : lt === "search" ? color + "cc" : color + "88";
        }}
        linkColor={(link: any) => {
          const lt = (link as RLink).linkType;
          const tgt = typeof (link as RLink).target === "string"
            ? undefined
            : ((link as RLink).target as RNode);
          const color = tgt?.color ?? "#6e6e8a";
          return lt === "citation" ? color + "55" : lt === "search" ? color + "44" : color + "28";
        }}
        linkWidth={(link: any) => {
          return (link as RLink).linkType === "citation" ? 1.5 : 1;
        }}
        linkLineDash={(link: any) => {
          return (link as RLink).linkType === "found" ? [4, 6] : null;
        }}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 rounded-xl border border-zinc-700/60 bg-zinc-900/95 p-3 text-xs shadow-2xl max-w-xs backdrop-blur-sm"
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
          {tooltip.node.detail && (
            <p className="text-[11px] text-zinc-400 leading-relaxed">{tooltip.node.detail}</p>
          )}
        </div>
      )}

      {/* Live indicator */}
      {isRunning && (
        <div className="absolute top-3 right-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/50 border border-zinc-800 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
          </span>
          <span className="text-[9px] text-amber-400 font-mono tracking-widest">RESEARCHING</span>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 space-y-1 pointer-events-none">
        {[
          { shape: "hexagon", color: "#f5a623", label: "Query" },
          { shape: "circle",  color: "#22d3ee", label: "API source" },
          { shape: "square",  color: "#ea4335", label: "Firm document" },
          { shape: "star",    color: "#f59e0b", label: "Finding" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
            <span className="text-[9px] text-zinc-600">{l.label}</span>
          </div>
        ))}
        <div className="mt-1 border-t border-zinc-800 pt-1">
          <span className="text-[8px] text-zinc-700">Particles = live research flow</span>
        </div>
      </div>
    </div>
  );
}
