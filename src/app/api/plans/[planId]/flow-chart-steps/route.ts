/**
 * /api/plans/[planId]/flow-chart-steps
 *
 * Manages the junction between a flow chart (HACCP plan) and steps:
 *   POST  — link an existing step to this flow chart ("Share Step")
 *   PUT   — update local overrides (name/description only; never hazards/controls)
 *   DELETE — remove from this flow chart (unlink; does not delete master)
 *
 * The override rules are strictly enforced here:
 *   Allowed fields in localOverrides: name, description
 *   NOT allowed: hazards, riskAssessments, controlMeasures, isCcp, ccpNumber
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processSteps, flowChartSteps, haccpPlans } from "@/lib/db/schema";
import { eq, ne, and } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

const ALLOWED_OVERRIDE_KEYS = new Set(["name", "description"]);

function sanitiseOverrides(raw: Record<string, unknown>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (ALLOWED_OVERRIDE_KEYS.has(key) && typeof val === "string") {
      clean[key] = val;
    }
  }
  return clean;
}

function parseOverrides(json: string | null) {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

// ── GET — search steps available to share into this flow chart ────────────────
// Returns steps from other plans (not yet in this plan's junction)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") ?? "").toLowerCase();

  // All steps in this chart
  const alreadyLinked = await db
    .select({ stepId: flowChartSteps.stepId })
    .from(flowChartSteps)
    .where(eq(flowChartSteps.flowChartId, planId))
    .all();
  const linkedIds = new Set(alreadyLinked.map((r) => r.stepId));

  // All steps with their home plan
  const allSteps = await db
    .select({ step: processSteps, plan: haccpPlans })
    .from(processSteps)
    .innerJoin(haccpPlans, eq(processSteps.planId, haccpPlans.id))
    .all();

  const candidates = allSteps
    .filter((r) => !linkedIds.has(r.step.id))
    .filter((r) => {
      if (!query) return true;
      return (
        r.step.name.toLowerCase().includes(query) ||
        (r.step.description ?? "").toLowerCase().includes(query) ||
        r.plan.name.toLowerCase().includes(query)
      );
    })
    .map((r) => ({
      ...r.step,
      homePlanName: r.plan.name,
      homePlanId:   r.plan.id,
    }));

  return NextResponse.json(candidates);
}

// ── POST — link an existing step into this flow chart ─────────────────────────
export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { stepId, localOverrides: rawOverrides } = body;

  if (!stepId) return NextResponse.json({ error: "stepId required" }, { status: 400 });

  // Verify step exists
  const step = await db.select().from(processSteps).where(eq(processSteps.id, stepId)).get();
  if (!step) return NextResponse.json({ error: "Step not found" }, { status: 404 });

  // Check not already linked
  const existing = await db
    .select()
    .from(flowChartSteps)
    .where(and(eq(flowChartSteps.flowChartId, planId), eq(flowChartSteps.stepId, stepId)))
    .get();
  if (existing) return NextResponse.json({ error: "Step already in this flow chart" }, { status: 409 });

  // Next sequence
  const jRows = await db
    .select({ sequence: flowChartSteps.sequence })
    .from(flowChartSteps)
    .where(eq(flowChartSteps.flowChartId, planId))
    .all();
  const nextSeq = jRows.length > 0 ? Math.max(...jRows.map((j) => j.sequence)) + 1 : 1;

  const overrides = rawOverrides ? sanitiseOverrides(rawOverrides) : {};

  const junctionId = generateId();
  await db.insert(flowChartSteps).values({
    id: junctionId,
    flowChartId: planId,
    stepId,
    sequence: nextSeq,
    isShared: true,
    localOverrides: Object.keys(overrides).length > 0 ? JSON.stringify(overrides) : null,
  }).run();

  // Mark master step as shared
  const allRefs = await db
    .select()
    .from(flowChartSteps)
    .where(eq(flowChartSteps.stepId, stepId))
    .all();

  if (allRefs.length > 1) {
    await db.update(processSteps)
      .set({ isSharedMaster: true })
      .where(eq(processSteps.id, stepId))
      .run();
    // Mark all junction rows as isShared = true
    for (const ref of allRefs) {
      await db.update(flowChartSteps).set({ isShared: true }).where(eq(flowChartSteps.id, ref.id)).run();
    }
  }

  await logAudit({
    planId,
    entityType: "process_step",
    entityId: stepId,
    action: "update",
    newValue: { linkedToFlowChart: planId, sequence: nextSeq, overrides },
  });

  return NextResponse.json({
    junctionId,
    stepId,
    flowChartId: planId,
    sequence: nextSeq,
    isShared: true,
    localOverrides: overrides,
    step,
  }, { status: 201 });
}

// ── PUT — update junction local overrides ─────────────────────────────────────
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { junctionId, localOverrides: rawOverrides, clearOverrides } = body;

  if (!junctionId) return NextResponse.json({ error: "junctionId required" }, { status: 400 });

  const junction = await db.select().from(flowChartSteps).where(eq(flowChartSteps.id, junctionId)).get();
  if (!junction || junction.flowChartId !== planId) {
    return NextResponse.json({ error: "Junction not found" }, { status: 404 });
  }

  if (clearOverrides) {
    await db.update(flowChartSteps).set({ localOverrides: null }).where(eq(flowChartSteps.id, junctionId)).run();
    return NextResponse.json({ success: true, localOverrides: null });
  }

  // Strictly enforce allowed fields
  const incoming = sanitiseOverrides(rawOverrides ?? {});
  const existing = parseOverrides(junction.localOverrides);
  const merged = { ...existing, ...incoming };

  await db.update(flowChartSteps)
    .set({ localOverrides: Object.keys(merged).length > 0 ? JSON.stringify(merged) : null })
    .where(eq(flowChartSteps.id, junctionId))
    .run();

  return NextResponse.json({ success: true, localOverrides: merged });
}
