"use client";

import { useEffect, useState } from "react";

// ── Story data ─────────────────────────────────────────────────────────────────

const STORY_SLIDES = [
  {
    id: "welcome",
    eyebrow: "Cambridge Hack the Law · 2026",
    title: "Meet RATIO",
    subtitle: "Five adversarial AI agents that audit what other AIs get wrong.",
    body: "Legal AI tools hallucinate citations, misapply jurisdiction, cite repealed provisions, and contradict your own firm's prior positions. RATIO catches all of it — before the memo leaves your inbox.",
    accent: "#4a9eff",
    icon: "⚖",
    cta: "See how it works →",
  },
  {
    id: "problem",
    eyebrow: "The Brief",
    title: "Jack & Jill Capital Partners",
    subtitle: "A UK fintech firm. A compliance deadline. One AI-generated memo.",
    body: "January 2025. Jack & Jill Capital Partners are preparing for DORA. Their in-house AI generates a compliance memo citing Article 30(3), claiming non-compliance carries 2% global turnover penalties under Article 50. The partner signs off. RATIO is the last line of defence.",
    accent: "#f5a623",
    icon: "📄",
    tag: "DEMO SCENARIO",
    cta: "What did RATIO find? →",
  },
  {
    id: "sourcer",
    eyebrow: "Agent 1 of 5",
    title: "Citation Sourcer",
    subtitle: "\"I don't trust what I can't verify verbatim.\"",
    body: "Fetched Article 30(3) from EUR-Lex and compared it word-for-word against the memo. The AI paraphrased loosely — the actual text imposes obligations on ICT third-party service providers, not financial entities like Jack & Jill.\n\nVerdict: INFERRED — citation does not support the claim.",
    accent: "#00d98b",
    icon: "⊕",
    badge: "INFERRED",
    badgeColor: "#f5a623",
    cta: "Next agent →",
  },
  {
    id: "jurisdictionist",
    eyebrow: "Agent 2 of 5",
    title: "Jurisdictionist",
    subtitle: "\"Article 2 is not a formality — it defines who exists in this law.\"",
    body: "DORA Article 2(2) explicitly lists the financial entities in scope. Jack & Jill Capital Partners has no EU establishment and no EU-regulated subsidiary. Post-Brexit UK-only firms are categorically outside scope.\n\nVerdict: WRONG_JURISDICTION — 97% confidence.",
    accent: "#9f7aea",
    icon: "◉",
    badge: "WRONG_JURISDICTION",
    badgeColor: "#ff3b5c",
    cta: "Next agent →",
  },
  {
    id: "historian",
    eyebrow: "Agent 3 of 5",
    title: "Legal Historian",
    subtitle: "\"History doesn't lie. That penalty ceiling was changed in December.\"",
    body: "Queried the EU Cellar SPARQL endpoint for Article 50 amendments. Commission Delegated Regulation (EU) 2024/1087 restructured the penalty provisions. The 2% figure cited in the memo applied to an earlier draft — the final text sets a different ceiling for different actor classes.\n\nVerdict: AMENDED — provision has been modified.",
    accent: "#f5a623",
    icon: "⊗",
    badge: "AMENDED",
    badgeColor: "#f5a623",
    cta: "Next agent →",
  },
  {
    id: "devil",
    eyebrow: "Agent 4 of 5",
    title: "Devil's Advocate",
    subtitle: "\"Let me find four reasons this is wrong. I found six.\"",
    body: "Ran Perplexity searches against EBA Q&A publications and FCA guidance. EBA Q&A 2024-11-3 directly addresses the UK extraterritoriality question. The FCA's own operational resilience framework already applies to Jack & Jill — DORA compliance would be gold-plating at best, misguidance at worst.\n\nVerdict: HIGH counter-argument strength.",
    accent: "#ff6b6b",
    icon: "⊘",
    badge: "HIGH",
    badgeColor: "#ff3b5c",
    cta: "Next agent →",
  },
  {
    id: "memory",
    eyebrow: "Agent 5 of 5",
    title: "Firm Memory",
    subtitle: "\"We told them the exact opposite six months ago.\"",
    body: "Scanned prior matter records. Matter JJ-COMP-2024 (July 2024): the same firm was advised that DORA does not apply to UK-only entities. The current memo contradicts this position. Sending it would expose the firm to a professional indemnity claim.\n\nVerdict: CONTRADICTION_FOUND — prior advisory conflicts.",
    accent: "#00d9d9",
    icon: "⊙",
    badge: "CONTRADICTION_FOUND",
    badgeColor: "#ff3b5c",
    cta: "See the verdict →",
  },
  {
    id: "verdict",
    eyebrow: "RATIO Verdict",
    title: "Score: 12 / 100",
    subtitle: "DO NOT SEND",
    body: "Five agents. Five independent findings. Every material claim in the AI-generated memo was wrong. The Orchestrator synthesised the findings under adversarial framing and issued a single verdict: this memo cannot leave the building.\n\nThat's what RATIO does. Every time.",
    accent: "#ff3b5c",
    icon: "🚫",
    isVerdict: true,
    cta: "Try it yourself →",
  },
];

