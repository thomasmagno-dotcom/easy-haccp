import { db } from "@/lib/db";
import {
  stepOutputs,
  processSteps,
  outputHazards,
  hazards,
  outputControlMeasures,
  outputCcps,
  outputCriticalLimits,
  outputMonitoringProcedures,
  outputCorrectiveActions,
  outputVerificationProcedures,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { OutputAnalysis } from "@/components/output-analysis/OutputAnalysis";

export const dynamic = "force-dynamic";

export default async function OutputAnalysisPage({
  params,
}: {
  params: Promise<{ planId: string; stepId: string; outputId: string }>;
}) {
  const { planId, stepId, outputId } = await params;

  const [output, step] = await Promise.all([
    db.select().from(stepOutputs).where(eq(stepOutputs.id, outputId)).get(),
    db.select().from(processSteps).where(eq(processSteps.id, stepId)).get(),
  ]);

  if (!output || !step) notFound();
  // Drizzle returns outputType as string; cast to the OutputType union
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedOutput = output as any;

  const assignments = await db
    .select({ outputHazard: outputHazards, hazard: hazards })
    .from(outputHazards)
    .innerJoin(hazards, eq(outputHazards.hazardId, hazards.id))
    .where(eq(outputHazards.outputId, outputId))
    .all();

  const hazardData = await Promise.all(
    assignments.map(async (a) => {
      const measures = await db
        .select()
        .from(outputControlMeasures)
        .where(eq(outputControlMeasures.outputHazardId, a.outputHazard.id))
        .all();
      return { ...a.outputHazard, hazard: a.hazard, controlMeasures: measures };
    }),
  );

  let ccpData = null;
  if (output.isCcp) {
    const ccp = await db
      .select()
      .from(outputCcps)
      .where(eq(outputCcps.outputId, outputId))
      .get();

    if (ccp) {
      const [limits, monitoring, corrective, verification] = await Promise.all([
        db.select().from(outputCriticalLimits).where(eq(outputCriticalLimits.outputCcpId, ccp.id)).all(),
        db.select().from(outputMonitoringProcedures).where(eq(outputMonitoringProcedures.outputCcpId, ccp.id)).all(),
        db.select().from(outputCorrectiveActions).where(eq(outputCorrectiveActions.outputCcpId, ccp.id)).all(),
        db.select().from(outputVerificationProcedures).where(eq(outputVerificationProcedures.outputCcpId, ccp.id)).all(),
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

  const allHazards = await db.select().from(hazards).all();

  return (
    <OutputAnalysis
      planId={planId}
      stepId={stepId}
      stepName={step.name}
      output={typedOutput}
      hazardAssignments={hazardData}
      ccpData={ccpData}
      availableHazards={allHazards}
    />
  );
}
