import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processSteps, flowChartSteps } from "@/lib/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getNextNumber } from "@/lib/logic/numbering";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse localOverrides JSON safely. */
function parseOverrides(json: string | null): { name?: string; description?: string } {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

/**
 * Ensure the flow_chart_steps junction is populated for this plan.
 * If no junction records exist yet (legacy plan), auto-create one row per step.
 * This is idempotent and transparent to the caller.
 */
async function ensureJunction(planId: string): Promise<void> {
  const existing = await db
    .select({ id: flowChartSteps.id })
    .from(flowChartSteps)
    .where(eq(flowChartSteps.flowChartId, planId))
    .all();

  if (existing.length > 0) return; // already migrated

  const steps = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .orderBy(asc(processSteps.stepNumber))
    .all();

  for (const step of steps) {
    await db.insert(flowChartSteps).values({
      id: generateId(),
      flowChartId: planId,
      stepId: step.id,
      sequence: step.stepNumber,
      isShared: false,
      localOverrides: null,
    }).run();
  }
}

/**
 * Fetch all steps for a plan via the junction, in sequence order,
 * with local overrides merged into the step data.
 */
async function getStepsForPlan(planId: string) {
  await ensureJunction(planId);

  const rows = await db
    .select({ junction: flowChartSteps, step: processSteps })
    .from(flowChartSteps)
    .innerJoin(processSteps, eq(flowChartSteps.stepId, processSteps.id))
    .where(eq(flowChartSteps.flowChartId, planId))
    .orderBy(asc(flowChartSteps.sequence))
    .all();

  return rows.map(({ junction, step }) => {
    const overrides = parseOverrides(junction.localOverrides);
    return {
      ...step,
      // Junction metadata
      junctionId: junction.id,
      sequence: junction.sequence,
      isShared: junction.isShared,
      localOverrides: overrides,
      // Apply local display overrides (name/description only)
      name:        overrides.name        ?? step.name,
      description: overrides.description ?? step.description,
      // Preserve master name for the UI to distinguish overrides
      masterName:        step.name,
      masterDescription: step.description,
    };
  });
}

// ── GET — list steps for a plan ───────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const steps = await getStepsForPlan(planId);
  return NextResponse.json(steps);
}

// ── POST — create step OR reorder ─────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();

  // ── Reorder action ────────────────────────────────────────────────────────
  if (body.action === "reorder") {
    await ensureJunction(planId);
    const { stepIds } = body as { action: string; stepIds: string[] };

    // Update sequence in junction
    for (let i = 0; i < stepIds.length; i++) {
      await db.update(flowChartSteps)
        .set({ sequence: i + 1 })
        .where(
          eq(flowChartSteps.flowChartId, planId),
        )
        .run();
      // Target specific step in this chart
      const jRows = await db
        .select()
        .from(flowChartSteps)
        .where(eq(flowChartSteps.stepId, stepIds[i]))
        .all();
      const jRow = jRows.find((j) => j.flowChartId === planId);
      if (jRow) {
        await db.update(flowChartSteps)
          .set({ sequence: i + 1 })
          .where(eq(flowChartSteps.id, jRow.id))
          .run();
      }

      // Also keep processSteps.stepNumber in sync for backward compat
      // (only if this plan is the home plan for the step)
      const step = await db.select().from(processSteps).where(eq(processSteps.id, stepIds[i])).get();
      if (step?.planId === planId) {
        await db.update(processSteps)
          .set({ stepNumber: i + 1 })
          .where(eq(processSteps.id, stepIds[i]))
          .run();
      }
    }
    return NextResponse.json({ success: true });
  }

  // ── Create new step ────────────────────────────────────────────────────────
  await ensureJunction(planId);

  // Next sequence = max existing sequence + 1
  const jRows = await db
    .select({ sequence: flowChartSteps.sequence })
    .from(flowChartSteps)
    .where(eq(flowChartSteps.flowChartId, planId))
    .all();
  const existingSeqs = jRows.map((j) => j.sequence);

  const existingNumberRows = await db
    .select({ stepNumber: processSteps.stepNumber })
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .all();
  const existingNumbers = existingNumberRows.map((s) => s.stepNumber);

  const nextNumber = body.stepNumber ?? getNextNumber(existingNumbers);
  const nextSeq   = existingSeqs.length > 0 ? Math.max(...existingSeqs) + 1 : nextNumber;

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

  // Create junction record
  const junctionId = generateId();
  await db.insert(flowChartSteps).values({
    id: junctionId,
    flowChartId: planId,
    stepId,
    sequence: nextSeq,
    isShared: false,
    localOverrides: null,
  }).run();

  await logAudit({
    planId,
    entityType: "process_step",
    entityId: stepId,
    action: "create",
    newValue: step,
  });

  return NextResponse.json({ ...step, junctionId, sequence: nextSeq, isShared: false, localOverrides: null }, { status: 201 });
}