const BADGE_COLORS: Record<string, string> = {
  INFERRED: "border-amber-800 text-amber-300 bg-amber-950/30",
  AMENDED: "border-amber-800 text-amber-300 bg-amber-950/30",
  WRONG_JURISDICTION: "border-rose-800 text-rose-300 bg-rose-950/30",
  HIGH: "border-rose-800 text-rose-300 bg-rose-950/30",
  CONTRADICTION_FOUND: "border-rose-800 text-rose-300 bg-rose-950/30",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function OnboardingStory({
  onClose,
  onLoadDemo,
}: {
  onClose: () => void;
  onLoadDemo?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  function close() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  function next() {
    if (step < STORY_SLIDES.length - 1) {
      setStep(step + 1);
    } else {
      // Last slide: load demo and close
      onLoadDemo?.();
      close();
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  const slide = STORY_SLIDES[step];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 font-mono transition-all duration-300"
      style={{
        background: visible ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(8px)" : "blur(0px)",
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      {/* Modal */}
      <div
        className="relative w-full max-w-2xl rounded-2xl border overflow-hidden transition-all duration-300"
        style={{
          borderColor: slide.accent + "44",
          backgroundColor: "#030308",
          backgroundImage: "radial-gradient(circle, #1a1a3a 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.96)",
          opacity: visible ? 1 : 0,
          boxShadow: `0 0 80px ${slide.accent}22, 0 0 200px ${slide.accent}08`,
        }}
      >
        {/* Top glow bar */}
        <div
          className="h-px w-full"
          style={{ background: `linear-gradient(90deg, transparent, ${slide.accent}88, transparent)` }}
        />

        {/* Content */}
        <div className="p-8 sm:p-10">
          {/* Eyebrow */}
          <div className="flex items-center justify-between mb-6">
            <span
              className="text-[9px] uppercase tracking-widest font-bold px-2 py-1 rounded border"
              style={{ color: slide.accent, borderColor: slide.accent + "40", backgroundColor: slide.accent + "12" }}
            >
              {slide.eyebrow}
            </span>
            <button
              onClick={close}
              className="text-zinc-600 hover:text-zinc-400 transition-colors text-xs"
            >
              ✕ Skip
            </button>
          </div>

          {/* Icon + Title */}
          <div className="flex items-start gap-5 mb-6">
            <div
              className="text-4xl shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center border"
              style={{
                borderColor: slide.accent + "44",
                backgroundColor: slide.accent + "12",
                boxShadow: `0 0 30px ${slide.accent}20`,
              }}
            >
              {slide.icon}
            </div>
            <div>
              {slide.tag && (
                <span className="text-[8px] text-zinc-600 uppercase tracking-widest block mb-1">{slide.tag}</span>
              )}
              <h2
                className="text-2xl font-bold tracking-tight mb-1"
                style={{ color: slide.isVerdict ? slide.accent : "#f0f0f8" }}
              >
                {slide.title}
              </h2>
              <p className="text-sm italic" style={{ color: slide.accent + "cc" }}>
                {slide.subtitle}
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-5 mb-6">
            {slide.body.split("\n\n").map((para, i) => (
              <p
                key={i}
                className={`text-sm leading-relaxed text-zinc-400 ${i > 0 ? "mt-3" : ""}`}
              >
                {para}
              </p>
            ))}
            {slide.badge && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-[9px] text-zinc-600 uppercase tracking-widest">Verdict:</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded border font-bold tracking-widest ${BADGE_COLORS[slide.badge] ?? "border-zinc-700 text-zinc-400"}`}
                >
                  {slide.badge.replace(/_/g, " ")}
                </span>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            {/* Step dots */}
            <div className="flex items-center gap-1.5">
              {STORY_SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: i === step ? 20 : 6,
                    height: 6,
                    backgroundColor: i === step ? slide.accent : "#374151",
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              {step > 0 && (
                <button
                  onClick={prev}
                  className="px-4 py-2 rounded-xl text-[11px] border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-all tracking-widest uppercase"
                >
                  ← Back
                </button>
              )}
              <button
                onClick={next}
                className="px-5 py-2 rounded-xl text-[11px] font-bold tracking-widest uppercase transition-all"
                style={{
                  backgroundColor: slide.accent,
                  color: "#030308",
                }}
              >
                {slide.cta}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom glow bar */}
        <div
          className="h-px w-full"
          style={{ background: `linear-gradient(90deg, transparent, ${slide.accent}44, transparent)` }}
        />
      </div>
    </div>
  );
}
