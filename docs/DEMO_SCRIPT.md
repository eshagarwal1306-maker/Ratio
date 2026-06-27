# RATIO — Demo Flow & Script

**Target runtime:** 4 minutes (recording) / 6 minutes (live with questions)  
**Scenario throughout:** UK-based fintech firm. DORA compliance memo. Fictional case: Crestholm Dynamics plc v Veltros Industries.

---

## Before You Start — Setup Checklist

- [ ] App running at localhost (or deployed URL)
- [ ] Have the demo document text ready to paste (see Appendix A)
- [ ] Browser window at ~1200px wide — no other tabs visible
- [ ] Screen recording started
- [ ] Font size bumped to 125% in browser for readability
- [ ] Close any notifications / Do Not Disturb on

---

## SCENE 1 — Landing Page (0:00–0:30)

**What to show:** The landing page hero section.

**Click:** Nothing yet. Let it load. The tabbed preview on the right side auto-cycles through the three tools — let it run for one cycle so judges see all three previews.

**What to say:**

> "RATIO is three tools in one legal review pipeline. It is not a citation checker — it is a reasoning auditor. The first tool verifies every citation in your document. The second stress-tests your conclusion against five adversarial stakeholders simultaneously. The third gives you a Monte Carlo confidence score on whether a case actually supports the proposition you are making."

**Then:** Scroll down slowly to the "Three tools" section. Briefly show the three cards.

> "Each one catches what the others can't. Let me show you."

**Then:** Click **"Test a Proposition →"** on the Proposition Match card (or use nav "Proposition" button). This goes standalone — fastest demo of Nemotron, no document needed.

---

## SCENE 2 — Proposition Match Standalone (0:30–1:15)

**What to show:** The PropositionMatchPanel in standalone mode.

**What to fill in:**
- Case name: `Donoghue v Stevenson [1932] AC 562`
- Proposition: `A manufacturer owes a duty of care to the ultimate consumer, regardless of any direct contractual relationship`
- Mode: **Quick (3 runs)**

**Click:** Run / Submit

**What to say while it loads (15–20 seconds):**

> "Proposition Match runs the same question eighteen times — or three in quick mode — across different interpretive stances and factual framings using Nemotron, NVIDIA's 70B reasoning model via OpenRouter. It gives you a probability distribution, not a binary answer."

**When results appear:**

> "You can see the confidence score — [X]%. But what matters is the breakdown. Under strict textual interpretation, it scores differently than under purposive or commercially pragmatic interpretation. That variance is the information. A memo that cites this case in a consumer context when it was decided in a commercial context — that gap appears here."

**If there are any failure reasons shown:**

> "These are the actual reasons the proposition fails across runs. This is what opposing counsel is going to say."

**Then:** Click back to the landing page. **Click "Audit a memo →"** in the nav.

---

## SCENE 3 — Setup: Paste the Document (1:15–1:45)

**What to show:** The setup screen — dark left panel, form on the right.

**What to say:**

> "Now the full audit. I'm going to paste a compliance memo — this is the kind of document an AI drafting tool would produce for a UK fintech client advised on DORA compliance."

**Paste** the demo document (Appendix A) into the text area.

**Client context field:** Type `UK-based fintech firm, London HQ, no EU establishment`

> "The entity field matters — the Jurisdictionist agent uses this to assess whether the cited regulations actually apply to this specific client. That is the check most tools skip entirely."

**Click:** **"Begin Audit →"**

---

## SCENE 4 — Running Phase: Live Document Scanning (1:45–2:30)

**What to show:** The running phase — document on the left with live badges appearing, right panel with Audit Story / Agent Graph.

**Immediately say:**

> "Watch the document. Each citation gets a live badge as the agents work through it."

**Let run for 15–20 seconds until the first 2–3 badges appear on the document.**

> "Blue pulsing means the agent is actively scanning that citation right now. Once it resolves, the badge locks in. Red means a serious finding. Amber is a warning."

**Click tab:** Switch right panel from "Audit Story" to **"Agent Graph"**

> "The Agent Graph shows RATIO's orchestration layer in real time. RATIO is the central orchestrator — it is dispatching five agents in parallel. Click on any agent node."

**Click one of the agent nodes** (e.g. Jurisdictionist)

> "Each agent has a specific brief. The Jurisdictionist — [read from detail panel]. This is what is running against every single citation simultaneously."

**Click back to "Audit Story" tab.**

> "The Audit Story gives you a claim-by-claim view. Each card collapses — expand one to see the individual agent verdicts."

**Expand one card.** Show the agent findings.

**Let the audit finish naturally, or wait until at least 4–5 claims show badges.**

> "It finds [X] claims. Let me show you what the review phase looks like."

---

## SCENE 5 — Review Phase: Clicking Citations (2:30–3:00)

**What to show:** The VerificationStepper. Document on left with coloured underlines. Sidebar on right with claim list.

**What to say:**

> "Every claim is now highlighted in the document. Green underline — passed all five agents. Amber — some concern. Red — a serious problem."

**Click one of the RED/amber sidebar items.** A popup appears.

> "I click here — [read the popup]. The Jurisdictionist has flagged this as wrong jurisdiction. DORA applies to EU-regulated entities. This firm is UK-only, post-Brexit, with no EU establishment. The entire advice is wrong. The client would spend six figures on compliance for a regulation that does not apply to them."

**Keep or Skip a few claims** — show the decisions working.

> "The lawyer keeps what is correct, skips what is wrong. Click Finish."

**Click Finish.**

---

## SCENE 6 — Done: Verification Report (3:00–3:20)

**What to show:** The Verification Report tab. Overall score and verdict. Per-claim breakdown.

**What to say:**

