# Hack the Law 2026 — Complete Project Brief for Claude Code

> **Event:** LLMxLaw Hackathon 2026  
> **Dates:** 26–28 June 2026  
> **Venue:** Cambridge Judge Business School (CJBS), Trumpington St, Cambridge CB2 1AG  
> **Website:** https://hackthelaw-cambridge.com/  
> **Hacker Notion hub:** https://hackthelaw.notion.site/Key-Hacker-Information-1d4c01c241b280cdb474fd529c2bfd4a  
> **WhatsApp hacker chat:** https://chat.whatsapp.com/DpYiST0XCNaEiGHaf6e19l  

---

## 1. Event Overview

Hack the Law is a legal AI hackathon run in Cambridge, sponsored by leading global law firms and legal tech companies. Teams of up to 4 people (must include at least 1 legal + 1 technical perspective) compete to build AI-powered legal tools over approximately 24 hours.

### Prize structure

| Prize | Amount | Decided by | When |
|---|---|---|---|
| Overall 1st | £10,000 | Grand Finale judges | Sun 28 June |
| Overall 2nd | £5,000 | Grand Finale judges | Sun 28 June |
| Overall 3rd | £2,500 | Grand Finale judges | Sun 28 June |
| Popular vote | £2,500 | Audience | Sun 28 June |
| Challenge prize | Sponsor-specific | Challenge owners | First-round judging |
| Tool use prize | Sponsor-specific | Tool providers | Overnight + first-round |

**Every team competes for all 3 prize tracks simultaneously.** First-round judges shortlist the top 10 teams who go to the Grand Finale.

---

## 2. Full Schedule

### Thursday 25 June — Remote
| Time | Event |
|---|---|
| 10:00–16:00 | Google Cloud Platform deep dive workshop (remote) |

### Friday 26 June — CJBS
| Time | Event |
|---|---|
| ~08:00 | Diamond & Platinum challenges released |
| ~11:00 | Golden challenges released |
| 12:00–17:00 | Tool workshops at CJBS (see Section 5) |
| 17:00–18:00 | **Challenge Q&A** — direct access to all challenge owners |
| 18:00–19:30 | **Team formation + networking drinks** |
| 19:30–21:00 | **Opening ceremony** |
| Tonight | **DEADLINE: submit team + challenge via Hack the Team app** |

### Saturday 27 June — CJBS (Main build day)
| Time | Event |
|---|---|
| All day | **Hacking time** |
| 09:00–11:00 | Conference: Trust, risk, responsibility & ownership |
| 11:00–11:20 | Coffee break |
| 11:20–13:00 | Conference: The changing shape of legal work |
| 13:00–14:00 | Lunch |
| 14:00–16:00 | Conference: Research frontier (short talks) |
| 16:00–16:30 | Coffee break |
| 16:30–17:30 | Conference: Technical horizons for legal AI |
| 17:30–19:00 | Dinner |
| ~19:00 | **⚠️ HARD SUBMISSION DEADLINE — solution via Notion form** |
| 19:00–21:00 | Research competition |
| 21:00+ | Celebration & networking drinks |

### Sunday 28 June — CJBS (Judging day)
| Time | Event |
|---|---|
| ~09:00–11:00 | **First-round judging** (top 10 shortlisted, in-person pitches) |
| ~11:00–13:00 | **Grand Finale judging** |
| ~13:00–15:00 | Award ceremony & closing drinks |

---

## 3. All 8 Challenges

### 3.1 White & Case — AI Hallucination & Citation Checker ⭐ RECOMMENDED

**Difficulty:** Medium — most buildable in hackathon timeframe  
**Notion brief:** https://hackthelaw.notion.site/AI-Hallucination-Citation-Checker-for-legal-documents-378c01c241b2805082a6e71d57732367  
**Dataset:** https://drive.google.com/drive/folders/1_gXd4SSVs_600xwXfPIO77I74qd--tbU  
**Prize:** 3-month mentorship + legal tech conference tickets + in-office shadowing day  
**Related talk:** "When Autopilot Fails: What Legal AI Must Learn from Aviation" — Alistair Wye  
https://hackthelaw.notion.site/When-Autopilot-Fails-What-Legal-AI-Must-Learn-from-Aviation-349c01c241b28037ab18df8425992aef  

#### Background
AI hallucination of legal citations is one of the most documented and damaging failures of LLMs in legal practice. Cases that don't exist have appeared in court filings, leading to sanctions and reputational damage. This challenge builds the tool that catches these before they cause harm.

