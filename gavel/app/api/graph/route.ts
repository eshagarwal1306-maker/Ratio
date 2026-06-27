import { NextResponse } from "next/server";
import { getAuditGraph } from "@/lib/neo4j";
import { currentAuditId } from "@/app/api/audit/route";

export async function GET() {
  if (!currentAuditId) return NextResponse.json({ nodes: [], links: [] });

  try {
    const graph = await getAuditGraph(currentAuditId);
    return NextResponse.json(graph);
  } catch (err) {
    console.error("Graph query error:", err);
    return NextResponse.json({ nodes: [], links: [], error: String(err) });
  }
}