// ── PUT — update step master OR junction local overrides ──────────────────────

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { id, localOverrides, ...masterUpdates } = body;

  const step = await db.select().from(processSteps).where(eq(processSteps.id, id)).get();
  if (!step) return NextResponse.json({ error: "Step not found" }, { status: 404 });

  // If caller is updating localOverrides for this flow chart, write to junction
  if (localOverrides !== undefined) {
    const jRows = await db
      .select()
      .from(flowChartSteps)
      .where(eq(flowChartSteps.stepId, id))
      .all();
    const jRow = jRows.find((j) => j.flowChartId === planId);
    if (jRow) {
      // Merge with existing overrides
      const existing = parseOverrides(jRow.localOverrides);
      const merged = { ...existing, ...localOverrides };
      // Remove nulled-out keys
      for (const key of Object.keys(merged)) {
        if (merged[key as keyof typeof merged] === null) delete merged[key as keyof typeof merged];
      }
      await db.update(flowChartSteps)
        .set({ localOverrides: JSON.stringify(merged) })
        .where(eq(flowChartSteps.id, jRow.id))
        .run();
    }
  }

  // Update master step fields (excluding hazard/control fields — those are
  // always read directly from the master and cannot be locally overridden)
  const previous = step;
  if (Object.keys(masterUpdates).length > 0) {
    await db.update(processSteps).set(masterUpdates).where(eq(processSteps.id, id)).run();
  }

  const updated = await db.select().from(processSteps).where(eq(processSteps.id, id)).get();

  await logAudit({
    planId,
    entityType: "process_step",
    entityId: id,
    action: "update",
    previousValue: previous,
    newValue: updated,
  });

  return NextResponse.json(updated);
}

// ── DELETE — unlink from this flow chart (or delete if sole reference) ────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const { searchParams } = new URL(req.url);
  const stepId = searchParams.get("stepId");

  if (!stepId) return NextResponse.json({ error: "stepId required" }, { status: 400 });

  await ensureJunction(planId);

  // Find the junction record for this (plan, step)
  const allJunctions = await db
    .select()
    .from(flowChartSteps)
    .where(eq(flowChartSteps.stepId, stepId))
    .all();
  const thisJunction = allJunctions.find((j) => j.flowChartId === planId);

  // Remove from this flow chart's junction
  if (thisJunction) {
    await db.delete(flowChartSteps).where(eq(flowChartSteps.id, thisJunction.id)).run();
  }

  const otherRefs = allJunctions.filter((j) => j.flowChartId !== planId);

  if (otherRefs.length === 0) {
    // No other flow charts reference this step — delete the master
    const previous = await db.select().from(processSteps).where(eq(processSteps.id, stepId)).get();
    await db.delete(processSteps).where(eq(processSteps.id, stepId)).run();
    await logAudit({ planId, entityType: "process_step", entityId: stepId, action: "delete", previousValue: previous });
  } else {
    // Step still referenced by other charts — just clear isSharedMaster if only 1 left
    if (otherRefs.length === 1) {
      await db.update(processSteps)
        .set({ isSharedMaster: false })
        .where(eq(processSteps.id, stepId))
        .run();
    }
    // Update isShared flag on remaining junctions
    for (const j of otherRefs) {
      await db.update(flowChartSteps)
        .set({ isShared: otherRefs.length > 1 })
        .where(eq(flowChartSteps.id, j.id))
        .run();
    }
    await logAudit({ planId, entityType: "process_step", entityId: stepId, action: "update", newValue: { unlinkedFrom: planId } });
  }

  // Re-sequence remaining steps in this plan
  const remaining = await db
    .select()
    .from(flowChartSteps)
    .where(eq(flowChartSteps.flowChartId, planId))
    .orderBy(asc(flowChartSteps.sequence))
    .all();

  for (let i = 0; i < remaining.length; i++) {
    const newSeq = i + 1;
    if (remaining[i].sequence !== newSeq) {
      await db.update(flowChartSteps)
        .set({ sequence: newSeq })
        .where(eq(flowChartSteps.id, remaining[i].id))
        .run();
      // Keep master stepNumber in sync if home plan
      const masterStep = await db.select().from(processSteps).where(eq(processSteps.id, remaining[i].stepId)).get();
      if (masterStep?.planId === planId) {
        await db.update(processSteps).set({ stepNumber: newSeq }).where(eq(processSteps.id, remaining[i].stepId)).run();
      }
    }
  }

  return NextResponse.json({ success: true });
}
