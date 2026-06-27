"use client";

import { useEffect, useRef, useState } from "react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  parchment: "#f2efe8",
  white: "#ffffff",
  ink: "#0d0d0d",
  inkMid: "#555555",
  inkFaint: "#999999",
  border: "#ddd9d1",
  borderLight: "#ebe8e0",
  red: "#c41e1e",
  redBg: "#fef2f2",
  redBorder: "#fca5a5",
  amber: "#854d0e",
  amberBg: "#fffbeb",
  amberBorder: "#fde68a",
  navyBtn: "#0d1f3c",
  navyDark: "#070f1e",
};

// ── Intersection observer hook ────────────────────────────────────────────────

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ── Animated counter ──────────────────────────────────────────────────────────

function AnimatedNumber({
  end, prefix = "", suffix = "", decimals = 0, duration = 1800, trigger,
}: {
  end: number; prefix?: string; suffix?: string;
  decimals?: number; duration?: number; trigger: boolean;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let start: number | null = null;
    function frame(ts: number) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(eased * end);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }, [trigger, end, duration]);
  const display = decimals > 0 ? val.toFixed(decimals) : Math.floor(val).toLocaleString();
  return <>{prefix}{display}{suffix}</>;
}

// ── Growth line chart ─────────────────────────────────────────────────────────

const CHART_DATA = [
  { year: "2019", value: 4,    label: "4",      projected: false },
  { year: "2020", value: 12,   label: "12",     projected: false },
  { year: "2021", value: 38,   label: "38",     projected: false },
  { year: "2022", value: 94,   label: "94",     projected: false },
  { year: "2023", value: 267,  label: "267",    projected: false },
  { year: "2024", value: 680,  label: "680",    projected: false },
  { year: "2025", value: 1400, label: "1,400+", projected: true  },
];

