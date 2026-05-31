import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processSteps, flowChartSteps } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getNextNumber } from "@/lib/logic/numbering";
import { ensureDefaultFlowChart, ensureJunction } from "@/lib/logic/flow-chart";

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseOverrides(json: string | null): { name?: string; description?: string } {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

/**
 * Get the active flow chart for a plan (from optional ?chartId param or default).
 * Also ensures junction is populated.
 */
async function resolveFlowChart(planId: string, chartId?: string | null) {
  if (chartId) {
    await ensureJunction(chartId, planId);
    return chartId;
  }
  const chart = await ensureDefaultFlowChart(planId);
  await ensureJunction(chart.id, planId);
  return chart.id;
}

/**
 * Fetch all steps for a flow chart via the junction, with local overrides applied.
 */
async function getStepsForChart(flowChartId: string) {
  const rows = await db
    .select({ junction: flowChartSteps, step: processSteps })
    .from(flowChartSteps)
    .innerJoin(processSteps, eq(flowChartSteps.stepId, processSteps.id))
    .where(eq(flowChartSteps.flowChartId, flowChartId))
    .orderBy(asc(flowChartSteps.sequence))
    .all();

  return rows.map(({ junction, step }) => {
    const overrides = parseOverrides(junction.localOverrides);
    return {
      ...step,
      junctionId: junction.id,
      sequence: junction.sequence,
      isShared: junction.isShared,
      localOverrides: overrides,
      name:        overrides.name        ?? step.name,
      description: overrides.description ?? step.description,
      masterName:        step.name,
      masterDescription: step.description,
    };
  });
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const { searchParams } = new URL(req.url);
  const chartId = searchParams.get("chartId");

  const flowChartId = await resolveFlowChart(planId, chartId);
  const steps = await getStepsForChart(flowChartId);
  return NextResponse.json(steps);
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { searchParams } = new URL(req.url);
  const chartId = searchParams.get("chartId");

  const flowChartId = await resolveFlowChart(planId, chartId);

  // ── Reorder ──
  if (body.action === "reorder") {
    const { stepIds } = body as { action: string; stepIds: string[] };
    for (let i = 0; i < stepIds.length; i++) {
      // Find junction row for this (flowChart, step)
      const jRows = await db
        .select()
        .from(flowChartSteps)
        .where(eq(flowChartSteps.stepId, stepIds[i]))
        .all();
      const jRow = jRows.find((j) => j.flowChartId === flowChartId);
      if (jRow) {
        await db.update(flowChartSteps)
          .set({ sequence: i + 1 })
          .where(eq(flowChartSteps.id, jRow.id))
          .run();
      }
      // Sync stepNumber on home plan's steps
      const step = await db.select().from(processSteps).where(eq(processSteps.id, stepIds[i])).get();
      if (step?.planId === planId) {
        await db.update(processSteps).set({ stepNumber: i + 1 }).where(eq(processSteps.id, stepIds[i])).run();
      }
    }
    return NextResponse.json({ success: true });
  }

  // ── Create step ──
  const jRows = await db
    .select({ sequence: flowChartSteps.sequence })
    .from(flowChartSteps)
    .where(eq(flowChartSteps.flowChartId, flowChartId))
    .all();

  const existingNumberRows = await db
    .select({ stepNumber: processSteps.stepNumber })
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .all();

  const nextNumber = body.stepNumber ?? getNextNumber(existingNumberRows.map((s) => s.stepNumber));
  const nextSeq = jRows.length > 0 ? Math.max(...jRows.map((j) => j.sequence)) + 1 : nextNumber;

  const stepId = generateId();
  const step = {
    id: stepId,
    planId,
    stepNumber: nextNumber,
    name: body.name || `Step ${nextNumber}`,
    description: body.description || "",
    category: body.category || "processing",
    stepType: body.stepType ?? null,
    isCcp: false,
    ccpNumber: null,
    isSharedMaster: false,
  };

  await db.insert(processSteps).values(step).run();

  const junctionId = generateId();
  await db.insert(flowChartSteps).values({
    id: junctionId,
    flowChartId,
    stepId,
    sequence: nextSeq,
    isShared: false,
    localOverrides: null,
  }).run();

  await logAudit({ planId, entityType: "process_step", entityId: stepId, action: "create", newValue: step });

  return NextResponse.json({ ...step, junctionId, sequence: nextSeq, isShared: false, localOverrides: null }, { status: 201 });
}

// ── PUT ────────────────────────────────────────────────────────────────────────

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { id, localOverrides, ...masterUpdates } = body;
  const { searchParams } = new URL(req.url);
  const chartId = searchParams.get("chartId");

  const step = await db.select().from(processSteps).where(eq(processSteps.id, id)).get();
  if (!step) return NextResponse.json({ error: "Step not found" }, { status: 404 });

  // Local overrides → write to junction for this chart
  if (localOverrides !== undefined) {
    const flowChartId = await resolveFlowChart(planId, chartId);
    const jRows = await db.select().from(flowChartSteps).where(eq(flowChartSteps.stepId, id)).all();
    const jRow = jRows.find((j) => j.flowChartId === flowChartId);
    if (jRow) {
      const existing = parseOverrides(jRow.localOverrides);
      const merged = Object.fromEntries(
        Object.entries({ ...existing, ...localOverrides }).filter(([, v]) => v !== null),
      );
      await db.update(flowChartSteps)
        .set({ localOverrides: Object.keys(merged).length > 0 ? JSON.stringify(merged) : null })
        .where(eq(flowChartSteps.id, jRow.id))
        .run();
    }
  }

  // Master fields (isCcp, ccpNumber, category, notes, etc.)
  const previous = step;
  if (Object.keys(masterUpdates).length > 0) {
    await db.update(processSteps).set(masterUpdates).where(eq(processSteps.id, id)).run();
  }

  const updated = await db.select().from(processSteps).where(eq(processSteps.id, id)).get();
  await logAudit({ planId, entityType: "process_step", entityId: id, action: "update", previousValue: previous, newValue: updated });

  return NextResponse.json(updated);
}

