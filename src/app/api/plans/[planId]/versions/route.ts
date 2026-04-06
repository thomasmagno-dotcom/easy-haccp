import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  haccpPlans,
  planVersions,
  processSteps,
  stepHazards,
  hazards,
  controlMeasures,
  ccps,
  criticalLimits,
  monitoringProcedures,
  correctiveActions,
  verificationProcedures,
} from "@/lib/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

// GET all versions for a plan
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const versions = db
    .select()
    .from(planVersions)
    .where(eq(planVersions.planId, planId))
    .orderBy(desc(planVersions.versionNumber))
    .all();

  // Don't send full snapshots in the list — just metadata
  return NextResponse.json(
    versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      publishedAt: v.publishedAt,
      publishedBy: v.publishedBy,
      changeDescription: v.changeDescription,
    })),
  );
}

// POST: Publish a new version (create snapshot)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { changeDescription, publishedBy } = body;

  // Build full snapshot
  const plan = db
    .select()
    .from(haccpPlans)
    .where(eq(haccpPlans.id, planId))
    .get();

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const steps = db
    .select()
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .orderBy(asc(processSteps.stepNumber))
    .all();

  const stepsWithData = steps.map((step) => {
    const shList = db
      .select({ stepHazard: stepHazards, hazard: hazards })
      .from(stepHazards)
      .innerJoin(hazards, eq(stepHazards.hazardId, hazards.id))
      .where(eq(stepHazards.stepId, step.id))
      .all();

    const hazardData = shList.map((sh) => {
      const measures = db
        .select()
        .from(controlMeasures)
        .where(eq(controlMeasures.stepHazardId, sh.stepHazard.id))
        .all();
      return { ...sh.stepHazard, hazard: sh.hazard, controlMeasures: measures };
    });

    let ccpData = null;
    if (step.isCcp) {
      const ccp = db.select().from(ccps).where(eq(ccps.stepId, step.id)).get();
      if (ccp) {
        ccpData = {
          ...ccp,
          criticalLimits: db.select().from(criticalLimits).where(eq(criticalLimits.ccpId, ccp.id)).all(),
          monitoringProcedures: db.select().from(monitoringProcedures).where(eq(monitoringProcedures.ccpId, ccp.id)).all(),
          correctiveActions: db.select().from(correctiveActions).where(eq(correctiveActions.ccpId, ccp.id)).all(),
          verificationProcedures: db.select().from(verificationProcedures).where(eq(verificationProcedures.ccpId, ccp.id)).all(),
        };
      }
    }

    return { ...step, hazards: hazardData, ccp: ccpData };
  });

  const snapshot = {
    plan: { ...plan },
    processSteps: stepsWithData,
    snapshotAt: new Date().toISOString(),
  };

  const versionNumber = plan.currentVersion + 1;
  const versionId = generateId();

  db.insert(planVersions)
    .values({
      id: versionId,
      planId,
      versionNumber,
      snapshot: JSON.stringify(snapshot),
      publishedBy: publishedBy || null,
      changeDescription: changeDescription || null,
    })
    .run();

  db.update(haccpPlans)
    .set({ currentVersion: versionNumber, status: "published" })
    .where(eq(haccpPlans.id, planId))
    .run();

  logAudit({
    planId,
    entityType: "plan",
    entityId: planId,
    action: "update",
    newValue: { action: "publish", versionNumber, changeDescription },
  });

  return NextResponse.json(
    { id: versionId, versionNumber },
    { status: 201 },
  );
}
