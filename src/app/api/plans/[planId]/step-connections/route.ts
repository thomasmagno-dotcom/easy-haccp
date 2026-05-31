/**
 * /api/plans/[planId]/step-connections
 *
 * Manages directed graph edges between steps.  An Output from any Step in any
 * FlowChart of this plan can feed as Input into any other Step.
 *
 * Business rules enforced here:
 *   - connectionType must be "direct" or "reference" (no default)
 *   - Circular references (cycles in the step graph) are rejected
 *   - Cross-flow-chart connections are allowed; both charts see the connection
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  stepConnections,
  processSteps,
  stepOutputs,
  flowCharts,
} from "@/lib/db/schema";
import { eq, inArray, or } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { wouldCreateCycle } from "@/lib/logic/flow-chart";

const VALID_CONNECTION_TYPES = new Set(["direct", "reference"]);

// ── GET — all connections visible from this plan's steps ──────────────────────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const { searchParams } = new URL(req.url);
  const stepId = searchParams.get("stepId");
  const flowChartId = searchParams.get("flowChartId");

  // Get all steps in this plan
  const planSteps = await db
    .select({ id: processSteps.id })
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .all();
  const planStepIds = planSteps.map((s) => s.id);

  if (planStepIds.length === 0) return NextResponse.json([]);

  // Get all connections where source OR target belongs to this plan
  const allConns = await db
    .select()
    .from(stepConnections)
    .where(
      or(
        inArray(stepConnections.sourceStepId, planStepIds),
        inArray(stepConnections.targetStepId, planStepIds),
      ),
    )
    .all();

  // Filter if stepId or flowChartId provided
  let filtered = allConns;
  if (stepId) {
    filtered = filtered.filter(
      (c) => c.sourceStepId === stepId || c.targetStepId === stepId,
    );
  }
  if (flowChartId) {
    filtered = filtered.filter(
      (c) => c.sourceFlowChartId === flowChartId || c.targetFlowChartId === flowChartId,
    );
  }

  // Join display names
  const result = await Promise.all(
    filtered.map(async (conn) => {
      const [srcStep, tgtStep, srcOutput, srcChart, tgtChart] = await Promise.all([
        db.select({ name: processSteps.name }).from(processSteps).where(eq(processSteps.id, conn.sourceStepId)).get(),
        db.select({ name: processSteps.name }).from(processSteps).where(eq(processSteps.id, conn.targetStepId)).get(),
        db.select({ name: stepOutputs.name }).from(stepOutputs).where(eq(stepOutputs.id, conn.sourceOutputId)).get(),
        db.select({ name: flowCharts.name }).from(flowCharts).where(eq(flowCharts.id, conn.sourceFlowChartId)).get(),
        db.select({ name: flowCharts.name }).from(flowCharts).where(eq(flowCharts.id, conn.targetFlowChartId)).get(),
      ]);
      return {
        ...conn,
        sourceStepName:      srcStep?.name ?? null,
        targetStepName:      tgtStep?.name ?? null,
        sourceOutputName:    srcOutput?.name ?? null,
        sourceFlowChartName: srcChart?.name ?? null,
        targetFlowChartName: tgtChart?.name ?? null,
      };
    }),
  );

  return NextResponse.json(result);
}

// ── POST — create a connection ─────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const {
    sourceStepId,
    sourceOutputId,
    targetStepId,
    sourceFlowChartId,
    targetFlowChartId,
    connectionType,
  } = body;

  // Required fields
  if (!sourceStepId || !sourceOutputId || !targetStepId || !sourceFlowChartId || !targetFlowChartId) {
    return NextResponse.json(
      { error: "sourceStepId, sourceOutputId, targetStepId, sourceFlowChartId, targetFlowChartId are required" },
      { status: 400 },
    );
  }

  // connectionType must be explicit
  if (!connectionType) {
    return NextResponse.json(
      { error: "connectionType is required. Must be 'direct' or 'reference' — no default." },
      { status: 400 },
    );
  }
  if (!VALID_CONNECTION_TYPES.has(connectionType)) {
    return NextResponse.json(
      { error: "connectionType must be 'direct' or 'reference'" },
      { status: 400 },
    );
  }

  // Verify source output belongs to source step
  const output = await db.select().from(stepOutputs).where(eq(stepOutputs.id, sourceOutputId)).get();
  if (!output || output.stepId !== sourceStepId) {
    return NextResponse.json({ error: "sourceOutputId does not belong to sourceStepId" }, { status: 400 });
  }

  // Cycle detection
  if (await wouldCreateCycle(sourceStepId, targetStepId)) {
    return NextResponse.json(
      { error: "This connection would create a circular reference in the process flow. Circular references are not permitted." },
      { status: 422 },
    );
  }

  // Check for duplicate connection (same output → same target)
  const existing = await db
    .select()
    .from(stepConnections)
    .where(eq(stepConnections.sourceOutputId, sourceOutputId))
    .all();
  if (existing.some((c) => c.targetStepId === targetStepId)) {
    return NextResponse.json(
      { error: "A connection from this output to this step already exists" },
      { status: 409 },
    );
  }

  const id = generateId();
  await db.insert(stepConnections).values({
    id,
    sourceStepId,
    sourceOutputId,
    targetStepId,
    sourceFlowChartId,
    targetFlowChartId,
    connectionType,
  }).run();

  const created = await db.select().from(stepConnections).where(eq(stepConnections.id, id)).get();
  return NextResponse.json(created, { status: 201 });
}

// ── DELETE — remove a connection ───────────────────────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  await params;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.delete(stepConnections).where(eq(stepConnections.id, id)).run();
  return NextResponse.json({ success: true });
}