#### The scenario
A junior associate at Alderton & Marsh LLP has prepared a skeleton argument for an urgent High Court case management hearing (Crestholm Dynamics plc vs Veltros Industries Inc — £47M dispute over induced breach of exclusive supply agreement). The associate used an AI drafting tool under time pressure and cited 12 cases across 3 legal grounds:
1. Tortious interference with contractual relations
2. Availability and quantum of expectation damages for lost future profits
3. Arguability of a without-notice injunction

The partner suspects some citations may be hallucinated or mischaracterised. Filing deadline is 4:00 PM on the day of the hearing.

#### What to build
An LLM-powered citation integrity layer that:
1. **Ingests** uploaded or pasted legal documents (contracts, briefs, memos)
2. **Extracts** all cited cases, statutes, and legal authorities
3. **Verifies** each citation against a legal dataset (mock dataset provided)
4. **Categorises** each citation as:
   - ✅ Real and correctly applied
   - ⚠️ Real but mischaracterised or taken out of context
   - ❌ Non-existent / fabricated

Output must be immediately actionable by a partner with no legal database expertise.

#### Required features
- Document ingestion (upload or paste)
- Citation extraction via LLM or NLP
- Verification against provided mock dataset
- Clear categorisation with flags

#### Bonus features (implement 1–2)
- Confidence score (percentage) per citation's validity
- Plain-language explanation of why a citation is wrong
- Colour-coded visual dashboard of citation health

#### Why this wins rooms
The demo is instantly compelling to non-technical judges: "this case does not exist" needs no explanation. Even a working prototype that catches obvious hallucinations delivers clear, measurable value.

---

### 3.2 Linklaters — From Maze to Map: Navigating Regulatory Regimes

**Difficulty:** High — ambitious scope, start small and scale  
**Notion brief:** https://hackthelaw.notion.site/378c01c241b280abb7b3ffc26f2f714d  
**Recommended data:** EU Publications Office Cellar API — https://hackthelaw.notion.site/EU-Publications-Office-Cellar-API-data-36ec01c241b280509730fb8569253370  
**Prize:** Rabbit R1 AI device (max 5 awarded) + vacation scheme insight at Linklaters London  
**Related talk:** "Bridging Worlds: Client and Law Firm Perspectives on AI and Innovation" — Tanya Sadoughi & Jonathan Hew  
https://hackthelaw.notion.site/Bridging-Worlds-Client-and-Law-Firm-Perspectives-on-AI-and-Innovation-349c01c241b28032a5c3db1999f1ba26  

#### Background
Lawyers advising international businesses on compliance must quickly get up to speed with regulatory regimes across multiple jurisdictions. Regulatory regimes are never just one Act — they include primary legislation, secondary legislation, regulatory guidance, case law, and legislative debates, all interlinked, some subject to change, each with its own legal weight.

Current tooling solves parts of the problem but not the whole. Specialist legal research tools may have hard law but miss soft legislative debates; regulators' tools may have the opposite issue.

#### The scenario
You are advising a major technology business on how the UK Online Safety Act and the wider online safety regime (overseen by Ofcom) applies to its products. There was significant legislative debate in the run-up to the Act's passage that may be relevant. The tool should also help surface points of alignment/conflict between:
- UK Online Safety Act ↔ EU Digital Services Act (overseen by the Commission)
- UK Online Safety Act ↔ UK GDPR and Data Protection Act (overseen by the ICO)

#### What to build
A tool that, given a regulatory regime and jurisdiction:
1. **Auto-identifies** all relevant sources of documentation
2. **Auto-retrieves** that documentation into a repository
3. **Auto-organises** the repository so it is navigable, reflects legal hierarchy, and is verifiable/editable by users
4. **Enables** natural language queries of the repository
5. **Accurately responds** to queries, ranks avenues of enquiry by importance, cites provisions accurately, and accounts for legal hierarchy:
   - Acts of Parliament > Secondary legislation > Regulatory guidance > Case law > Legislative debates

#### Legal hierarchy to implement
```
Acts of Parliament          (highest weight)
     ↓
Secondary legislation / Statutory instruments
     ↓
Regulatory guidance (Ofcom, ICO, etc.)
     ↓
Case law
     ↓
Legislative debates / Hansard  (lowest weight, but contextually relevant)
```

#### Bonus features
- Auto-check for updates to the regime and incorporate into a new version of the repository
- Multi-regime comparison (UK OSA ↔ EU DSA ↔ UK GDPR)