function GrowthChart({ inView }: { inView: boolean }) {
  const MAX = 1400;
  const VW = 700; const VH = 220;
  const PAD = { top: 32, right: 20, bottom: 44, left: 20 };
  const cW = VW - PAD.left - PAD.right;
  const cH = VH - PAD.top - PAD.bottom;

  const pts = CHART_DATA.map((d, i) => ({
    x: PAD.left + (i / (CHART_DATA.length - 1)) * cW,
    y: PAD.top + (1 - d.value / MAX) * cH,
    ...d,
  }));

  // Smooth cubic bezier path
  const pathD = pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const mx = (prev.x + p.x) / 2;
    return `${acc} C ${mx.toFixed(1)} ${prev.y.toFixed(1)} ${mx.toFixed(1)} ${p.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }, "");

  const lastPt = pts[pts.length - 1];
  const firstPt = pts[0];
  const areaD = `${pathD} L ${lastPt.x} ${PAD.top + cH} L ${firstPt.x} ${PAD.top + cH} Z`;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", height: VH, display: "block" }}>
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b5a8a" />
          <stop offset="70%" stopColor="#b83030" />
          <stop offset="100%" stopColor="#c41e1e" />
        </linearGradient>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c41e1e" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#c41e1e" stopOpacity="0" />
        </linearGradient>
        <clipPath id="lineClip">
          <rect
            x={PAD.left} y={PAD.top - 2}
            height={cH + 4}
            width={inView ? cW : 0}
            style={{ transition: inView ? "width 2s cubic-bezier(0.4,0,0.2,1)" : "none" }}
          />
        </clipPath>
      </defs>

      {/* Horizontal gridlines */}
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const y = PAD.top + (1 - f) * cH;
        return (
          <line key={f} x1={PAD.left} y1={y} x2={PAD.left + cW} y2={y}
            stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        );
      })}

      {/* Area fill */}
      <path d={areaD} fill="url(#areaGrad)"
        opacity={inView ? 1 : 0}
        style={{ transition: "opacity 0.8s ease 1.5s" }} />

      {/* Line with clip reveal */}
      <g clipPath="url(#lineClip)">
        <path d={pathD} fill="none" stroke="url(#lineGrad)"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Dots */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.projected ? 4 : 3.5}
          fill={p.projected ? "#c41e1e" : "#e06060"}
          stroke={p.projected ? "rgba(196,30,30,0.3)" : "transparent"}
          strokeWidth="6"
          opacity={inView ? 1 : 0}
          style={{ transition: `opacity 0.25s ease ${0.3 + i * 0.22}s` }}
        />
      ))}

      {/* Value labels above dots */}
      {pts.map((p, i) => (
        <text key={i}
          x={p.x} y={p.y - 10}
          textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}
          fontSize="10" fontWeight="700"
          fill={p.projected ? "#e06060" : "rgba(255,255,255,0.55)"}
          opacity={inView ? 1 : 0}
          style={{ transition: `opacity 0.25s ease ${0.5 + i * 0.22}s` }}
        >
          {p.label}
        </text>
      ))}

      {/* X-axis labels */}
      {pts.map((p, i) => (
        <text key={i} x={p.x} y={VH - 6}
          textAnchor="middle" fontSize="10"
          fill={p.projected ? "rgba(196,30,30,0.7)" : "rgba(255,255,255,0.3)"}
        >
          {p.year}{p.projected ? "*" : ""}
        </text>
      ))}

      {/* Projected annotation */}
      <text x={lastPt.x - 2} y={PAD.top + 14}
        textAnchor="end" fontSize="9"
        fill="rgba(196,30,30,0.5)"
        opacity={inView ? 1 : 0}
        style={{ transition: "opacity 0.4s ease 2s" }}
      >
        *projected
      </text>
    </svg>
  );
}

// ── Why RATIO section ─────────────────────────────────────────────────────────

const STATS = [
  { end: 23,  prefix: "",  suffix: "%",  decimals: 0, label: "of AI-generated legal citations contain a material error",  src: "Stanford CodeX, 2024" },
  { end: 2.4, prefix: "£", suffix: "M",  decimals: 1, label: "average professional negligence claim tied to citation errors", src: "SRA Risk Report, 2023" },
  { end: 73,  prefix: "",  suffix: "%",  decimals: 0, label: "of law firms now use AI to draft client-facing documents",  src: "Legal Technology Survey, 2024" },
  { end: 580, prefix: "",  suffix: "%",  decimals: 0, label: "increase in AI-related malpractice complaints since 2020",    src: "LegelTech Monitor, 2025" },
];

function WhyRATIO() {
  const { ref, inView } = useInView(0.15);

  return (
    <section ref={ref} style={{
      background: T.navyDark,
      padding: "80px 56px",
      borderTop: `1px solid rgba(255,255,255,0.04)`,
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 52 }}>
          <p style={{
            fontSize: 10, fontWeight: 700, color: "rgba(196,30,30,0.8)",
            letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14,
          }}>
            Why RATIO
          </p>
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(24px, 2.8vw, 40px)",
            fontWeight: 700, color: "#f0f4f8",
            letterSpacing: "-0.02em", lineHeight: 1.15, marginBottom: 14,
          }}>
            AI is writing legal memos.<br />
            <span style={{ color: "rgba(255,255,255,0.35)" }}>The errors are accelerating.</span>
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", maxWidth: 480, lineHeight: 1.7 }}>
            Documented incidents of AI-generated legal errors — wrong citations, phantom statutes,
            misapplied jurisdiction — are growing exponentially. The profession has not caught up.
          </p>
        </div>

        {/* Chart */}
        <div style={{ marginBottom: 16 }}>
          <p style={{
            fontSize: 10, color: "rgba(255,255,255,0.25)",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16,
          }}>
            Documented AI-related legal incidents reported globally
          </p>
          <GrowthChart inView={inView} />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "48px 0" }} />

        {/* Animated stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32 }}>
          {STATS.map((s, i) => (
            <div key={i}>
              <p style={{
                fontFamily: "Georgia, serif",
                fontSize: "clamp(32px, 3vw, 44px)",
                fontWeight: 700, color: "#f0f4f8",
                letterSpacing: "-0.03em", marginBottom: 8, lineHeight: 1,
              }}>
                <AnimatedNumber
                  end={s.end} prefix={s.prefix} suffix={s.suffix}
                  decimals={s.decimals} trigger={inView}
                  duration={1600 + i * 120}
                />
              </p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.55, marginBottom: 8 }}>
                {s.label}
              </p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
                {s.src}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

// ── Document preview (hero) ───────────────────────────────────────────────────

const HIGHLIGHTS = [
  { badge: "NOT FOUND",         type: "red" as const, delay: 700 },
  { badge: "WRONG JURISDICTION",type: "red" as const, delay: 1500 },
  { badge: "AMENDED",           type: "amb" as const, delay: 2300 },
  { badge: "HIGH RISK",         type: "red" as const, delay: 3100 },
];

function DocPreview() {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timers = HIGHLIGHTS.map((h, i) => setTimeout(() => setShown(i + 1), h.delay + 200));
    return () => timers.forEach(clearTimeout);
  }, []);

  function Hi({ idx, children }: { idx: number; children: string }) {
    const h = HIGHLIGHTS[idx];
    const visible = shown > idx;
    const isRed = h.type === "red";
    return (
      <span>
        <span style={{
          backgroundColor: visible ? (isRed ? "#fee2e2" : "#fef9c3") : "transparent",
          borderRadius: 2, padding: "1px 2px",
          transition: "background-color 0.5s ease",
        }}>{children}</span>
        {visible && (
          <span style={{
            display: "inline-block", fontSize: 9, fontWeight: 700,
            padding: "1px 6px", borderRadius: 3,
            background: isRed ? T.redBg : T.amberBg,
            color: isRed ? T.red : T.amber,
            border: `1px solid ${isRed ? T.redBorder : T.amberBorder}`,
            marginLeft: 6, verticalAlign: "middle",
            letterSpacing: "0.05em", fontFamily: "system-ui, sans-serif",
            animation: "tagIn 0.25s ease",
          }}>{h.badge}</span>
        )}
      </span>
    );
  }

  const allDone = shown >= HIGHLIGHTS.length;

  return (
    <div style={{
      background: T.white, border: `1px solid ${T.border}`,
      borderRadius: 10, overflow: "hidden",
      boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
    }}>
      <div style={{
        padding: "10px 18px", borderBottom: `1px solid ${T.borderLight}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#fafaf8",
      }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: T.ink }}>DORA Compliance Memo</p>
          <p style={{ fontSize: 10, color: T.inkFaint }}>Linklaters LLP · 14 February 2025</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#3b82f6", fontWeight: 600 }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%", background: "#3b82f6",
            display: "inline-block", animation: "scanLine 1.4s ease-in-out infinite",
          }} />
          {shown < HIGHLIGHTS.length ? "Scanning…" : "Audit complete"}
        </div>
      </div>

      <div style={{
        padding: "22px 24px 16px",
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: 13.5, lineHeight: 2, color: "#2a2a2a",
      }}>
        <p>
          The Digital Operational Resilience Act pursuant to{" "}
          <Hi idx={0}>DORA Article 30(3)</Hi>{" "}
          imposes obligations on{" "}
          <Hi idx={1}>UK-based financial entities</Hi>.
          Requirements set out in{" "}
          <Hi idx={2}>RTS Article 42</Hi>{" "}
          are confirmed by{" "}
          <Hi idx={3}>EBA/GL/2019/02</Hi>.
        </p>
      </div>

      <div style={{
        margin: "0 16px 16px", padding: "10px 14px",
        background: allDone ? T.redBg : "#f8f7f5",
        border: `1px solid ${allDone ? T.redBorder : T.borderLight}`,
        borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "all 0.4s ease",
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: allDone ? T.red : T.inkFaint }}>
          {shown === 0 ? "No issues found yet"
            : shown < HIGHLIGHTS.length ? `${shown} issue${shown > 1 ? "s" : ""} found…`
            : "4 issues found · 3 high risk · Do not send"}
        </span>
        {allDone && (
          <span style={{ fontSize: 9, fontWeight: 800, color: T.red, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            DO NOT SEND
          </span>
        )}
      </div>
    </div>
  );
}

