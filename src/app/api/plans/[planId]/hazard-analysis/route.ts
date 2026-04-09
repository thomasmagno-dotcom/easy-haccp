import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  stepHazards,
  hazards,
  controlMeasures,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

// GET: Fetch all hazards assigned to a step
export async function GET(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const { searchParams } = new URL(req.url);
  const stepId = searchParams.get("stepId");

  if (!stepId) {
    return NextResponse.json({ error: "stepId required" }, { status: 400 });
  }

  const assignments = db
    .select({
      stepHazard: stepHazards,
      hazard: hazards,
    })
    .from(stepHazards)
    .innerJoin(hazards, eq(stepHazards.hazardId, hazards.id))
    .where(eq(stepHazards.stepId, stepId))
    .all();

  // Get control measures for each step_hazard
  const result = assignments.map((a) => {
    const measures = db
      .select()
      .from(controlMeasures)
      .where(eq(controlMeasures.stepHazardId, a.stepHazard.id))
      .all();

    return {
      ...a.stepHazard,
      hazard: a.hazard,
      controlMeasures: measures,
    };
  });

  return NextResponse.json(result);
}

// POST: Assign a hazard to a step
export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const {
    stepId,
    hazardId,
    isSignificant,
    justification,
    severityOverride,
    likelihoodOverride,
    decisionTreeAnswers,
    controlMeasureDescriptions,
  } = body;

  const shId = generateId();
  const stepHazardData = {
    id: shId,
    stepId,
    hazardId,
    isSignificant: isSignificant ?? false,
    justification: justification ?? null,
    severityOverride: severityOverride ?? null,
    likelihoodOverride: likelihoodOverride ?? null,
    decisionTreeAnswers: decisionTreeAnswers
      ? JSON.stringify(decisionTreeAnswers)
      : null,
  };

  db.insert(stepHazards).values(stepHazardData).run();

  logAudit({
    planId,
    entityType: "step_hazard",
    entityId: shId,
    action: "create",
    newValue: stepHazardData,
  });

  // Create control measures if provided
  if (controlMeasureDescriptions && Array.isArray(controlMeasureDescriptions)) {
    for (const cm of controlMeasureDescriptions) {
      const cmId = generateId();
      db.insert(controlMeasures)
        .values({
          id: cmId,
          stepHazardId: shId,
          description: cm.description,
          type: cm.type || "preventive",
        })
        .run();
    }
  }

  return NextResponse.json({ id: shId }, { status: 201 });
}

// PUT: Update a step-hazard assignment
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { id, controlMeasureUpdates, ...updates } = body;

  const previous = db
    .select()
    .from(stepHazards)
    .where(eq(stepHazards.id, id))
    .get();

  if (updates.decisionTreeAnswers) {
    updates.decisionTreeAnswers = JSON.stringify(updates.decisionTreeAnswers);
  }

  if (Object.keys(updates).length > 0) {
    db.update(stepHazards).set(updates).where(eq(stepHazards.id, id)).run();
  }

  // Update control measures if provided
  if (controlMeasureUpdates && Array.isArray(controlMeasureUpdates)) {
    // Delete existing and recreate
    db.delete(controlMeasures)
      .where(eq(controlMeasures.stepHazardId, id))
      .run();
    for (const cm of controlMeasureUpdates) {
      db.insert(controlMeasures)
        .values({
          id: generateId(),
          stepHazardId: id,
          description: cm.description,
          type: cm.type || "preventive",
        })
        .run();
    }
  }

  const updated = db
    .select()
    .from(stepHazards)
    .where(eq(stepHazards.id, id))
    .get();

  logAudit({
    planId,
    entityType: "step_hazard",
    entityId: id,
    action: "update",
    previousValue: previous,
    newValue: updated,
  });

  return NextResponse.json(updated);
}

// DELETE: Remove a hazard assignment from a step
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const { searchParams } = new URL(req.url);
  const shId = searchParams.get("id");

  if (!shId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const previous = db
    .select()
    .from(stepHazards)
    .where(eq(stepHazards.id, shId))
    .get();

  db.delete(stepHazards).where(eq(stepHazards.id, shId)).run();

  logAudit({
    planId,
    entityType: "step_hazard",
    entityId: shId,
    action: "delete",
    previousValue: previous,
  });

  return NextResponse.json({ success: true });
}