#### Linklaters' own advice
> "Start small and scale-up from there."

---

### 3.3 Clifford Chance — How Do We Supervise Legal AI Agents?

**Difficulty:** Medium-High — conceptually open, solution space is wide  
**Notion brief:** https://hackthelaw.notion.site/How-Do-We-Supervise-Legal-AI-Agents-378c01c241b2802587d9e46e2f20d3c0  
**Recommended data:** EU Cellar API  
**Prize:** Insights Experience for up to 4 — meet CTO, legal tech team, fee earners, office tour  
**Related talk:** "Trust, Transformed" — Anthony Widdop  
https://hackthelaw.notion.site/Trust-Transformed-349c01c241b280e9a098e230beb159c8  

#### Background
Legal work is increasingly carried out by hybrid human–AI teams. AI already drafts, summarises, analyses, and recommends — but responsibility still sits with human lawyers. Traditional supervision models (partner review, hierarchical delegation) were designed for human-only teams and don't translate cleanly to AI that operates autonomously, at scale, across multiple matters simultaneously.

#### The scenario
A supervising lawyer at a global law firm relies on multiple AI agents to assist on live matters. These agents generate drafts, synthesise documents, identify risks, and propose recommendations. The lawyer cannot manually review every AI output. They need to:
- See what the AI has done
- Understand why it reached certain conclusions
- Identify where human review is most needed
- Confidently approve, amend, or reject AI contributions

**Assume the firm is already committed to using AI — your task is not to restrict AI use but to make its supervision effective, defensible, and scalable.**

#### Required features
- **Transparency:** Visibility into AI work, actions taken, citations, reasoning
- **Risk/confidence signalling:** Highlight outputs requiring higher human review
- **Supervisory controls:** Enable lawyers to intervene, approve, or override
- **Auditability:** Clear supervisory trail showing how decisions were made

#### Bonus features (choose 1–2)
- Supervisor-friendly UI with structured, prioritised outputs
- Comparison of AI outputs against firm standards or prior work
- Predictive indicators of risk, uncertainty, or potential errors

---

### 3.4 Clio — Is It Still Good Law? Building an Open Citator

**Difficulty:** Medium  
**Notion brief:** https://hackthelaw.notion.site/378c01c241b280acba44f7f15980db26  
**Prize:** 12-month Vincent subscription + £250 Amazon voucher each (max 4) + featured on Clio website and social channels  
**Related talk:** "Slow Wisdom, Fast Execution: Lessons from Law and Tech on Building AI That Works"  
https://hackthelaw.notion.site/Slow-Wisdom-Fast-Execution-Lessons-from-Law-and-Tech-on-Building-AI-That-Works-349c01c241b280b2a8e0d8a34cadba5e  

#### What to build
An open-source tool to check whether a case citation is still "good law" — i.e. whether it has been overturned, distinguished, criticised, or superseded by later decisions. This is closely adjacent to the W&C citation checker challenge and shares significant technical overlap in citation verification infrastructure.

---

### 3.5 Luminance — Confidence in Legal AI

**Difficulty:** Medium  
**Notion brief:** https://hackthelaw.notion.site/378c01c241b2804fb18ad77567f4c662  
**Prize:** $1,000 AWS Bedrock credits + 4× £100 Love Cambridge gift cards + 4× mentoring sessions at Luminance Cambridge office  
**Related talk:** "Building Legal AI: The Challenges of Changing the Legal Industry"  
https://hackthelaw.notion.site/Building-Legal-AI-The-Challenges-of-Changing-the-Legal-Industry-349c01c241b280239518d60ee05caaab  

#### What to build
A system that produces calibrated confidence scores for AI legal outputs — quantifying how much lawyers should trust any given AI output and when they need to review carefully. Addresses the core problem that AI outputs in legal contexts have no native uncertainty signal.

---

### 3.6 CMS — Pleading-to-Proof: AI Case Theory Stress Test

**Difficulty:** Medium  
**Notion brief:** https://hackthelaw.notion.site/378c01c241b2808da2e9e95f835e96b3  
**Prize:** 1-week internship at CMS (remote/in-person) + Harvey/CMS goody bag  
**Related talk:** "Forget You're a Lawyer: How to Win an Innovation Competition in a Law Firm"  
https://hackthelaw.notion.site/Forget-You-re-a-Lawyer-How-to-Win-an-Innovation-Competition-in-a-Law-Firm-349c01c241b28019b3c3f6551fe7a660  

