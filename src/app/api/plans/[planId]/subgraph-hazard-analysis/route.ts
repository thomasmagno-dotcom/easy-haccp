import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  inputSubgraphStepHazards,
  inputSubgraphStepControlMeasures,
  hazards,
  prpMaster,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function enrichMeasures(hazardId: string) {
  const rows = await db
    .select({ measure: inputSubgraphStepControlMeasures, prp: prpMaster })
    .from(inputSubgraphStepControlMeasures)
    .leftJoin(prpMaster, eq(inputSubgraphStepControlMeasures.prpMasterId, prpMaster.id))
    .where(eq(inputSubgraphStepControlMeasures.subgraphHazardId, hazardId))
    .all();
  return rows.map(({ measure, prp }) => ({
    ...measure,
    prpName:     prp?.programName ?? null,
    prpFsepCode: prp?.fsepCode    ?? null,
  }));
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  await params;
  const { searchParams } = new URL(req.url);
  const subgraphStepId = searchParams.get("subgraphStepId");

  if (!subgraphStepId) {
    return NextResponse.json({ error: "subgraphStepId required" }, { status: 400 });
  }

  const assignments = await db
    .select({ assignment: inputSubgraphStepHazards, hazard: hazards })
    .from(inputSubgraphStepHazards)
    .innerJoin(hazards, eq(inputSubgraphStepHazards.hazardId, hazards.id))
    .where(eq(inputSubgraphStepHazards.subgraphStepId, subgraphStepId))
    .all();

  const result = await Promise.all(
    assignments.map(async (a) => ({
      ...a.assignment,
      hazard: a.hazard,
      controlMeasures: await enrichMeasures(a.assignment.id),
    })),
  );

  return NextResponse.json(result);
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  await params;
  const body = await req.json();
  const { action } = body;

  // Add control measure
  if (action === "add_measure") {
    const { subgraphHazardId, description, type, prpMasterId } = body;
    if (!subgraphHazardId || !description) {
      return NextResponse.json({ error: "subgraphHazardId and description required" }, { status: 400 });
    }
    const id = generateId();
    const data = {
      id,
      subgraphHazardId,
      description,
      type: type ?? null,
      prpMasterId: prpMasterId ?? null,
    };
    await db.insert(inputSubgraphStepControlMeasures).values(data).run();

    // Return with PRP info if linked
    let prpName = null, prpFsepCode = null;
    if (prpMasterId) {
      const prp = await db.select().from(prpMaster).where(eq(prpMaster.id, prpMasterId)).get();
      prpName = prp?.programName ?? null;
      prpFsepCode = prp?.fsepCode ?? null;
    }
    return NextResponse.json({ ...data, prpName, prpFsepCode }, { status: 201 });
  }

  // Assign hazard
  const { subgraphStepId, hazardId } = body;
  if (!subgraphStepId || !hazardId) {
    return NextResponse.json({ error: "subgraphStepId and hazardId required" }, { status: 400 });
  }
  const id = generateId();
  const data = {
    id, subgraphStepId, hazardId,
    isSignificant: false, justification: null,
    severityOverride: null, likelihoodOverride: null,
    severityWithControls: null, likelihoodWithControls: null,
  };
  await db.insert(inputSubgraphStepHazards).values(data).run();

  const hazard = await db.select().from(hazards).where(eq(hazards.id, hazardId)).get();
  return NextResponse.json({ ...data, hazard, controlMeasures: [] }, { status: 201 });
}

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  await params;
  const body = await req.json();
  const { id, isSignificant, justification, severityOverride, likelihoodOverride, severityWithControls, likelihoodWithControls, decisionTreeAnswers } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const patch: Record<string, unknown> = {
    isSignificant: isSignificant ?? false,
    justification: justification ?? null,
    severityOverride: severityOverride ?? null,
    likelihoodOverride: likelihoodOverride ?? null,
    severityWithControls: severityWithControls ?? null,
    likelihoodWithControls: likelihoodWithControls ?? null,
  };
  if (decisionTreeAnswers !== undefined) {
    patch.decisionTreeAnswers = decisionTreeAnswers ? JSON.stringify(decisionTreeAnswers) : null;
  }

  await db
    .update(inputSubgraphStepHazards)
    .set(patch)
    .where(eq(inputSubgraphStepHazards.id, id))
    .run();

  const updated = await db.select().from(inputSubgraphStepHazards).where(eq(inputSubgraphStepHazards.id, id)).get();
  return NextResponse.json(updated);
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  await params;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const measureId = searchParams.get("measureId");

  if (measureId) {
    await db.delete(inputSubgraphStepControlMeasures).where(eq(inputSubgraphStepControlMeasures.id, measureId)).run();
    return NextResponse.json({ success: true });
  }
  if (id) {
    await db.delete(inputSubgraphStepHazards).where(eq(inputSubgraphStepHazards.id, id)).run();
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "id or measureId required" }, { status: 400 });
}
