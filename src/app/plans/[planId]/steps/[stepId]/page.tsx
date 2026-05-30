import { db } from "@/lib/db";
import {
  processSteps,
  stepHazards,
  hazards,
  controlMeasures,
  ccps,
  criticalLimits,
  monitoringProcedures,
  correctiveActions,
  verificationProcedures,
  stepOutputs,
  prpMaster,
  hazardPrp,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { StepAnalysis } from "@/components/step-analysis/StepAnalysis";

export const dynamic = "force-dynamic";

export default async function StepAnalysisPage({
  params,
}: {
  params: Promise<{ planId: string; stepId: string }>;
}) {
  const { planId, stepId } = await params;

  const step = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.id, stepId))
    .get();

  if (!step) notFound();

  // Hazards assigned to this step
  const assignments = await db
    .select({ stepHazard: stepHazards, hazard: hazards })
    .from(stepHazards)
    .innerJoin(hazards, eq(stepHazards.hazardId, hazards.id))
    .where(eq(stepHazards.stepId, stepId))
    .all();

  const hazardData = await Promise.all(
    assignments.map(async (a) => {
      const measures = await db
        .select()
        .from(controlMeasures)
        .where(eq(controlMeasures.stepHazardId, a.stepHazard.id))
        .all();
      return { ...a.stepHazard, hazard: a.hazard, controlMeasures: measures };
    }),
  );

  // CCP data
  let ccpData = null;
  if (step.isCcp) {
    const ccp = await db.select().from(ccps).where(eq(ccps.stepId, stepId)).get();
    if (ccp) {
      const [limits, monitoring, corrective, verification] = await Promise.all([
        db.select().from(criticalLimits).where(eq(criticalLimits.ccpId, ccp.id)).all(),
        db.select().from(monitoringProcedures).where(eq(monitoringProcedures.ccpId, ccp.id)).all(),
        db.select().from(correctiveActions).where(eq(correctiveActions.ccpId, ccp.id)).all(),
        db.select().from(verificationProcedures).where(eq(verificationProcedures.ccpId, ccp.id)).all(),
      ]);
      ccpData = {
        ...ccp,
        criticalLimits: limits,
        monitoringProcedures: monitoring,
        correctiveActions: corrective,
        verificationProcedures: verification,
      };
    }
  }

  // All available hazards, step outputs, all PRPs, and existing hazard-PRP links
  const assignedHazardIds = assignments.map((a) => a.hazard.id);

  const [allHazards, rawOutputs, allPrps, prpLinks] = await Promise.all([
    db.select().from(hazards).all(),
    db.select().from(stepOutputs).where(eq(stepOutputs.stepId, stepId)).all(),
    db.select().from(prpMaster).all(),
    assignedHazardIds.length > 0
      ? db
          .select({ link: hazardPrp, prp: prpMaster })
          .from(hazardPrp)
          .innerJoin(prpMaster, eq(hazardPrp.prpMasterId, prpMaster.id))
          .where(inArray(hazardPrp.hazardId, assignedHazardIds))
          .all()
      : Promise.resolve([]),
  ]);

  // Build map: hazardId → HazardPrp[]
  const prpLinksByHazard: Record<string, Array<{ id: string; hazardId: string; prpMasterId: string; createdAt: string; prp: typeof allPrps[0] }>> = {};
  for (const { link, prp } of prpLinks) {
    if (!prpLinksByHazard[link.hazardId]) prpLinksByHazard[link.hazardId] = [];
    prpLinksByHazard[link.hazardId].push({ ...link, prp });
  }

  return (
    <StepAnalysis
      planId={planId}
      step={step as any}
      hazardAssignments={hazardData}
      ccpData={ccpData}
      availableHazards={allHazards}
      stepOutputs={rawOutputs as any[]}
      allPrps={allPrps as any[]}
      prpLinksByHazard={prpLinksByHazard as any}
    />
  );
}