// ── Persona preview card ──────────────────────────────────────────────────────

const PERSONA_PREVIEWS = [
  { initial: "J", bg: "#1e3a5f", name: "High Court Judge",   verdict: "REJECTS",         color: "#b91c1c", vbg: "#fef2f2", vborder: "#fca5a5" },
  { initial: "O", bg: "#7c1d1d", name: "Opposing Counsel",   verdict: "RAISES CONCERNS", color: "#92400e", vbg: "#fffbeb", vborder: "#fde68a" },
  { initial: "R", bg: "#1a3d2b", name: "FCA Regulator",      verdict: "RAISES CONCERNS", color: "#92400e", vbg: "#fffbeb", vborder: "#fde68a" },
  { initial: "P", bg: "#3b2060", name: "Partner Risk Review", verdict: "REJECTS",         color: "#b91c1c", vbg: "#fef2f2", vborder: "#fca5a5" },
];

function PersonaPreview() {
  return (
    <div style={{
      background: T.white, border: `1px solid ${T.border}`,
      borderRadius: 10, overflow: "hidden",
      boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
    }}>
      <div style={{
        padding: "10px 16px", borderBottom: `1px solid ${T.borderLight}`,
        background: "#fafaf8", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: T.ink }}>Scenario Stress Test</p>
        <span style={{ fontSize: 9, color: T.red, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Live simulation
        </span>
      </div>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {PERSONA_PREVIEWS.map((p) => (
          <div key={p.name} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", borderRadius: 8, background: "#fafaf9",
            border: `1px solid ${T.borderLight}`,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: p.bg, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800, flexShrink: 0,
            }}>{p.initial}</div>
            <p style={{ fontSize: 11, color: T.inkMid, flex: 1, fontWeight: 500 }}>{p.name}</p>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
              background: p.vbg, color: p.color, border: `1px solid ${p.vborder}`,
              letterSpacing: "0.04em", whiteSpace: "nowrap",
            }}>{p.verdict}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Proposition match preview card ────────────────────────────────────────────

function PropositionPreview() {
  const stances = [
    { label: "Strict Textual",        pct: 20, color: "#ef4444" },
    { label: "Purposive",             pct: 60, color: "#f59e0b" },
    { label: "Commercially Pragmatic",pct: 85, color: "#16a34a" },
  ];
  return (
    <div style={{
      background: T.white, border: `1px solid ${T.border}`,
      borderRadius: 10, overflow: "hidden",
      boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
    }}>
      <div style={{
        padding: "10px 16px", borderBottom: `1px solid ${T.borderLight}`,
        background: "#fafaf8", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: T.ink }}>Proposition Match</p>
        <span style={{
          fontSize: 9, color: "#4f46e5", fontWeight: 700,
          letterSpacing: "0.06em", textTransform: "uppercase",
          background: "#eef2ff", padding: "2px 7px", borderRadius: 4,
          border: "1px solid #c7d2fe",
        }}>18 runs · Monte Carlo</span>
      </div>

      <div style={{ padding: "14px 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <p style={{ fontSize: 28, fontWeight: 800, color: "#92400e", lineHeight: 1 }}>48%</p>
          <p style={{ fontSize: 10, color: T.inkFaint, marginTop: 3 }}>proposition match confidence</p>
          <div style={{ height: 6, borderRadius: 4, background: "#f3f4f6", margin: "8px 0 0", overflow: "hidden" }}>
            <div style={{ height: "100%", width: "48%", background: "#f59e0b", borderRadius: 4 }} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {stances.map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ fontSize: 10, color: T.inkMid, width: 130, flexShrink: 0 }}>{s.label}</p>
              <div style={{ flex: 1, height: 4, borderRadius: 4, background: "#f3f4f6", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${s.pct}%`, background: s.color, borderRadius: 4 }} />
              </div>
              <p style={{ fontSize: 10, fontWeight: 700, color: s.color, width: 28, textAlign: "right" }}>{s.pct}%</p>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 10, padding: "7px 10px",
          background: "#fef2f2", borderRadius: 6, border: `1px solid ${T.redBorder}`,
        }}>
          <p style={{ fontSize: 10, color: T.red, lineHeight: 1.5 }}>
            Case establishes principle in commercial context; being cited in consumer context
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Hero tabbed tool preview ──────────────────────────────────────────────────

const TOOL_TABS = [
  { id: "audit",       label: "Citation Audit",    color: T.red,    labelBg: "#fef2f2",   labelBorder: "#fca5a5"  },
  { id: "stress",      label: "Persona Stress Test", color: "#7c3aed", labelBg: "#f5f3ff", labelBorder: "#ddd6fe" },
  { id: "proposition", label: "Proposition Match",  color: "#4f46e5", labelBg: "#eef2ff",  labelBorder: "#c7d2fe" },
] as const;

function HeroToolPreview({
  onVerify, onPersonaTest, onPropositionMatch,
}: {
  onVerify: () => void;
  onPersonaTest: () => void;
  onPropositionMatch: () => void;
}) {
  const [active, setActive] = useState<"audit" | "stress" | "proposition">("audit");

  useEffect(() => {
    const id = setInterval(() => {
      setActive((prev) =>
        prev === "audit" ? "stress" : prev === "stress" ? "proposition" : "audit"
      );
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Tab strip */}
      <div style={{
        display: "flex", gap: 0, background: "#fff",
        border: `1px solid ${T.border}`, borderRadius: "10px 10px 0 0",
        borderBottom: "none", overflow: "hidden",
      }}>
        {TOOL_TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              style={{
                flex: 1, padding: "10px 0", border: "none", cursor: "pointer", fontSize: 10,
                fontWeight: 700, letterSpacing: "0.05em", transition: "all 0.18s",
                background: isActive ? "#fff" : "#fafaf8",
                color: isActive ? t.color : T.inkFaint,
                borderBottom: isActive ? `2px solid ${t.color}` : "2px solid transparent",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div style={{ border: `1px solid ${T.border}`, borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
        {active === "audit"       && <DocPreview />}
        {active === "stress"      && <PersonaPreview />}
        {active === "proposition" && <PropositionPreview />}
      </div>

      {/* CTA under preview */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {active === "audit" && (
          <>
            <button onClick={onVerify} className="btn-primary" style={{ flex: 1, padding: "10px 0", borderRadius: 7, border: "none", cursor: "pointer", background: T.navyBtn, color: "#fff", fontSize: 12, fontWeight: 700, transition: "background 0.15s, transform 0.15s" }}>
              Verify Citations →
            </button>
          </>
        )}
        {active === "stress" && (
          <button onClick={onPersonaTest} style={{ flex: 1, padding: "10px 0", borderRadius: 7, border: "1px solid #ddd6fe", cursor: "pointer", background: "#f5f3ff", color: "#7c3aed", fontSize: 12, fontWeight: 700 }}>
            Run Stress Test →
          </button>
        )}
        {active === "proposition" && (
          <button onClick={onPropositionMatch} style={{ flex: 1, padding: "10px 0", borderRadius: 7, border: "none", cursor: "pointer", background: "#1c3461", color: "#fff", fontSize: 12, fontWeight: 700 }}>
            Test a Proposition →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Three-tool cards section ──────────────────────────────────────────────────

function ThreeTools({
  onVerify, onPersonaTest, onPropositionMatch,
}: {
  onVerify: () => void;
  onPersonaTest: () => void;
  onPropositionMatch: () => void;
}) {
  const tools = [
    {
      badge: "5 adversarial agents",
      badgeColor: T.red, badgeBg: T.redBg, badgeBorder: T.redBorder,
      title: "Citation Audit",
      desc: "Five specialist agents verify every citation, statute, and legal proposition in your memo. Wrong jurisdiction, phantom articles, repealed law — caught before you send.",
      bullets: ["Citation sourcer · jurisdictionist", "Legal historian · devil's advocate", "Firm memory · contradiction check", "Runs in ~3 minutes on a full memo"],
      bulletColor: T.red,
      preview: <DocPreview />,
      cta: "Audit a memo →",
      ctaStyle: { background: T.navyBtn, color: "#fff", border: "none" } as React.CSSProperties,
      onClick: onVerify,
    },
    {
      badge: "5 stakeholder perspectives",
      badgeColor: "#7c3aed", badgeBg: "#f5f3ff", badgeBorder: "#ddd6fe",
      title: "Persona Stress Test",
      desc: "Your memo passes the agents — but would it survive cross-examination by a High Court judge? Opposing counsel? The FCA? Run it through five adversarial stakeholders simultaneously.",
      bullets: ["Upload any document or paste text", "Add your own custom judge profile", "Simultaneous multi-lens review", "Exportable Word report"],
      bulletColor: "#7c3aed",
      preview: <PersonaPreview />,
      cta: "Run Stress Test →",
      ctaStyle: { background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe" } as React.CSSProperties,
      onClick: onPersonaTest,
    },
    {
      badge: "Monte Carlo · 3–18 runs",
      badgeColor: "#4f46e5", badgeBg: "#eef2ff", badgeBorder: "#c7d2fe",
      title: "Proposition Match",
      desc: "Does this case actually support this proposition? RATIO runs the question across three interpretive stances and factual framings, then gives you a confidence score — not a binary yes/no.",
      bullets: ["Strict textual · purposive · pragmatic", "Narrow vs broad factual framing", "Confidence score with breakdown", "Powered by Nemotron via OpenRouter"],
      bulletColor: "#4f46e5",
      preview: <PropositionPreview />,
      cta: "Test a Proposition →",
      ctaStyle: { background: "#1c3461", color: "#fff", border: "none" } as React.CSSProperties,
      onClick: onPropositionMatch,
    },
  ];

  return (
    <section style={{ background: T.white, padding: "80px 56px", borderTop: `1px solid ${T.border}` }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 52, maxWidth: 600 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: T.inkFaint, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
            The platform
          </p>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(22px, 2.4vw, 34px)", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 12 }}>
            Three tools.{" "}
            <span style={{ color: T.inkFaint }}>One complete legal review.</span>
          </h2>
          <p style={{ fontSize: 14, color: T.inkMid, lineHeight: 1.65 }}>
            RATIO is not just a citation checker. Run the full pipeline — audit first, then stress-test the conclusion, then verify that every case you cited actually supports the proposition you are making.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {tools.map((t) => (
            <div key={t.title} style={{ display: "flex", flexDirection: "column", background: T.parchment, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
              {/* Preview */}
              <div style={{ padding: "0" }}>
                {t.preview}
              </div>

              {/* Content */}
              <div style={{ padding: "22px 22px 20px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
                <span style={{ display: "inline-block", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: t.badgeBg, color: t.badgeColor, border: `1px solid ${t.badgeBorder}`, letterSpacing: "0.07em", textTransform: "uppercase", alignSelf: "flex-start" }}>
                  {t.badge}
                </span>
                <div>
                  <h3 style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 8 }}>{t.title}</h3>
                  <p style={{ fontSize: 12, color: T.inkMid, lineHeight: 1.7 }}>{t.desc}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {t.bullets.map((b) => (
                    <div key={b} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ color: t.bulletColor, fontSize: 10, flexShrink: 0 }}>→</span>
                      <p style={{ fontSize: 11, color: T.inkMid }}>{b}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={t.onClick}
                  style={{ marginTop: "auto", padding: "10px 0", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700, ...t.ctaStyle }}
                >
                  {t.cta}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface LandingPageProps {
  onVerify: () => void;
  onFind: () => void;
  onPersonaTest: () => void;
  onPropositionMatch: () => void;
}

export function LandingPage({ onVerify, onFind, onPersonaTest, onPropositionMatch }: LandingPageProps) {
  return (
    <main style={{ background: T.parchment, minHeight: "100vh", color: T.ink }}>
      <style>{`
        @keyframes tagIn    { from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)} }
        @keyframes scanLine { 0%,100%{opacity:1}50%{opacity:0.3} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)} }
        .btn-primary:hover  { background:#1a3560!important; transform:translateY(-1px); }
        .btn-ghost:hover    { background:rgba(0,0,0,0.05)!important; }
        .agent-card:hover   { border-color:#c4bfb8!important; transform:translateY(-1px); }
      `}</style>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 56px", height: 58,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.border}`,
      }}>
        <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.08em", color: T.ink, fontFamily: "Georgia, serif" }}>
          RATIO
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 10, color: T.inkFaint, padding: "4px 10px",
            border: `1px solid ${T.border}`, borderRadius: 4,
            letterSpacing: "0.05em", textTransform: "uppercase",
          }}>Cambridge Hack the Law 2026</span>
          <button onClick={onPersonaTest} style={{
            fontSize: 12, fontWeight: 600, padding: "7px 14px",
            background: "transparent", color: "#7c3aed",
            borderRadius: 6, border: "1px solid #ddd6fe", cursor: "pointer",
          }}>Stress Test</button>
          <button onClick={onPropositionMatch} style={{
            fontSize: 12, fontWeight: 600, padding: "7px 14px",
            background: "transparent", color: "#4f46e5",
            borderRadius: 6, border: "1px solid #c7d2fe", cursor: "pointer",
          }}>Proposition</button>
          <button onClick={onVerify} className="btn-primary" style={{
            fontSize: 12, fontWeight: 700, padding: "8px 18px",
            background: T.navyBtn, color: "#fff",
            borderRadius: 6, border: "none", cursor: "pointer",
            letterSpacing: "0.02em", transition: "background 0.15s, transform 0.15s",
          }}>Audit a memo →</button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 56px 64px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>

          <div style={{ animation: "fadeUp 0.5s ease both" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 10, fontWeight: 700, color: T.red,
              letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 28,
            }}>
              <span style={{
                width: 16, height: 16, borderRadius: "50%",
                background: T.redBg, border: `1px solid ${T.redBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8,
              }}>!</span>
              Three tools · one legal review pipeline
            </div>

            <h1 style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(32px, 3.6vw, 52px)", fontWeight: 700,
              lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 24, color: T.ink,
            }}>
              The AI wrote it.<br />
              <span style={{ color: T.red }}>Now check every layer.</span>
            </h1>

            <p style={{ fontSize: 16, color: T.inkMid, lineHeight: 1.75, marginBottom: 32, maxWidth: 440 }}>
              RATIO is three tools in one pipeline — verify every citation,
              stress-test the conclusion against five adversarial stakeholders,
              and confirm each case actually supports the proposition you are making.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 36 }}>
              {[
                { label: "Citation Audit", desc: "5 agents · citations, jurisdiction, history, counter-authority", color: T.red, onClick: onVerify },
                { label: "Persona Stress Test", desc: "Judge, regulator, opposing counsel — all at once", color: "#7c3aed", onClick: onPersonaTest },
                { label: "Proposition Match", desc: "Monte Carlo confidence score across interpretive stances", color: "#4f46e5", onClick: onPropositionMatch },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                    background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8,
                    cursor: "pointer", textAlign: "left", transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = item.color; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{item.label}</p>
                    <p style={{ fontSize: 11, color: T.inkFaint }}>{item.desc}</p>
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: 14, color: T.inkFaint }}>→</span>
                </button>
              ))}
            </div>

            <button onClick={onFind} className="btn-ghost" style={{
              padding: "10px 20px", borderRadius: 7, cursor: "pointer",
              background: "transparent", border: `1px solid ${T.border}`,
              color: T.inkFaint, fontSize: 13, fontWeight: 500,
              transition: "background 0.15s",
            }}>Find Sources for a topic</button>
          </div>

          <div style={{ animation: "fadeUp 0.5s ease 0.12s both" }}>
            <HeroToolPreview
              onVerify={onVerify}
              onPersonaTest={onPersonaTest}
              onPropositionMatch={onPropositionMatch}
            />
          </div>
        </div>
      </section>

      {/* ── Three tools detail ───────────────────────────────────────────────── */}
      <ThreeTools onVerify={onVerify} onPersonaTest={onPersonaTest} onPropositionMatch={onPropositionMatch} />

      {/* ── Why RATIO ───────────────────────────────────────────────────────── */}
      <WhyRATIO />

      {/* ── Five agents ──────────────────────────────────────────────────────── */}
      <section style={{ background: T.white, padding: "72px 56px", borderTop: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 48 }}>
            <p style={{
              fontSize: 10, fontWeight: 700, color: T.inkFaint,
              letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12,
            }}>The verification engine</p>
            <h2 style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(22px, 2.4vw, 34px)", fontWeight: 700,
              letterSpacing: "-0.02em", marginBottom: 12,
            }}>
              Five adversarial specialists.{" "}
              <span style={{ color: T.inkFaint }}>Not one AI that does everything.</span>
            </h2>
            <p style={{ fontSize: 14, color: T.inkMid, maxWidth: 500, lineHeight: 1.65 }}>
              Each agent is given a different brief. A flaw missed by one is caught by another.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {[
              { num: "I",   name: "Citation Sourcer",  badge: "NOT FOUND",         type: "red", desc: "Verifies every cited provision word for word against EUR-Lex and legislation.gov.uk.",          finding: "DORA Article 30(3) does not match the Official Journal text." },
              { num: "II",  name: "Jurisdictionist",   badge: "WRONG JURISDICTION", type: "red", desc: "Checks whether the cited regulation actually applies to your specific client entity post-Brexit.", finding: "UK-only firms are outside DORA scope without EU establishment." },
              { num: "III", name: "Legal Historian",   badge: "AMENDED",            type: "amb", desc: "Traces amendment history and catches stale article numbers from pre-publication AI training data.", finding: "Article numbering differs from the final OJ text of January 2025." },
              { num: "IV",  name: "Devil's Advocate",  badge: "HIGH RISK",          type: "red", desc: "Surfaces the strongest counter-authority that opposing counsel will raise before you send.",       finding: "EBA/GL/2019/02 directly undermines the cited interpretation." },
              { num: "V",   name: "Firm Memory",       badge: "CONTRADICTION",      type: "red", desc: "Checks every claim against prior firm opinions. Flags advice that contradicts your own precedent.", finding: "Client Advisory (Richardson, March 2024) took the opposite position." },
            ].map((a) => (
              <div key={a.name} className="agent-card" style={{
                background: T.parchment, border: `1px solid ${T.border}`,
                borderRadius: 10, padding: "20px 18px",
                transition: "border-color 0.2s, transform 0.2s", cursor: "default",
              }}>
                <div style={{
                  fontFamily: "Georgia, serif", fontSize: 12, fontWeight: 700,
                  color: T.inkFaint, letterSpacing: "0.04em", marginBottom: 14,
                }}>{a.num}</div>
                <p style={{ fontSize: 12, fontWeight: 700, color: T.ink, marginBottom: 8 }}>{a.name}</p>
                <p style={{ fontSize: 11, color: T.inkMid, lineHeight: 1.6, marginBottom: 14 }}>{a.desc}</p>
                <div style={{ padding: "8px 10px", background: T.white, border: `1px solid ${T.border}`, borderRadius: 6 }}>
                  <div style={{
                    display: "inline-block", fontSize: 9, fontWeight: 700,
                    padding: "2px 6px", borderRadius: 3, marginBottom: 5,
                    background: a.type === "red" ? T.redBg : T.amberBg,
                    color: a.type === "red" ? T.red : T.amber,
                    border: `1px solid ${a.type === "red" ? T.redBorder : T.amberBorder}`,
                    letterSpacing: "0.04em",
                  }}>{a.badge}</div>
                  <p style={{ fontSize: 10, color: T.inkMid, lineHeight: 1.5 }}>{a.finding}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 56px 100px", textAlign: "center", background: T.parchment }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <p style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(24px, 2.4vw, 36px)",
            fontWeight: 700, letterSpacing: "-0.02em",
            marginBottom: 16, lineHeight: 1.2,
          }}>
            Audit. Stress-test. Verify.<br />
            <span style={{ color: T.inkFaint }}>Three minutes. Every layer.</span>
          </p>
          <p style={{ fontSize: 15, color: T.inkMid, marginBottom: 36, lineHeight: 1.65 }}>
            Paste your memo, upload a document, or test a proposition — RATIO covers
            every dimension of legal review before it becomes a liability.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onVerify} className="btn-primary" style={{
              padding: "14px 30px", borderRadius: 7, border: "none", cursor: "pointer",
              background: T.navyBtn, color: "#fff", fontSize: 14, fontWeight: 700,
              letterSpacing: "0.01em", transition: "background 0.15s, transform 0.15s",
            }}>Verify Citations →</button>
            <button onClick={onPersonaTest} className="btn-ghost" style={{
              padding: "14px 22px", borderRadius: 7, cursor: "pointer",
              background: "transparent", border: `1px solid #ddd6fe`,
              color: "#7c3aed", fontSize: 14, fontWeight: 600,
              transition: "background 0.15s",
            }}>Run Stress Test</button>
            <button onClick={onPropositionMatch} className="btn-ghost" style={{
              padding: "14px 22px", borderRadius: 7, cursor: "pointer",
              background: "transparent", border: `1px solid #c7d2fe`,
              color: "#4f46e5", fontSize: 14, fontWeight: 600,
              transition: "background 0.15s",
            }}>Test a Proposition</button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div style={{
        borderTop: `1px solid ${T.border}`, padding: "18px 56px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: T.white,
      }}>
        <span style={{ fontSize: 12, fontFamily: "Georgia, serif", fontWeight: 700, letterSpacing: "0.08em", color: T.ink }}>
          RATIO
        </span>
        <span style={{ fontSize: 11, color: T.inkFaint }}>
          Cambridge Hack the Law 2026 · Not legal advice · Powered by Claude Sonnet 4.6
        </span>
      </div>
    </main>
  );
}
