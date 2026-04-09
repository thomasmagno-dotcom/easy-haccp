import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { haccpPlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { filterPlanUpdateFields } from "@/lib/validators/plan";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const plan = db
    .select()
    .from(haccpPlans)
    .where(eq(haccpPlans.id, planId))
    .get();

  if (!plan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(plan);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;

  const plan = db
    .select()
    .from(haccpPlans)
    .where(eq(haccpPlans.id, planId))
    .get();

  if (!plan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  db.delete(haccpPlans).where(eq(haccpPlans.id, planId)).run();

  logAudit({
    planId,
    entityType: "plan",
    entityId: planId,
    action: "delete",
    previousValue: plan,
  });

  return NextResponse.json({ ok: true });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();

  const previous = db
    .select()
    .from(haccpPlans)
    .where(eq(haccpPlans.id, planId))
    .get();

  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {
    ...filterPlanUpdateFields(body),
    updatedAt: new Date().toISOString(),
  };

  db.update(haccpPlans).set(updates).where(eq(haccpPlans.id, planId)).run();

  logAudit({
    planId,
    entityType: "plan",
    entityId: planId,
    action: "update",
    previousValue: previous,
    newValue: updates,
  });

  const updated = db
    .select()
    .from(haccpPlans)
    .where(eq(haccpPlans.id, planId))
    .get();

  return NextResponse.json(updated);
}
