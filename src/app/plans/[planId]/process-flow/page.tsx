import { db } from "@/lib/db";
import { processSteps, stepHazards } from "@/lib/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { ProcessFlowEditor } from "@/components/process-flow/ProcessFlowEditor";

export const dynamic = "force-dynamic";

export default async function ProcessFlowPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;

  const steps = db
    .select()
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .orderBy(asc(processSteps.stepNumber))
    .all();

  // Get hazard counts per step
  const hazardCounts = db
    .select({
      stepId: stepHazards.stepId,
      count: sql<number>`count(*)`,
    })
    .from(stepHazards)
    .groupBy(stepHazards.stepId)
    .all();

  const hazardCountMap: Record<string, number> = {};
  for (const hc of hazardCounts) {
    hazardCountMap[hc.stepId] = hc.count;
  }

  return (
    <ProcessFlowEditor
      planId={planId}
      initialSteps={steps}
      hazardCounts={hazardCountMap}
    />
  );
}
