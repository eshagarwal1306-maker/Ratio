import { createAgentUIStreamResponse } from "ai";
import { gravelOrchestrator } from "@/lib/orchestrator-agent";
import { createAuditNode, ensureConstraints, upsertToolCall, linkClaimResult, finaliseAudit } from "@/lib/neo4j";

export const maxDuration = 300;

let constraintsReady = false;
// Single-user demo: track latest auditId so /api/graph/latest can read it
export let currentAuditId = "";

export async function POST(request: Request) {
  const { messages } = await request.json();
  const auditId = `audit-${Date.now()}`;
  currentAuditId = auditId;

  // Ensure Neo4j schema (idempotent)
  if (!constraintsReady) {
    await ensureConstraints().catch(console.error);
    constraintsReady = true;
  }

  // Write the Audit + Orchestrator nodes
  const firstMsg = messages?.[0];
  const docSnippet = (firstMsg?.parts?.[0]?.text ?? "").slice(0, 200);
  await createAuditNode(auditId, docSnippet).catch(console.error);

  let stepCounter = 0;
  // Track callId→toolName for linking claims after
  const activeTools = new Map<string, string>();

  try {
    return await createAgentUIStreamResponse({
      agent: gravelOrchestrator,
      uiMessages: messages ?? [],
      onError: (err) => {
        console.error("RATIO stream error:", err);
        return err instanceof Error ? err.message : String(err);
      },

      onStepEnd: async ({ toolCalls, toolResults }) => {
        stepCounter++;

        // Mark calls as active when they start
        for (const tc of toolCalls) {
          activeTools.set(tc.toolCallId, tc.toolName);
          await upsertToolCall(auditId, tc.toolCallId, tc.toolName, "active", stepCounter, {
            inputSnippet: JSON.stringify(tc.input ?? {}).slice(0, 300),
          }).catch(console.error);
        }

        // Update with results when they arrive
        for (const tr of toolResults) {
          const toolName = activeTools.get(tr.toolCallId) ?? "unknown";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const output = ((tr as any).result ?? (tr as any).output ?? {}) as Record<string, unknown>;
          let state: "done" | "error" = "done";
          let subtitle = "";

          if (toolName === "runJurisdictionist" && output?.status) subtitle = String(output.status).replace(/_/g, " ");
          else if (toolName === "runSourcer" && output?.status) subtitle = String(output.status);
          else if (toolName === "runHistorian" && output?.status) subtitle = String(output.status);
          else if (toolName === "runDevilsAdvocate" && output?.strength) subtitle = `${output.strength} counter`;
          else if (toolName === "runFirmMemory" && output?.status) subtitle = String(output.status).replace(/_/g, " ");
          else if (toolName === "extractClaims" && output?.count) subtitle = `${output.count} claims`;
          else if (toolName === "reportClaim" && output?.score !== undefined) subtitle = `score ${output.score}/100`;

          await upsertToolCall(auditId, tr.toolCallId, toolName, state, stepCounter, {
            subtitle,
            outputSnippet: JSON.stringify(output ?? {}).slice(0, 300),
          }).catch(console.error);

          // Create Claim node when reportClaim resolves
          if (toolName === "reportClaim" && output?.score !== undefined && output?.claim) {
            const claim = output.claim as { text: string };
            const claimIndex = stepCounter;
            await linkClaimResult(auditId, tr.toolCallId, claimIndex, output.score as number, claim.text ?? "").catch(console.error);
          }
        }
      },
    });
  } catch (err) {
    console.error("RATIO route error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    // Mark audit complete if we have any reportClaim results
    await finaliseAudit(auditId, 0).catch(console.error);
  }
}
