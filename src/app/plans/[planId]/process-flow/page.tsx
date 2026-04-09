import { db } from "@/lib/db";
import { processSteps, stepHazards, stepInputs, inputSubgraphSteps } from "@/lib/db/schema";
import { eq, asc, sql, inArray } from "drizzle-orm";
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

  // Hazard counts per step
  const hazardCounts = db
    .select({ stepId: stepHazards.stepId, count: sql<number>`count(*)` })
    .from(stepHazards)
    .groupBy(stepHazards.stepId)
    .all();

  const hazardCountMap: Record<string, number> = {};
  for (const hc of hazardCounts) hazardCountMap[hc.stepId] = hc.count;

  // Step inputs
  const inputRows = steps.length > 0
    ? db.select().from(stepInputs).where(inArray(stepInputs.stepId, steps.map((s) => s.id))).all()
    : [];

  const inputsByStep: Record<string, typeof inputRows> = {};
  for (const inp of inputRows) {
    if (!inputsByStep[inp.stepId]) inputsByStep[inp.stepId] = [];
    inputsByStep[inp.stepId].push(inp);
  }

  // Input subgraph steps
  const subgraphRows = inputRows.length > 0
    ? db
        .select()
        .from(inputSubgraphSteps)
        .where(inArray(inputSubgraphSteps.inputId, inputRows.map((i) => i.id)))
        .orderBy(asc(inputSubgraphSteps.stepNumber))
        .all()
    : [];

  const subgraphStepsByInput: Record<string, typeof subgraphRows> = {};
  for (const ss of subgraphRows) {
    if (!subgraphStepsByInput[ss.inputId]) subgraphStepsByInput[ss.inputId] = [];
    subgraphStepsByInput[ss.inputId].push(ss);
  }

  return (
    <ProcessFlowEditor
      planId={planId}
      initialSteps={steps}
      hazardCounts={hazardCountMap}
      initialInputs={inputsByStep}
      initialSubgraphSteps={subgraphStepsByInput}
    />
  );
}
