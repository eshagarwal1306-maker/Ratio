# RATIO — Technology Stack

## Claude (Anthropic)
The reasoning core. Orchestrates all five audit agents, reads PDFs natively, handles jurisdiction analysis, surfaces counter-authority, and simulates adversarial stakeholder personas. Legal reasoning requires genuine contextual judgment — not retrieval.

## Nemotron (NVIDIA via OpenRouter)
Powers the Monte Carlo Proposition Match. Runs 18 parallel inferences across interpretive stances and factual framings simultaneously. Claude Sonnet at this volume would be rate-limited and cost-prohibitive — Nemotron makes the probability distribution approach economically viable.

## Neo4j
Stores the citation relationship graph. Tracks which cases cite which cases, which statutes were amended, and which prior firm opinions intersect with the current memo. Legal authority is relational — contradictions and overrulings cannot be found without graph traversal.

## Perplexity + EU Open Data
Live regulatory verification against EUR-Lex, legislation.gov.uk, and EBA/ESMA guidance. Every AI model has a training cutoff — DORA, MiCAR, and Basel 3.1 were all finalised in 2024–25. Perplexity is the only way to verify provision numbers against the current published text regardless of when the model was trained.
