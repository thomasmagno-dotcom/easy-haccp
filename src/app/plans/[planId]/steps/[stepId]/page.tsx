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
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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

  // Get all hazards assigned to this step with their reference data
  const assignments = await db
    .select({
      stepHazard: stepHazards,
      hazard: hazards,
    })
    .from(stepHazards)
    .innerJoin(hazards, eq(stepHazards.hazardId, hazards.id))
    .where(eq(stepHazards.stepId, stepId))
    .all();

  const hazardData = await Promise.all(assignments.map(async (a) => {
    const measures = await db
      .select()
      .from(controlMeasures)
      .where(eq(controlMeasures.stepHazardId, a.stepHazard.id))
      .all();
    return {
      ...a.stepHazard,
      hazard: a.hazard,
      controlMeasures: measures,
    };
  }));

  // Get CCP data if this step is a CCP
  let ccpData = null;
  if (step.isCcp) {
    const ccp = await db
      .select()
      .from(ccps)
      .where(eq(ccps.stepId, stepId))
      .get();

    if (ccp) {
      const limits = await db
        .select()
        .from(criticalLimits)
        .where(eq(criticalLimits.ccpId, ccp.id))
        .all();
      const monitoring = await db
        .select()
        .from(monitoringProcedures)
        .where(eq(monitoringProcedures.ccpId, ccp.id))
        .all();
      const corrective = await db
        .select()
        .from(correctiveActions)
        .where(eq(correctiveActions.ccpId, ccp.id))
        .all();
      const verification = await db
        .select()
        .from(verificationProcedures)
        .where(eq(verificationProcedures.ccpId, ccp.id))
        .all();

      ccpData = {
        ...ccp,
        criticalLimits: limits,
        monitoringProcedures: monitoring,
        correctiveActions: corrective,
        verificationProcedures: verification,
      };
    }
  }

  // Get all available hazards for the picker
  const allHazards = await db.select().from(hazards).all();

  return (
    <StepAnalysis
      planId={planId}
      step={step}
      hazardAssignments={hazardData}
      ccpData={ccpData}
      availableHazards={allHazards}
    />
  );
}
