import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inputSubgraphSteps, stepInputs, processSteps } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { getNextNumber, renumberedAfterRemoval } from "@/lib/logic/numbering";

// ── POST — add a step to an input's subgraph ──────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { inputId, name, category } = body;

  if (!inputId || !name?.trim()) {
    return NextResponse.json({ error: "inputId and name required" }, { status: 400 });
  }

  // Verify the inputId belongs to this plan (security check)
  const input = db
    .select({ id: stepInputs.id, stepId: stepInputs.stepId })
    .from(stepInputs)
    .where(eq(stepInputs.id, inputId))
    .get();

  if (!input) {
    return NextResponse.json({ error: "Input not found" }, { status: 404 });
  }

  const step = db
    .select({ planId: processSteps.planId })
    .from(processSteps)
    .where(and(eq(processSteps.id, input.stepId), eq(processSteps.planId, planId)))
    .get();

  if (!step) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Determine next step number using pure helper
  const existingNumbers = db
    .select({ stepNumber: inputSubgraphSteps.stepNumber })
    .from(inputSubgraphSteps)
    .where(eq(inputSubgraphSteps.inputId, inputId))
    .all()
    .map((s) => s.stepNumber);

  const nextNumber = getNextNumber(existingNumbers);

  const id = generateId();
  db.insert(inputSubgraphSteps)
    .values({ id, inputId, name: name.trim(), stepNumber: nextNumber, category: category || null })
    .run();

  const created = db
    .select()
    .from(inputSubgraphSteps)
    .where(eq(inputSubgraphSteps.id, id))
    .get();

  return NextResponse.json(created, { status: 201 });
}

// ── PUT — rename or reorder a subgraph step ───────────────────────────────────

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  await params;
  const body = await req.json();
  const { id, name, stepNumber } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const updates: Partial<{ name: string; stepNumber: number }> = {};
  if (name !== undefined) updates.name = name.trim();
  if (stepNumber !== undefined) updates.stepNumber = stepNumber;

  db.update(inputSubgraphSteps)
    .set(updates)
    .where(eq(inputSubgraphSteps.id, id))
    .run();

  const updated = db
    .select()
    .from(inputSubgraphSteps)
    .where(eq(inputSubgraphSteps.id, id))
    .get();

  return NextResponse.json(updated);
}

// ── DELETE — remove a subgraph step and renumber siblings ─────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  await params;
  const url = new URL(req.url);
  const subgraphStepId = url.searchParams.get("subgraphStepId");

  if (!subgraphStepId) {
    return NextResponse.json({ error: "subgraphStepId required" }, { status: 400 });
  }

  // Find inputId so we can renumber siblings
  const target = db
    .select({ inputId: inputSubgraphSteps.inputId })
    .from(inputSubgraphSteps)
    .where(eq(inputSubgraphSteps.id, subgraphStepId))
    .get();

  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch all siblings (including the one to delete) before deleting
  const allSiblings = db
    .select()
    .from(inputSubgraphSteps)
    .where(eq(inputSubgraphSteps.inputId, target.inputId))
    .all();

  db.delete(inputSubgraphSteps)
    .where(eq(inputSubgraphSteps.id, subgraphStepId))
    .run();

  // Renumber remaining siblings using pure helper
  const renumbered = renumberedAfterRemoval(allSiblings, subgraphStepId);
  for (const ss of renumbered) {
    const original = allSiblings.find((s) => s.id === ss.id);
    if (original && original.stepNumber !== ss.stepNumber) {
      db.update(inputSubgraphSteps)
        .set({ stepNumber: ss.stepNumber })
        .where(eq(inputSubgraphSteps.id, ss.id))
        .run();
    }
  }

  return NextResponse.json({ ok: true });
}
