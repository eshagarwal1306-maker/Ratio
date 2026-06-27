# RATIO — AI Legal Reasoning Auditor

**Cambridge Hack the Law 2026**

RATIO is a three-tool legal reasoning pipeline that sits between AI-drafted documents and the lawyer who has to sign off on them. It does not just check whether citations exist — it checks whether the reasoning holds.

> *AI writes the argument. RATIO checks if it holds.*

---

## The Problem

AI drafting tools generate confident, professional-sounding legal arguments that are jurisdictionally wrong, cite provisions renumbered before final publication, and contradict advice the same firm gave the same client twelve months ago. None of the existing tools check whether the reasoning holds — only whether the citations exist.

---

## The Three Tools

### 1. Citation Audit

Five adversarial agents run in parallel on every claim in your document:

| Agent | What It Checks |
|---|---|
| **Citation Sourcer** | Verifies article text verbatim against EUR-Lex and legislation.gov.uk |
| **Jurisdictionist** | Checks whether the cited regulation applies to your specific client post-Brexit |
| **Legal Historian** | Traces amendment history — catches stale article numbers from pre-publication AI training data |
| **Devil's Advocate** | Surfaces the strongest counter-authority opposing counsel will raise |
| **Firm Memory** | Flags contradictions with prior firm opinions and client advice |

Every claim is scored 0–100. The document highlights live as agents work, with inline badges (`NOT FOUND`, `WRONG JURISDICTION`, `AMENDED`, etc.) appearing in real time. Output exports as a structured Word document.

### 2. Persona Stress Test

Runs the audit findings — or any uploaded document — through five adversarial stakeholders simultaneously: High Court judge, opposing litigation counsel, FCA regulator, senior risk partner, in-house GC. Each returns a verdict, a first-person quote in character, specific concerns, and a recommended action.

Users can also build custom judge profiles: define any stakeholder name, role, and interpretive lens. Custom personas run alongside the standard five. Exports to Word.

### 3. Monte Carlo Proposition Match

Instead of asking once whether a case supports a proposition, RATIO asks up to 18 times — across three interpretive stances (strict textual, purposive, commercially pragmatic), three factual framings (narrow, standard, broad), and two extraction angles (direct vs ratio-first). The distribution of verdicts produces a confidence score, a stance breakdown, a fact-sensitivity analysis, and the top reasons the proposition fails.

Powered by **NVIDIA Nemotron 70B** via OpenRouter.

---

## Tech Stack

| Tool | Role |
|---|---|
| **Claude (Anthropic)** | Orchestration, all five audit agents, persona simulation, PDF parsing |
| **Nemotron (NVIDIA via OpenRouter)** | Parallel Monte Carlo proposition matching |
| **Neo4j** | Citation relationship graph, firm memory, contradiction detection |
| **Perplexity + EU Open Data** | Live EUR-Lex regulatory verification, post-cutoff currency checks |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Anthropic API key
- OpenRouter API key (for Proposition Match)

### Install

```bash
cd gavel
npm install
```

### Environment

Create `.env.local`:

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...

# Optional — Neo4j for citation graph
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Architecture

```
app/
  page.tsx                    — Main UI: landing → setup → running → review → done
  LandingPage.tsx             — Three-tool hero, tabbed preview, tool cards
  AuditStory.tsx              — Live collapsible claim cards with agent dot strips
  AgentGraph.tsx              — Canvas agent network, clickable nodes, RATIO orchestrator
  VerificationStepper.tsx     — Document review with inline highlights and popups
  PersonaStressTestPanel.tsx  — Persona stress test with custom judge builder
  PropositionMatchPanel.tsx   — Monte Carlo proposition match UI
  CitationSearchVisual.tsx    — Full-screen source discovery animation

app/api/
  audit/                      — Streaming audit endpoint (5 parallel agents per claim)
  persona-stress-test/        — Persona simulation endpoint
  proposition-match/          — Nemotron Monte Carlo endpoint
  generate-citations/         — Source discovery
  extract-text/               — PDF / Word text extraction
  export-docx/                — Verification report Word export
  export-persona-docx/        — Persona stress test Word export
  export-proposition-docx/    — Proposition match Word export
```

---

## Usage

### Citation Audit
1. Click **Audit a memo** on the landing page
2. Upload (PDF, Word, TXT) or paste your legal document
3. Enter client context (e.g. "UK-based fintech, no EU establishment")
4. Click **Begin Audit** — watch citations highlight live as agents run

### Persona Stress Test
- Available standalone from the landing page, or as a tab after audit completes
- Upload any document or use audit results
- Add custom judge profiles via the builder

### Proposition Match
- Available standalone from the landing page, or as a tab after audit completes
- Enter a case name and proposition
- Choose Quick (3 runs) or Full (18 runs)

---

## Hackathon Context

Built at **Cambridge Hack the Law 2026**.

Addresses the White & Case challenge: *AI Hallucination & Citation Checker for Legal Documents* — and goes beyond citation existence to verify jurisdictional applicability, regulatory currency, counter-authority, and reasoning consistency.

---

## Caveats

Proof of concept built for a hackathon. Does not constitute legal advice. All findings should be reviewed by a qualified solicitor. The Firm Memory corpus is mocked for demo purposes — production deployment would connect to the firm's document management system.
