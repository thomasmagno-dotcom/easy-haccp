import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  outputHazards,
  outputControlMeasures,
  hazards,
  stepOutputs,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  await params;
  const { searchParams } = new URL(req.url);
  const outputId = searchParams.get("outputId");

  if (!outputId) {
    return NextResponse.json({ error: "outputId required" }, { status: 400 });
  }

  const assignments = await db
    .select({ outputHazard: outputHazards, hazard: hazards })
    .from(outputHazards)
    .innerJoin(hazards, eq(outputHazards.hazardId, hazards.id))
    .where(eq(outputHazards.outputId, outputId))
    .all();

  const result = await Promise.all(
    assignments.map(async (a) => {
      const measures = await db
        .select()
        .from(outputControlMeasures)
        .where(eq(outputControlMeasures.outputHazardId, a.outputHazard.id))
        .all();
      return { ...a.outputHazard, hazard: a.hazard, controlMeasures: measures };
    }),
  );

  return NextResponse.json(result);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const {
    outputId,
    hazardId,
    isSignificant,
    justification,
    severityOverride,
    likelihoodOverride,
    decisionTreeAnswers,
    controlMeasureDescriptions,
  } = body;

  // Resolve planId from output if not provided
  const output = await db
    .select()
    .from(stepOutputs)
    .where(eq(stepOutputs.id, outputId))
    .get();

  const ohId = generateId();
  const data = {
    id: ohId,
    outputId,
    hazardId,
    isSignificant: isSignificant ?? false,
    justification: justification ?? null,
    severityOverride: severityOverride ?? null,
    likelihoodOverride: likelihoodOverride ?? null,
    decisionTreeAnswers: decisionTreeAnswers
      ? JSON.stringify(decisionTreeAnswers)
      : null,
  };

  await db.insert(outputHazards).values(data).run();

  await logAudit({
    planId,
    entityType: "output_hazard",
    entityId: ohId,
    action: "create",
    newValue: data,
  });

  if (controlMeasureDescriptions && Array.isArray(controlMeasureDescriptions)) {
    for (const cm of controlMeasureDescriptions) {
      await db
        .insert(outputControlMeasures)
        .values({
          id: generateId(),
          outputHazardId: ohId,
          description: cm.description,
          type: cm.type || "preventive",
        })
        .run();
    }
  }

  return NextResponse.json({ id: ohId }, { status: 201 });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { id, controlMeasureUpdates, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const previous = await db
    .select()
    .from(outputHazards)
    .where(eq(outputHazards.id, id))
    .get();

  if (updates.decisionTreeAnswers) {
    updates.decisionTreeAnswers = JSON.stringify(updates.decisionTreeAnswers);
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(outputHazards)
      .set(updates)
      .where(eq(outputHazards.id, id))
      .run();
  }

  if (controlMeasureUpdates && Array.isArray(controlMeasureUpdates)) {
    await db
      .delete(outputControlMeasures)
      .where(eq(outputControlMeasures.outputHazardId, id))
      .run();
    for (const cm of controlMeasureUpdates) {
      await db
        .insert(outputControlMeasures)
        .values({
          id: generateId(),
          outputHazardId: id,
          description: cm.description,
          type: cm.type || "preventive",
        })
        .run();
    }
  }

  const updated = await db
    .select()
    .from(outputHazards)
    .where(eq(outputHazards.id, id))
    .get();

  await logAudit({
    planId,
    entityType: "output_hazard",
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
  const ohId = searchParams.get("id");

  if (!ohId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const previous = await db
    .select()
    .from(outputHazards)
    .where(eq(outputHazards.id, ohId))
    .get();

  await db.delete(outputHazards).where(eq(outputHazards.id, ohId)).run();

  await logAudit({
    planId,
    entityType: "output_hazard",
    entityId: ohId,
    action: "delete",
    previousValue: previous,
  });

  return NextResponse.json({ success: true });
}
