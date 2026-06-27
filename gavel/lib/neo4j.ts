import neo4j, { type Driver } from "neo4j-driver";

let _driver: Driver | null = null;

export function getDriver(): Driver {
  if (!_driver) {
    _driver = neo4j.driver(
      process.env.NEO4J_URI!,
      neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!),
      { disableLosslessIntegers: true }
    );
  }
  return _driver;
}

// ─── Schema init — call once on first audit ───────────────────────────────────

export async function ensureConstraints() {
  const session = getDriver().session();
  try {
    await session.run(`CREATE CONSTRAINT audit_id IF NOT EXISTS FOR (a:Audit) REQUIRE a.id IS UNIQUE`);
    await session.run(`CREATE CONSTRAINT toolcall_id IF NOT EXISTS FOR (t:ToolCall) REQUIRE t.id IS UNIQUE`);
  } catch { /* ignore if already exist */ } finally {
    await session.close();
  }
}

// ─── Write helpers ────────────────────────────────────────────────────────────

export async function createAuditNode(auditId: string, documentSnippet: string) {
  const session = getDriver().session();
  try {
    await session.run(
      `MERGE (a:Audit {id: $id})
       SET a.document = $doc, a.startedAt = datetime(), a.status = "running"`,
      { id: auditId, doc: documentSnippet.slice(0, 200) }
    );
    // Orchestrator node (one per audit)
    await session.run(
      `MERGE (o:Orchestrator {auditId: $id})
       SET o.model = "claude-opus-4-8", o.label = "OPUS"
       WITH o
       MATCH (a:Audit {id: $id})
       MERGE (a)-[:HAS_ORCHESTRATOR]->(o)`,
      { id: auditId }
    );
  } finally {
    await session.close();
  }
}

export async function upsertToolCall(
  auditId: string,
  callId: string,
  toolName: string,
  state: "active" | "done" | "error",
  step: number,
  extra: Record<string, unknown> = {}
) {
  const session = getDriver().session();
  try {
    await session.run(
      `MERGE (t:ToolCall {id: $callId})
       SET t.toolName = $toolName,
           t.state = $state,
           t.step = $step,
           t.auditId = $auditId,
           t.updatedAt = datetime(),
           t += $extra
       WITH t
       MATCH (o:Orchestrator {auditId: $auditId})
       MERGE (o)-[:CALLED {step: $step}]->(t)`,
      { callId, toolName, state, step, auditId, extra }
    );
  } finally {
    await session.close();
  }
}

export async function linkClaimResult(
  auditId: string,
  callId: string,
  claimIndex: number,
  score: number,
  claimText: string
) {
  const session = getDriver().session();
  try {
    const claimId = `${auditId}-claim-${claimIndex}`;
    await session.run(
      `MERGE (c:Claim {id: $claimId})
       SET c.text = $text, c.score = $score, c.auditId = $auditId
       WITH c
       MATCH (t:ToolCall {id: $callId})
       MERGE (t)-[:REPORTED]->(c)
       WITH c
       MATCH (a:Audit {id: $auditId})
       MERGE (a)-[:HAS_CLAIM]->(c)`,
      { claimId, text: claimText.slice(0, 300), score, auditId, callId }
    );
  } finally {
    await session.close();
  }
}

export async function finaliseAudit(auditId: string, overallScore: number) {
  const session = getDriver().session();
  try {
    await session.run(
      `MATCH (a:Audit {id: $id}) SET a.status = "complete", a.overallScore = $score, a.finishedAt = datetime()`,
      { id: auditId, score: overallScore }
    );
  } finally {
    await session.close();
  }
}

// ─── Query for frontend graph ─────────────────────────────────────────────────

export async function getAuditGraph(auditId: string) {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Orchestrator {auditId: $id})-[r:CALLED]->(t:ToolCall)
       OPTIONAL MATCH (t)-[:REPORTED]->(c:Claim)
       RETURN o, r, t, c
       ORDER BY t.step ASC`,
      { id: auditId }
    );

    const nodes: Record<string, unknown>[] = [];
    const links: { source: string; target: string; label: string }[] = [];
    const seenNodes = new Set<string>();

    const orchId = `orch-${auditId}`;
    if (!seenNodes.has(orchId)) {
      nodes.push({ id: orchId, label: "OPUS", type: "orchestrator", color: "#4a9eff", size: 14 });
      seenNodes.add(orchId);
    }

    for (const rec of result.records) {
      const t = rec.get("t")?.properties;
      const c = rec.get("c")?.properties;

      if (t && !seenNodes.has(t.id)) {
        nodes.push({
          id: t.id,
          label: t.toolName,
          type: "tool",
          state: t.state,
          step: t.step,
          subtitle: t.subtitle ?? "",
          color: TOOL_COLORS[t.toolName as string] ?? "#6e6e8a",
          size: 9,
        });
        seenNodes.add(t.id);
        links.push({ source: orchId, target: t.id, label: `step ${t.step}` });
      }

      if (c && !seenNodes.has(c.id)) {
        const scoreColor = c.score < 40 ? "#ff3b5c" : c.score < 70 ? "#f5a623" : "#00d98b";
        nodes.push({
          id: c.id,
          label: `${c.score}/100`,
          type: "claim",
          score: c.score,
          text: c.text,
          color: scoreColor,
          size: 7,
        });
        seenNodes.add(c.id);
        if (t) links.push({ source: t.id, target: c.id, label: "reported" });
      }
    }

    return { nodes, links };
  } finally {
    await session.close();
  }
}

const TOOL_COLORS: Record<string, string> = {
  extractClaims:        "#4a9eff",
  runSourcer:           "#00d98b",
  runJurisdictionist:   "#9f7aea",
  runHistorian:         "#f5a623",
  runDevilsAdvocate:    "#ff6b6b",
  runFirmMemory:        "#00d9d9",
  deepResearch:         "#d0a0ff",
  reportClaim:          "#f5a623",
};