// ── DELETE ─────────────────────────────────────────────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const { searchParams } = new URL(req.url);
  const stepId = searchParams.get("stepId");
  const chartId = searchParams.get("chartId");

  if (!stepId) return NextResponse.json({ error: "stepId required" }, { status: 400 });

  const flowChartId = await resolveFlowChart(planId, chartId);

  // Find and remove junction record for this (chart, step)
  const allJunctions = await db.select().from(flowChartSteps).where(eq(flowChartSteps.stepId, stepId)).all();
  const thisJunction = allJunctions.find((j) => j.flowChartId === flowChartId);
  if (thisJunction) {
    await db.delete(flowChartSteps).where(eq(flowChartSteps.id, thisJunction.id)).run();
  }

  const otherRefs = allJunctions.filter((j) => j.flowChartId !== flowChartId);

  if (otherRefs.length === 0) {
    // No other charts reference this step — delete master
    const previous = await db.select().from(processSteps).where(eq(processSteps.id, stepId)).get();
    await db.delete(processSteps).where(eq(processSteps.id, stepId)).run();
    await logAudit({ planId, entityType: "process_step", entityId: stepId, action: "delete", previousValue: previous });
  } else {
    if (otherRefs.length === 1) {
      await db.update(processSteps).set({ isSharedMaster: false }).where(eq(processSteps.id, stepId)).run();
    }
    for (const j of otherRefs) {
      await db.update(flowChartSteps).set({ isShared: otherRefs.length > 1 }).where(eq(flowChartSteps.id, j.id)).run();
    }
  }

  // Re-sequence remaining steps in this chart
  const remaining = await db.select().from(flowChartSteps)
    .where(eq(flowChartSteps.flowChartId, flowChartId))
    .orderBy(asc(flowChartSteps.sequence))
    .all();

  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].sequence !== i + 1) {
      await db.update(flowChartSteps).set({ sequence: i + 1 }).where(eq(flowChartSteps.id, remaining[i].id)).run();
      const ms = await db.select().from(processSteps).where(eq(processSteps.id, remaining[i].stepId)).get();
      if (ms?.planId === planId) {
        await db.update(processSteps).set({ stepNumber: i + 1 }).where(eq(processSteps.id, remaining[i].stepId)).run();
      }
    }
  }

  return NextResponse.json({ success: true });
}
