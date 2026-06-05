import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { haccpPlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildForms59Rows } from "@/lib/logic/forms59";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;

  const plan = await db
    .select()
    .from(haccpPlans)
    .where(eq(haccpPlans.id, planId))
    .get();

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const rows = await buildForms59Rows(planId);
  return NextResponse.json({ rows });
}
