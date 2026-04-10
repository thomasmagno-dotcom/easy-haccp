import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processSteps } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getNextNumber, renumberedAfterRemoval } from "@/lib/logic/numbering";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const steps = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .orderBy(asc(processSteps.stepNumber))
    .all();
  return NextResponse.json(steps);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();

  // If reorder action
  if (body.action === "reorder") {
    const { stepIds } = body as { action: string; stepIds: string[] };
    for (let i = 0; i < stepIds.length; i++) {
      await db.update(processSteps)
        .set({ stepNumber: i + 1 })
        .where(eq(processSteps.id, stepIds[i]))
        .run();
    }
    return NextResponse.json({ success: true });
  }

  // Create new step — use getNextNumber to avoid count-vs-max discrepancy
  const existingNumberRows = await db
    .select({ stepNumber: processSteps.stepNumber })
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .all();
  const existingNumbers = existingNumberRows.map((s) => s.stepNumber);

  const nextNumber = body.stepNumber ?? getNextNumber(existingNumbers);

  const stepId = generateId();
  const step = {
    id: stepId,
    planId,
    stepNumber: nextNumber,
    name: body.name || `Step ${nextNumber}`,
    description: body.description || "",
    category: body.category || "processing",
    isCcp: false,
    ccpNumber: null,
  };

  await db.insert(processSteps).values(step).run();

  await logAudit({
    planId,
    entityType: "process_step",
    entityId: stepId,
    action: "create",
    newValue: step,
  });

  return NextResponse.json(step, { status: 201 });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { id, ...updates } = body;

  const previous = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.id, id))
    .get();

  await db.update(processSteps).set(updates).where(eq(processSteps.id, id)).run();

  const updated = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.id, id))
    .get();

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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const { searchParams } = new URL(req.url);
  const stepId = searchParams.get("stepId");

  if (!stepId) {
    return NextResponse.json({ error: "stepId required" }, { status: 400 });
  }

  const previous = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.id, stepId))
    .get();

  await db.delete(processSteps).where(eq(processSteps.id, stepId)).run();

  // Renumber remaining steps
  const remaining = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .orderBy(asc(processSteps.stepNumber))
    .all();

  // renumberedAfterRemoval expects the item to still be in the list, but since
  // we already deleted it, we just renumber the remaining array directly
  const renumbered = remaining.map((s, i) => ({ ...s, stepNumber: i + 1 }));
  for (const step of renumbered) {
    if (step.stepNumber !== remaining.find((r) => r.id === step.id)?.stepNumber) {
      await db.update(processSteps)
        .set({ stepNumber: step.stepNumber })
        .where(eq(processSteps.id, step.id))
        .run();
    }
  }

  await logAudit({
    planId,
    entityType: "process_step",
    entityId: stepId,
    action: "delete",
    previousValue: previous,
  });

  return NextResponse.json({ success: true });
}
