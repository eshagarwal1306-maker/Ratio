import type { ClaimAuditResult } from "./schemas";

export function buildReasoningTrace(results: ClaimAuditResult[]): string {
  const lines: string[] = [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "GAVEL REASONING TRACE",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ];

  for (const r of results) {
    lines.push("");
    lines.push(`CLAIM: "${r.claim.text}"`);
    lines.push("");

    const sourcerLabel =
      r.sourcer.status === "CITED"
        ? "CITED ✓"
        : r.sourcer.status === "INFERRED"
        ? "INFERRED ⚠"
        : "NOT FOUND ⛔";
    lines.push(`[${sourcerLabel}]  ${r.sourcer.discrepancy || r.sourcer.verbatim_quote || "Verified."}`);

    if (r.jurisdictionist.status === "WRONG_JURISDICTION") {
      lines.push(`[WRONG JX ⛔]  ${r.jurisdictionist.reason} (${r.jurisdictionist.confidence}% confidence)`);
    } else if (r.jurisdictionist.status === "UNCLEAR") {
      lines.push(`[JX UNCLEAR ⚠]  ${r.jurisdictionist.reason}`);
    } else {
      lines.push(`[JURISDICTION ✓]  ${r.jurisdictionist.reason}`);
    }

    const histIcon =
      r.historian.status === "CURRENT" ? "✓" : r.historian.status === "AMENDED" ? "⚠" : "?";
    lines.push(`[${r.historian.status} ${histIcon}]  ${r.historian.note}`);

    const devilIcon =
      r.devils_advocate.strength === "high"
        ? "⛔"
        : r.devils_advocate.strength === "medium"
        ? "⚠"
        : "~";
    lines.push(
      `[CONTESTED ${devilIcon}]  ${r.devils_advocate.counter_authority}: ${r.devils_advocate.why_it_undermines}`
    );

    if (r.firm_memory.status === "CONTRADICTION_FOUND" && r.firm_memory.reference) {
      lines.push(
        `[CONFLICT ⛔]  Contradicts ${r.firm_memory.reference.matter} (${r.firm_memory.reference.date}): "${r.firm_memory.reference.position}"`
      );
    }

    lines.push("");
    lines.push(`GAVEL SCORE: ${r.score}/100`);
    lines.push("────────────────────────────────────────────────────────────");
  }

  const overall = Math.round(
    results.reduce((sum, r) => sum + r.score, 0) / results.length
  );

  lines.push("");
  lines.push(
    `OVERALL GAVEL SCORE: ${overall}/100  ${
      overall < 40
        ? "⛔ DO NOT SEND — Partner review required."
        : overall < 70
        ? "⚠ Review recommended before sending."
        : "✓ Proceed with standard review."
    }`
  );
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return lines.join("\n");
}
