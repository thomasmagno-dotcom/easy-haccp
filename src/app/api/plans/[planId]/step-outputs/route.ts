import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stepOutputs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  await params;
  const { searchParams } = new URL(req.url);
  const stepId = searchParams.get("stepId");

  if (!stepId) {
    return NextResponse.json({ error: "stepId required" }, { status: 400 });
  }

  const outputs = await db
    .select()
    .from(stepOutputs)
    .where(eq(stepOutputs.stepId, stepId))
    .all();

  return NextResponse.json(outputs);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { stepId, name, outputType, description } = body;

  if (!stepId || !name || !outputType) {
    return NextResponse.json(
      { error: "stepId, name, and outputType are required" },
      { status: 400 },
    );
  }

  const id = generateId();
  const data = { id, stepId, name, outputType, description: description ?? null };

  await db.insert(stepOutputs).values(data).run();

  await logAudit({
    planId,
    entityType: "step_output",
    entityId: id,
    action: "create",
    newValue: data,
  });

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const previous = await db
    .select()
    .from(stepOutputs)
    .where(eq(stepOutputs.id, id))
    .get();

  await db.update(stepOutputs).set(updates).where(eq(stepOutputs.id, id)).run();

  const updated = await db
    .select()
    .from(stepOutputs)
    .where(eq(stepOutputs.id, id))
    .get();

  await logAudit({
    planId,
    entityType: "step_output",
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
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const previous = await db
    .select()
    .from(stepOutputs)
    .where(eq(stepOutputs.id, id))
    .get();

  await db.delete(stepOutputs).where(eq(stepOutputs.id, id)).run();

  await logAudit({
    planId,
    entityType: "step_output",
    entityId: id,
    action: "delete",
    previousValue: previous,
  });

  return NextResponse.json({ success: true });
}
