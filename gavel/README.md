# GAVEL — AI Legal Citation Verifier

**Cambridge Hack the Law 2026** · Best Legal AI Tool

GAVEL is an adversarial multi-agent system that audits legal memos for citation accuracy, jurisdictional errors, outdated law, and conflicts with prior firm advice — in under three minutes.

---

## The Problem

AI-drafted legal memos hallucinate citations. A solicitor receives a memo citing "DORA Article 30(3)" — but does that article exist? Does DORA even apply to a UK-only client post-Brexit? Has the article been renumbered since the AI's training data? Is there a counter-authority the opposing counsel will find first?

Manual verification across EUR-Lex, BAILII, legislation.gov.uk, and the firm's own prior opinions takes hours. GAVEL does it in minutes.

---

## How It Works

### Five Specialist Agents

GAVEL runs five adversarial AI agents in parallel for every legal claim it identifies:

| Agent | What It Checks |
|---|---|
| **Citation Sourcer** | Fetches the verbatim article text from EU Cellar or verifies against UK statute knowledge. Returns `CITED`, `INFERRED`, or `NOT FOUND`. |
| **Jurisdictionist** | Checks whether the cited regulation actually applies to the client entity. Critical for UK firms post-Brexit — EU regulations like DORA do not apply to UK-only entities without EU authorisation. |
| **Legal Historian** | Checks whether the cited article is current law, whether it has been amended, and whether AI models trained on draft legislation may be citing the wrong article number. |
| **Devil's Advocate** | Searches for the strongest real counter-authority — cases, EBA/FCA guidance, academic commentary — that undermines the claim. |
| **Firm Memory** | Checks the claim against prior firm positions. Flags contradictions with past client advice (e.g. if the firm told a different client the opposite on the same point). |

### Regulation-Aware Verification

GAVEL classifies each citation before verifying it:

- **EU Regulations** (DORA, GDPR, MiFID, etc.) → live fetch from EU Publications Office Cellar API
- **UK Domestic Statutes** (CDPA 1988, Patents Act 1977, FSMA 2000, etc.) → verified from statute knowledge; no EU Cellar lookup attempted
- **EU Directives post-Brexit** → flagged with nuanced analysis: the directive no longer has direct UK effect, but UK implementations may apply

### GAVEL Score

Each claim receives a 0–100 reliability score. A Monte Carlo simulation (N=2,000) models interpretive variance across all agent findings to produce:
- Expected score distribution
- Probability of DO NOT SEND / REVIEW REQUIRED / PROCEED verdict
- P5/P95 confidence bounds

---

## Features

- **Two modes**: Verify existing citations, or Find citations for an uncited document
- **Grammarly-style review**: Wavy underlines on citations, click for verdict + fix suggestion
- **Live Audit Story**: Streaming feed of agent findings as they arrive — each card shows agent name, Sonnet 4.6 badge, verdict pill, personality quote, and result
- **Agent Graph**: Cinematic visualization of the agent network running in real time
- **Risk Simulation**: Monte Carlo probability distribution — auto-runs when you open the tab
- **Export**: Download a formatted `.docx` verification report or send by email

---

## Architecture

```
app/
  page.tsx              — Main UI: mode-select → setup → running → review → done
  AuditStory.tsx        — Live streaming agent card feed
  AgentGraph.tsx        — Canvas-based agent network visualization
  AgentRoster.tsx       — Agent personality panel
  VerificationStepper.tsx — Grammarly-style document review
  MonteCarloPanel.tsx   — Risk simulation UI

lib/
  orchestrator-agent.ts — Sonnet 4.6 orchestrator — calls all 5 agents per claim in parallel
  claim-extractor.ts    — Extracts the 8 highest-risk claims from a document
  scorer.ts             — Computes GAVEL score from 5 agent results

  agents/
    sourcer.ts          — Citation Sourcer (EU Cellar + UK statute knowledge)
    jurisdictionist.ts  — Jurisdictionist (EU regulation vs UK statute classifier)
    historian.ts        — Legal Historian (EU Cellar amendments + UK statute currency)
    devils-advocate.ts  — Devil's Advocate (web search + SPARQL)
    firm-memory.ts      — Firm Memory (vector-search mock over prior opinions)

  tools.ts              — EU Cellar fetch, SPARQL, web search tool definitions

app/api/
  audit/route.ts        — Streaming audit endpoint (AI SDK ToolLoopAgent)
  extract-text/         — PDF/DOCX text extraction
  generate-citations/   — Citation finder (Opus-powered)
  export-docx/          — Report export
  monte-carlo-advice/   — AI refinement suggestions
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- An Anthropic API key (Claude Sonnet 4.6 + Claude Opus 4.8)

### Install

```bash
cd gavel
npm install
```

### Environment

Create `.env.local`:

```env
ANTHROPIC_API_KEY=sk-ant-...

# Optional — Neo4j for evidence graph (app works without it)
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

## Usage

### Verify Citations

1. Choose **Verify Citations**
2. Paste or upload your legal memo (PDF, Word, or plain text)
3. Enter a client description (e.g. "UK-based fintech with no EU establishment")
4. Click **Begin Verification**

GAVEL identifies the 8 most legally significant claims, runs all 5 agents in parallel for each, and streams results into the Audit Story feed. Review takes ~2–3 minutes.

### Find Citations

1. Choose **Find Citations**
2. Paste your uncited document
3. Click **Find Relevant Sources** — GAVEL searches for legislation, case law, and practice guides
4. Review the citation list, then click **Verify all** to run the full audit

### Review & Export

- Click any underlined citation in the document to see the verdict and a suggested fix
- Use the Audit Story or Agent Graph tabs to follow the live audit
- Keep or dismiss individual findings in the review phase
- Download a `.docx` report or send by email

---

## Tech Stack

- **Next.js 16** (App Router)
- **Anthropic Claude Sonnet 4.6** — orchestrator and specialist agents
- **Anthropic Claude Opus 4.8** — citation research
- **AI SDK v7** (`useChat`, `ToolLoopAgent`, `createAgentUIStreamResponse`, `generateObject`)
- **EU Publications Office Cellar API** — live article fetching and SPARQL
- **Tailwind CSS v4**
- **Neo4j** (optional) — evidence knowledge graph

---

## Hackathon Context

Built at **Cambridge Hack the Law 2026** in under 24 hours.

**Team**: Sahid Munjavar

**Judges' criteria addressed**:
- *Legal accuracy*: Live citation verification against primary sources, not just LLM knowledge
- *Practical utility*: Grammarly-style UX that fits into existing legal workflow
- *Technical depth*: Multi-agent adversarial architecture with real-time streaming
- *Commercial viability*: Two-minute audit vs hours of manual verification

---

## Caveats

This tool is a proof of concept built for a hackathon. It does not constitute legal advice. All findings should be reviewed by a qualified solicitor before any action is taken. The Firm Memory corpus is mocked for demo purposes — a production deployment would connect to the firm's real document management system via vector search.
