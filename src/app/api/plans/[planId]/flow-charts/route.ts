import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { flowCharts } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { ensureDefaultFlowChart } from "@/lib/logic/flow-chart";

// GET — list all flow charts for this plan (auto-creates default if none)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  await ensureDefaultFlowChart(planId);

  const charts = await db
    .select()
    .from(flowCharts)
    .where(eq(flowCharts.haccpPlanId, planId))
    .orderBy(asc(flowCharts.createdAt))
    .all();

  return NextResponse.json(charts);
}

// POST — create a new flow chart for this plan
export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { name, description, flowChartType } = body;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const VALID_TYPES = new Set(["main_process", "byproduct", "incoming_ingredient", "waste_stream", "other"]);
  if (flowChartType && !VALID_TYPES.has(flowChartType)) {
    return NextResponse.json({ error: `Invalid flowChartType. Must be one of: ${[...VALID_TYPES].join(", ")}` }, { status: 400 });
  }

  const id = generateId();
  await db.insert(flowCharts).values({
    id,
    haccpPlanId: planId,
    name,
    description: description ?? null,
    flowChartType: flowChartType ?? "other",
  }).run();

  const created = await db.select().from(flowCharts).where(eq(flowCharts.id, id)).get();
  return NextResponse.json(created, { status: 201 });
}

// PUT — update a flow chart's metadata
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const chart = await db.select().from(flowCharts).where(eq(flowCharts.id, id)).get();
  if (!chart || chart.haccpPlanId !== planId) {
    return NextResponse.json({ error: "Flow chart not found" }, { status: 404 });
  }

  await db.update(flowCharts).set(updates).where(eq(flowCharts.id, id)).run();
  return NextResponse.json(await db.select().from(flowCharts).where(eq(flowCharts.id, id)).get());
}

// DELETE — delete a flow chart (and its steps via cascade)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const chart = await db.select().from(flowCharts).where(eq(flowCharts.id, id)).get();
  if (!chart || chart.haccpPlanId !== planId) {
    return NextResponse.json({ error: "Flow chart not found" }, { status: 404 });
  }

  // Prevent deleting the last flow chart
  const allCharts = await db.select().from(flowCharts).where(eq(flowCharts.haccpPlanId, planId)).all();
  if (allCharts.length <= 1) {
    return NextResponse.json({ error: "Cannot delete the last flow chart. A plan must have at least one." }, { status: 400 });
  }

  await db.delete(flowCharts).where(eq(flowCharts.id, id)).run();
  return NextResponse.json({ success: true });
}
