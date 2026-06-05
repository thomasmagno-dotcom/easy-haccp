import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stepOutputSources, stepOutputs, processSteps } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/utils";

// POST — link an additional step as a source of an existing output
export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const { outputId, stepId } = await req.json();

  if (!outputId || !stepId) {
    return NextResponse.json({ error: "outputId and stepId required" }, { status: 400 });
  }

  // Verify the output belongs to this plan
  const output = await db
    .select({ id: stepOutputs.id, stepId: stepOutputs.stepId })
    .from(stepOutputs)
    .where(eq(stepOutputs.id, outputId))
    .get();
  if (!output) return NextResponse.json({ error: "Output not found" }, { status: 404 });

  // Verify the step belongs to this plan
  const step = await db
    .select({ id: processSteps.id, name: processSteps.name, stepNumber: processSteps.stepNumber })
    .from(processSteps)
    .where(eq(processSteps.id, stepId))
    .get();
  if (!step) return NextResponse.json({ error: "Step not found" }, { status: 404 });

  // Prevent linking the primary owner step
  if (output.stepId === stepId) {
    return NextResponse.json({ error: "Step is already the primary owner of this output" }, { status: 409 });
  }

  // Prevent duplicates
  const existing = await db
    .select({ id: stepOutputSources.id })
    .from(stepOutputSources)
    .where(and(eq(stepOutputSources.outputId, outputId), eq(stepOutputSources.stepId, stepId)))
    .get();
  if (existing) return NextResponse.json({ error: "Already linked" }, { status: 409 });

  const id = generateId();
  await db.insert(stepOutputSources).values({ id, outputId, stepId }).run();

  return NextResponse.json(
    { id, outputId, stepId, stepName: step.name, stepNumber: step.stepNumber },
    { status: 201 },
  );
}

// DELETE — remove a source link by id
export async function DELETE(
  req: Request,
  { params: _params }: { params: Promise<{ planId: string }> },
) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.delete(stepOutputSources).where(eq(stepOutputSources.id, id)).run();
  return NextResponse.json({ success: true });
}