#### What to build
A tool that stress-tests legal case theories — identifying weaknesses in arguments from pleadings through to trial evidence. Works with Harvey AI (CMS's legal AI partner).

---

### 3.7 Bar Standards Board — AI at the Bar: Overcoming Barriers to Effective Adoption

**Difficulty:** Low-Medium (more research/policy than pure build)  
**Prize:** Mentoring + relevant introductions + shadowing within the BSB + prototype-building help + potential publication support  

#### What to build
Address real barriers preventing effective AI adoption at the Bar — access to justice, regulatory constraints, professional ethics, training gaps, and public trust. As a public interest regulator, the BSB can offer meaningful publication support for exceptional proposals.

---

### 3.8 Legora — The Sparring Room

**Difficulty:** Medium  
**Notion brief:** https://hackthelaw.notion.site/378c01c241b280a3a096f761c6d0dd2a  
**Prize:** Legora merch + potential 2-week internship at Legora London offices  

#### What to build
An adversarial AI system that acts as a legal sparring partner — pushing back on arguments, steelmanning opposing positions, identifying weaknesses, and forcing lawyers to stress-test their reasoning before presenting to clients or courts.

---

## 4. Key People

### Grand Finale Judges
| Name | Firm | Role |
|---|---|---|
| Jonathan Hew | Linklaters | Innovation Managing Associate (AI Lawyer) |
| Robert Clay | Clifford Chance | Head of Ideation & Exploration, Legal Technology Solutions |
| Alistair Wye | White & Case | Director, Innovation & AI |

### First-Round Judges
| Name | Firm | Role |
|---|---|---|
| Utkarsh Bhargava | Clifford Chance | Senior Legal Technology Advisor |
| Deborah Afolabi | White & Case | Analyst, Practice Technology |
| Mansi Narayan | Linklaters | AI Lawyer (Litigation, Arbitration & Investigations) |

### Key Speakers (Saturday — attend if doing their firm's challenge)
| Name | Firm | Talk | Link |
|---|---|---|---|
| Tanya Sadoughi | Linklaters | Bridging Worlds: Client and Law Firm Perspectives on AI and Innovation | https://hackthelaw.notion.site/Bridging-Worlds-Client-and-Law-Firm-Perspectives-on-AI-and-Innovation-349c01c241b28032a5c3db1999f1ba26 |
| Alistair Wye | White & Case | When Autopilot Fails: What Legal AI Must Learn from Aviation | https://hackthelaw.notion.site/When-Autopilot-Fails-What-Legal-AI-Must-Learn-from-Aviation-349c01c241b28037ab18df8425992aef |
| Anthony Widdop | Clifford Chance | Trust, Transformed | https://hackthelaw.notion.site/Trust-Transformed-349c01c241b280e9a098e230beb159c8 |

> **Note on Tanya Sadoughi:** Her talk covers the agentic AI governance principles Linklaters has developed for responsible deployment of autonomous AI systems. The Linklaters challenge brief explicitly references this talk as providing "concrete reference points for the auditability requirements built into the challenge." Attend if doing that challenge.

---

## 5. Tools & Workshops

You must use at least one tool. Each tool you use also enters you into that tool's separate prize track — stack tools to enter more prize tracks simultaneously.

### Tools with workshops today (Fri 26 June at CJBS)
| Time | Tool | Workshop brief |
|---|---|---|
| 12:00 | Neo4j + EURLEX API | https://hackthelaw.notion.site/Connecting-Neo4j-and-EURLEX-API-372c01c241b280079913de659a4d978d |
| 12:30 | Claude Code (Anthropic) | https://hackthelaw.notion.site/Legal-prototyping-with-Claude-Code-372c01c241b280288c45e765a5b2826d |
| 13:20 | Google Cloud (Gemini + BigQuery) | https://hackthelaw.notion.site/Building-on-Gemini-and-BigQuery-372c01c241b2800985a8ebaa94f17eed |
| 13:50 | Momen (no-code) | https://hackthelaw.notion.site/Build-a-Multimodal-Intake-and-Triage-Copilot-372c01c241b280a9a056e730f26e3c6e |
| 14:40 | Perplexity Agent API | https://hackthelaw.notion.site/Building-with-Perplexity-s-Agent-API-376c01c241b28021a0fbf6f535814c97 |
| 15:10 | NVIDIA | https://hackthelaw.notion.site/Building-with-NVIDIA-372c01c241b280edbb8ef6908afb93b6 |

### Other available tools
| Tool | Description | Page |
|---|---|---|
| Lovable | Vibe-code frontend builder | https://hackthelaw.notion.site/Lovable-vibe-code-36ec01c241b280bf9a75d583a5491127 |
| EU Cellar API | Official EU Publications Office data | https://hackthelaw.notion.site/EU-Publications-Office-Cellar-API-data-36ec01c241b280509730fb8569253370 |
| Google Cloud Platform | Full GCP suite | https://hackthelaw.notion.site/Google-Cloud-s-Platform-GCP-36ec01c241b280039163f153899cf032 |

**All tools:** https://hackthelaw.notion.site/LLMxLaw-Hackathon-Tools-36ec01c241b280c8a109c87eeb900a11  
**All workshops:** https://hackthelaw.notion.site/LLMxLaw-Tool-Workshops-372c01c241b28078a6e2f8dd93420856  

### Recommended tool stacks by challenge
**White & Case (citation checker):**
- Claude Code — LLM-powered extraction and verification logic
- Neo4j — case law knowledge graph for citation relationships
- Perplexity — live web lookup to verify citations exist

**Linklaters (regulatory navigator):**
- GCP (Vertex AI + BigQuery) — RAG pipeline and document storage
- EU Cellar API — primary data source for EU legislation
- Neo4j — graph structure for regulatory hierarchy mapping

**Clifford Chance (AI supervision):**
- Claude Code — agent orchestration and audit trail logic
- GCP — scalable multi-agent infrastructure
- Momen — no-code UI layer for supervisor dashboard

---

## 6. Judging Criteria

### Overall judging (Grand Finale)
Full criteria: https://hackthelaw.notion.site/2026-Judging-Criteria-20fc01c241b280d2ab27cb51251c366a

General principles from the challenge briefs:
- **Working demo is essential** — judges have ~10 minutes with each team
- **Non-technical accessibility** — output must be understandable without legal database expertise
- **Clear impact** — what real problem does this solve, and for whom
- **Technical robustness** — does it actually work reliably
- **Legal accuracy** — does it respect legal hierarchy and context

### Challenge-specific criteria
Each challenge owner sets their own criteria. Key signals from the briefs:

**White & Case:** "The partner must be able to act on the output immediately, without any legal database expertise. The output must be clear, actionable, and trustworthy."

**Linklaters:** Values comprehensiveness of source coverage, accuracy of hierarchy weighting, quality of natural language responses with proper citations.

**Clifford Chance:** Transparency, risk signalling, supervisory controls, and auditability are the four explicit requirements.

---

## 7. Competition Rules

- Teams: max 4 people
- Must include at least 1 person covering legal perspective + at least 1 covering technical (not tied to formal education)
- Teams formed and finalised on-site on Friday 26 June
- Must build a solution for one challenge using at least one hackathon tool
- Must submit via Notion form before ~19:00 on Saturday
- Must explain tool use in submission form (required for tool prize eligibility)
- First-round judging is **in person** on Sunday — teams must be present

---

## 8. Sponsor Firm Profiles

### White & Case (Platinum sponsor)
- 43 offices, 29 countries, 6 continents
- Proprietary AI chatbot: Atlas
- Strategic partnership with Legora (firmwide rollout)
- Launching an AI Lab for hypothesis-led AI experiments
- Contact: Philip Cooney (Senior Manager, Practice Technology)

### Linklaters
- Magic Circle firm, 30 offices worldwide
- Rolled out Legora firmwide across all 30 offices (Sept 2025) — one of the largest BigLaw legal AI implementations
- Launched 20-strong global team of dedicated AI Lawyers (Nov 2025)
- Launched Applied Intelligence practice (May 2026) — bespoke AI tools for individual client mandates
- Contact: Mansi Narayan (AI Lawyer, Litigation, Arbitration & Investigations)

### Clifford Chance
- Leading global law firm
- 4th consecutive year as Most Popular Graduate Recruiter in Law (65,000+ students)
- Ranked 14th in Times Top 100 — highest ever for a law firm
- Contact: Robert Clay / Utkarsh Bhargava

---

## 9. Strategic Notes for Building

### Start with the White & Case challenge if uncertain
- Most tightly scoped: 12 citations, one document, clear pass/fail criteria
- Mock dataset provided — no data sourcing problem
- Demo is immediately legible to non-technical judges
- Even a prototype that catches obvious hallucinations scores well

### Legal hierarchy (critical for Linklaters + any citation work)
When building any tool that reasons about legal sources, implement this weighting:
```
1. Primary legislation (Acts of Parliament)     — highest authority
2. Secondary legislation (Statutory instruments)
3. EU Regulations (directly applicable)
4. Regulatory guidance (Ofcom, ICO, FCA, etc.)
5. Case law (precedent — check if still good law)
6. Academic commentary
7. Legislative debates (Hansard)               — lowest weight, context only
```

### Hallucination in legal AI — key patterns to detect
When building citation verification:
- **Ghost citations:** case name sounds plausible, year and court plausible, but case does not exist
- **Citation transplants:** real case, wrong proposition — the case exists but doesn't stand for what's claimed
- **Misattributed quotes:** real case, fabricated quote or ratio attributed to it
- **Jurisdiction confusion:** real case from wrong jurisdiction applied as if binding
- **Overruled cases:** real case, correctly applied, but has since been overruled — still "wrong" to cite without caveat

### Demo advice
- Show the tool working on the provided scenario, not a generic demo
- Lead with the most dramatic finding first ("this case does not exist")
- Colour-coding in the output is worth implementing — judges remember visual output
- Have a fallback if live demo fails: screenshots or a recorded walkthrough

---

## 10. All Notion Links (Quick Reference)

| Page | URL |
|---|---|
| Key hacker information | https://hackthelaw.notion.site/Key-Hacker-Information-1d4c01c241b280cdb474fd529c2bfd4a |
| All challenges | https://hackthelaw.notion.site/LLMxLaw-Hackathon-Challenges-386c01c241b2808cb026cf612416c541 |
| All tools | https://hackthelaw.notion.site/LLMxLaw-Hackathon-Tools-36ec01c241b280c8a109c87eeb900a11 |
| All workshops | https://hackthelaw.notion.site/LLMxLaw-Tool-Workshops-372c01c241b28078a6e2f8dd93420856 |
| Conference programme | https://hackthelaw.notion.site/LLMxLaw-Conference-Trusting-AI-in-High-Stakes-Legal-Domain-349c01c241b28075bed8ccc5cfab44c1 |
| Judging criteria | https://hackthelaw.notion.site/2026-Judging-Criteria-20fc01c241b280d2ab27cb51251c366a |
| W&C challenge | https://hackthelaw.notion.site/AI-Hallucination-Citation-Checker-for-legal-documents-378c01c241b2805082a6e71d57732367 |
| Linklaters challenge | https://hackthelaw.notion.site/378c01c241b280abb7b3ffc26f2f714d |
| Clifford Chance challenge | https://hackthelaw.notion.site/How-Do-We-Supervise-Legal-AI-Agents-378c01c241b2802587d9e46e2f20d3c0 |
| Clio challenge | https://hackthelaw.notion.site/378c01c241b280acba44f7f15980db26 |
| Luminance challenge | https://hackthelaw.notion.site/378c01c241b2804fb18ad77567f4c662 |
| CMS challenge | https://hackthelaw.notion.site/378c01c241b2808da2e9e95f835e96b3 |
| Legora challenge | https://hackthelaw.notion.site/378c01c241b280a3a096f761c6d0dd2a |
| W&C dataset (Google Drive) | https://drive.google.com/drive/folders/1_gXd4SSVs_600xwXfPIO77I74qd--tbU |
| EU Cellar API guide | https://hackthelaw.notion.site/EU-Publications-Office-Cellar-API-data-36ec01c241b280509730fb8569253370 |
| Claude Code tool page | https://hackthelaw.notion.site/Anthropic-s-Claude-Code-36ec01c241b280e5b939e5959dbad365 |
| Neo4j + EURLEX workshop | https://hackthelaw.notion.site/Connecting-Neo4j-and-EURLEX-API-372c01c241b280079913de659a4d978d |
| GCP tool page | https://hackthelaw.notion.site/Google-Cloud-s-Platform-GCP-36ec01c241b280039163f153899cf032 |
| Perplexity workshop | https://hackthelaw.notion.site/Building-with-Perplexity-s-Agent-API-376c01c241b28021a0fbf6f535814c97 |
| Lovable tool page | https://hackthelaw.notion.site/Lovable-vibe-code-36ec01c241b280bf9a75d583a5491127 |

---

*Last updated: 26 June 2026. Brief compiled from official Hack the Law 2026 Notion pages.*
