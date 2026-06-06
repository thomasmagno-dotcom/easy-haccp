import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  processSteps,
  flowChartSteps,
  flowCharts,
  stepHazards,
  controlMeasures,
  stepInputs,
  inputSubgraphSteps,
  inputSubgraphStepHazards,
  inputSubgraphStepControlMeasures,
  stepOutputs,
  outputHazards,
  outputControlMeasures,
} from "@/lib/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getNextNumber } from "@/lib/logic/numbering";
import { ensureDefaultFlowChart, migrateStepsToDefaultChart } from "@/lib/logic/flow-chart";

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
    // Explicitly requested chart — return as-is, never auto-populate
    return chartId;
  }
  // Default chart: create if needed AND migrate legacy processSteps into it
  const chart = await ensureDefaultFlowChart(planId);
  await migrateStepsToDefaultChart(chart.id, planId);
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

  // ?all=true — return all steps in plan with their flow chart memberships
  // Used by the connection-creation dialog to populate the target step picker.
  if (searchParams.get("all") === "true") {
    const rows = await db
      .select({
        step: processSteps,
        flowChartId: flowChartSteps.flowChartId,
        flowChartName: flowCharts.name,
        sequence: flowChartSteps.sequence,
      })
      .from(processSteps)
      .leftJoin(flowChartSteps, eq(flowChartSteps.stepId, processSteps.id))
      .leftJoin(flowCharts, eq(flowCharts.id, flowChartSteps.flowChartId))
      .where(eq(processSteps.planId, planId))
      .orderBy(asc(processSteps.stepNumber))
      .all();
    return NextResponse.json(
      rows.map((r) => ({
        ...r.step,
        flowChartId: r.flowChartId ?? null,
        flowChartName: r.flowChartName ?? null,
        sequence: r.sequence ?? null,
      })),
    );
  }

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

  // ── Duplicate step ──
  if (body.action === "duplicate") {
    const { stepId: srcStepId } = body as { action: string; stepId: string };
    const srcStep = await db.select().from(processSteps).where(eq(processSteps.id, srcStepId)).get();
    if (!srcStep) return NextResponse.json({ error: "Step not found" }, { status: 404 });

    // Compute new number and sequence
    const existingNumberRows = await db.select({ stepNumber: processSteps.stepNumber }).from(processSteps).where(eq(processSteps.planId, planId)).all();
    const jRows = await db.select({ sequence: flowChartSteps.sequence }).from(flowChartSteps).where(eq(flowChartSteps.flowChartId, flowChartId)).all();
    const nextNumber = getNextNumber(existingNumberRows.map((s) => s.stepNumber));
    const nextSeq = jRows.length > 0 ? Math.max(...jRows.map((j) => j.sequence)) + 1 : nextNumber;

    const newStepId = generateId();
    const newStep = {
      id: newStepId,
      planId,
      stepNumber: nextNumber,
      name: `${srcStep.name} (copy)`,
      description: srcStep.description ?? null,
      category: srcStep.category ?? null,
      stepType: srcStep.stepType ?? null,
      isCcp: false,
      ccpNumber: null,
      notes: srcStep.notes ?? null,
      isSharedMaster: false,
    };
    await db.insert(processSteps).values(newStep).run();

    const junctionId = generateId();
    await db.insert(flowChartSteps).values({ id: junctionId, flowChartId, stepId: newStepId, sequence: nextSeq, isShared: false, localOverrides: null }).run();

    // ── Copy step hazards + control measures ──
    const srcHazards = await db.select().from(stepHazards).where(eq(stepHazards.stepId, srcStepId)).all();
    for (const sh of srcHazards) {
      const newShId = generateId();
      await db.insert(stepHazards).values({ id: newShId, stepId: newStepId, hazardId: sh.hazardId, isSignificant: sh.isSignificant, justification: sh.justification ?? null, severityOverride: sh.severityOverride ?? null, likelihoodOverride: sh.likelihoodOverride ?? null, severityWithControls: sh.severityWithControls ?? null, likelihoodWithControls: sh.likelihoodWithControls ?? null, decisionTreeAnswers: sh.decisionTreeAnswers ?? null }).run();
      const srcCMs = await db.select().from(controlMeasures).where(eq(controlMeasures.stepHazardId, sh.id)).all();
      for (const cm of srcCMs) {
        await db.insert(controlMeasures).values({ id: generateId(), stepHazardId: newShId, description: cm.description, type: cm.type ?? null }).run();
      }
    }

    // ── Copy inputs + subgraph steps + subgraph hazards + subgraph control measures ──
    const srcInputs = await db.select().from(stepInputs).where(eq(stepInputs.stepId, srcStepId)).all();
    for (const inp of srcInputs) {
      const newInpId = generateId();
      await db.insert(stepInputs).values({ id: newInpId, stepId: newStepId, name: inp.name, type: inp.type ?? null, notes: inp.notes ?? null }).run();
      const srcSubSteps = await db.select().from(inputSubgraphSteps).where(eq(inputSubgraphSteps.inputId, inp.id)).all();
      for (const ss of srcSubSteps) {
        const newSsId = generateId();
        await db.insert(inputSubgraphSteps).values({ id: newSsId, inputId: newInpId, name: ss.name, stepNumber: ss.stepNumber, category: ss.category ?? null }).run();
        const srcSsHazards = await db.select().from(inputSubgraphStepHazards).where(eq(inputSubgraphStepHazards.subgraphStepId, ss.id)).all();
        for (const ssh of srcSsHazards) {
          const newSshId = generateId();
          await db.insert(inputSubgraphStepHazards).values({ id: newSshId, subgraphStepId: newSsId, hazardId: ssh.hazardId, isSignificant: ssh.isSignificant, justification: ssh.justification ?? null, severityOverride: ssh.severityOverride ?? null, likelihoodOverride: ssh.likelihoodOverride ?? null, severityWithControls: ssh.severityWithControls ?? null, likelihoodWithControls: ssh.likelihoodWithControls ?? null, decisionTreeAnswers: ssh.decisionTreeAnswers ?? null }).run();
          const srcSsCMs = await db.select().from(inputSubgraphStepControlMeasures).where(eq(inputSubgraphStepControlMeasures.subgraphHazardId, ssh.id)).all();
          for (const cm of srcSsCMs) {
            await db.insert(inputSubgraphStepControlMeasures).values({ id: generateId(), subgraphHazardId: newSshId, description: cm.description, type: cm.type ?? null, prpMasterId: cm.prpMasterId ?? null }).run();
          }
        }
      }
    }

    // ── Copy outputs + output hazards + output control measures ──
    const srcOutputs = await db.select().from(stepOutputs).where(eq(stepOutputs.stepId, srcStepId)).all();
    for (const out of srcOutputs) {
      const newOutId = generateId();
      await db.insert(stepOutputs).values({ id: newOutId, stepId: newStepId, name: out.name, outputType: out.outputType, description: out.description ?? null, isCcp: false, ccpNumber: null }).run();
      const srcOHs = await db.select().from(outputHazards).where(eq(outputHazards.outputId, out.id)).all();
      for (const oh of srcOHs) {
        const newOhId = generateId();
        await db.insert(outputHazards).values({ id: newOhId, outputId: newOutId, hazardId: oh.hazardId, isSignificant: oh.isSignificant, justification: oh.justification ?? null, severityOverride: oh.severityOverride ?? null, likelihoodOverride: oh.likelihoodOverride ?? null, severityWithControls: oh.severityWithControls ?? null, likelihoodWithControls: oh.likelihoodWithControls ?? null, decisionTreeAnswers: oh.decisionTreeAnswers ?? null }).run();
        const srcOCMs = await db.select().from(outputControlMeasures).where(eq(outputControlMeasures.outputHazardId, oh.id)).all();
        for (const cm of srcOCMs) {
          await db.insert(outputControlMeasures).values({ id: generateId(), outputHazardId: newOhId, description: cm.description, type: cm.type ?? null }).run();
        }
      }
    }

    await logAudit({ planId, entityType: "process_step", entityId: newStepId, action: "create", newValue: { ...newStep, duplicatedFrom: srcStepId } });
    return NextResponse.json({ ...newStep, junctionId, sequence: nextSeq, isShared: false, localOverrides: null }, { status: 201 });
  }

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