> "The report. Overall score — [X] out of 100. Verdict: [Do Not Send / Review Required]. Every claim scored and explained. Each one links to the live regulation on EUR-Lex or legislation.gov.uk. Download as a Word document, send by email."

**Click "Download Report (.docx)"** — show the download.

> "That is the audit. But we are not done."

---

## SCENE 7 — Persona Stress Test (3:20–3:50)

**Click tab:** "Persona Stress Test"

**What to say while it loads (it auto-runs):**

> "The Persona Stress Test runs the audit results through five adversarial stakeholders simultaneously. Not one AI reviewing from one perspective — five. A High Court judge. Opposing litigation counsel. An FCA regulator. A senior risk partner. The in-house GC."

**When cards appear:**

> "The judge [read verdict]. Opposing counsel [read verdict]. Look at what they say — [read one specific concern from a card]. This is what you are walking into if this memo goes out."

**Show the Document Upload and Custom Persona sections:**

**Click "Add a custom judge profile":**

> "But we also let you build your own stakeholder. You can define any perspective — click a template or write your own. Add a sceptical client, an academic, a foreign regulator. They all run in the same pipeline."

**Click a template** (e.g. "Sceptical Client"). Show the fields auto-filling.

> "Click 'Add to stress test', re-run — and now that perspective runs alongside the standard five."

---

## SCENE 8 — Close (3:50–4:00)

**Navigate back to Landing Page.** Hero visible.

**What to say:**

> "Three tools. One pipeline. Citation audit with five adversarial agents. Persona stress test from the judge's bench to the client's boardroom. Monte Carlo proposition matching powered by Nemotron. Everything exports to Word. Everything is traceable. This is not a citation checker — it is the reasoning layer that should sit between every AI drafting tool and every piece of legal advice before it goes out."

**End recording.**

---

## Key Visual Moments — Make Sure These Are On Screen

| Moment | Why it lands |
|---|---|
| First red badge appearing live on document text | Viscerally shows the AI catching something in real time |
| Jurisdictionist popup: "WRONG JURISDICTION" | The killer finding — entire advice is wrong |
| Agent Graph canvas with pulsing nodes | Shows it's a multi-agent system, not one model |
| Persona card: High Court Judge verdict | Makes the abstract concrete — "would this survive court?" |
| Confidence score in Proposition Match | Shows probabilistic reasoning, not binary |
| Word doc download | Shows the output is immediately usable |

---

## What NOT to Show

- The "Find Sources" flow — it is good but secondary; skip it for time
- The Neo4j graph page (research/page.tsx) — only show if you have 6+ minutes
- The email button — the Word doc download is cleaner visually

---

## Handling Questions

**"Is this live or mocked?"**  
> The audit is fully live. Every agent call goes to Claude via Anthropic's API. Proposition Match goes to Nemotron via OpenRouter. The Word exports are generated on demand. The only thing mocked is the firm memory agent — in production that is fed by the firm's actual prior matter documents.

**"How long does it take?"**  
> About 3 minutes for a full document. The agents run in parallel — all five run on every claim simultaneously, so it scales with claims, not linearly.

**"What is Nemotron doing that Claude can't?"**  
> The Monte Carlo approach runs 18 parallel calls simultaneously. Running 18 Claude Sonnet calls at once would be cost-prohibitive. Nemotron via OpenRouter is high-throughput and economical for this specific use case — rapid repeated inference with slight variation. The distribution across runs is itself the output.

**"What about hallucination — can RATIO hallucinate too?"**  
> The agents can make reasoning errors. That is why there are five. The outputs are flagged, not presented as ground truth. The lawyer makes the final call in the review phase. RATIO is not replacing the lawyer — it is making sure the partner only needs to review the things that are actually risky.

**"How does it connect to Neo4j?"**  
> The Devil's Advocate agent traverses the citation relationship graph to surface counter-authority. Neo4j stores the citation network — which cases cite which cases, which statutes were amended by which instruments. String matching cannot catch a case that was distinguished by a 2024 decision in a different court. Graph traversal can.

---

## Appendix A — Demo Document Text

Paste this into the document field:

```
DORA Compliance Memorandum
Crestholm Dynamics plc — ICT Risk Management

This memorandum advises that pursuant to DORA Article 30(3), UK-based financial entities are required to ensure all ICT third-party service providers contractually commit to audit rights, inspection and access provisions, and sub-outsourcing oversight mechanisms.

The Digital Operational Resilience Act (DORA) entered into force under EU Regulation 2022/2554 and became applicable to financial entities on 17 January 2025. Under Article 2, the regulation applies to credit institutions, investment firms, and other regulated entities operating within the European Union.

Pursuant to Article 30(3), written contractual arrangements with ICT third-party service providers must include provisions on sub-outsourcing oversight. Entities in breach face potential supervisory measures and penalties.

The EBA Guidelines EBA/GL/2019/02 on outsourcing arrangements provide supplementary guidance on the scope of ICT sub-outsourcing oversight and should be read alongside DORA Article 30(3).

The applicable penalty regime under Article 50 provides for administrative sanctions of up to 2% of total annual worldwide turnover where systemic or wilful breaches are identified by the competent authority.

We advise that Crestholm Dynamics immediately review all ICT third-party contracts and insert DORA-compliant sub-outsourcing provisions. Failure to comply by 17 January 2025 will expose the firm to regulatory sanction under the applicable penalty regime.
```

---

## Appendix B — Proposition Match Inputs (Pre-filled)

For Scene 2 — copy-paste ready:

**Case name:** `Donoghue v Stevenson [1932] AC 562`

**Proposition:** `A manufacturer owes a duty of care to the ultimate consumer of their product, regardless of any direct contractual relationship between manufacturer and consumer`

**Mode:** Quick (3 runs)

---

*Last updated: 27 June 2026. Based on actual app features as built.*
