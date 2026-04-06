import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processSteps } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const steps = db
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
      db.update(processSteps)
        .set({ stepNumber: i + 1 })
        .where(eq(processSteps.id, stepIds[i]))
        .run();
    }
    return NextResponse.json({ success: true });
  }

  // Create new step
  const existingSteps = db
    .select()
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .all();
  const nextNumber = existingSteps.length + 1;

  const stepId = generateId();
  const step = {
    id: stepId,
    planId,
    stepNumber: body.stepNumber ?? nextNumber,
    name: body.name || `Step ${nextNumber}`,
    description: body.description || "",
    category: body.category || "processing",
    isCcp: false,
    ccpNumber: null,
  };

  db.insert(processSteps).values(step).run();

  logAudit({
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

  const previous = db
    .select()
    .from(processSteps)
    .where(eq(processSteps.id, id))
    .get();

  db.update(processSteps).set(updates).where(eq(processSteps.id, id)).run();

  const updated = db
    .select()
    .from(processSteps)
    .where(eq(processSteps.id, id))
    .get();

  logAudit({
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

  const previous = db
    .select()
    .from(processSteps)
    .where(eq(processSteps.id, stepId))
    .get();

  db.delete(processSteps).where(eq(processSteps.id, stepId)).run();

  // Renumber remaining steps
  const remaining = db
    .select()
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .orderBy(asc(processSteps.stepNumber))
    .all();

  for (let i = 0; i < remaining.length; i++) {
    db.update(processSteps)
      .set({ stepNumber: i + 1 })
      .where(eq(processSteps.id, remaining[i].id))
      .run();
  }

  logAudit({
    planId,
    entityType: "process_step",
    entityId: stepId,
    action: "delete",
    previousValue: previous,
  });

  return NextResponse.json({ success: true });
}
