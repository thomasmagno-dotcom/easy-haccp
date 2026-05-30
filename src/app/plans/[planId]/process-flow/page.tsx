import { db } from "@/lib/db";
import {
  processSteps,
  stepHazards,
  hazards,
  outputHazards,
  stepInputs,
  inputSubgraphSteps,
  stepOutputs,
} from "@/lib/db/schema";
import { eq, asc, sql, inArray } from "drizzle-orm";
import { ProcessFlowEditor } from "@/components/process-flow/ProcessFlowEditor";

export const dynamic = "force-dynamic";

export default async function ProcessFlowPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;

  const steps = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .orderBy(asc(processSteps.stepNumber))
    .all();

  const stepIds = steps.map((s) => s.id);

  // ── Hazard counts per step ────────────────────────────────────────────────
  const hazardCounts = await db
    .select({ stepId: stepHazards.stepId, count: sql<number>`count(*)` })
    .from(stepHazards)
    .groupBy(stepHazards.stepId)
    .all();

  const hazardCountMap: Record<string, number> = {};
  for (const hc of hazardCounts) hazardCountMap[hc.stepId] = hc.count;

  // ── Distinct hazard types per step ───────────────────────────────────────
  // e.g. { "stepId123": ["biological", "chemical"] }
  const stepHazardTypeRows = stepIds.length > 0
    ? await db
        .select({ stepId: stepHazards.stepId, type: hazards.type })
        .from(stepHazards)
        .innerJoin(hazards, eq(stepHazards.hazardId, hazards.id))
        .where(inArray(stepHazards.stepId, stepIds))
        .all()
    : [];

  const hazardTypesByStep: Record<string, string[]> = {};
  for (const row of stepHazardTypeRows) {
    if (!hazardTypesByStep[row.stepId]) hazardTypesByStep[row.stepId] = [];
    if (!hazardTypesByStep[row.stepId].includes(row.type)) {
      hazardTypesByStep[row.stepId].push(row.type);
    }
  }

  // ── Step inputs ───────────────────────────────────────────────────────────
  const inputRows = stepIds.length > 0
    ? await db.select().from(stepInputs).where(inArray(stepInputs.stepId, stepIds)).all()
    : [];

  const inputsByStep: Record<string, typeof inputRows> = {};
  for (const inp of inputRows) {
    if (!inputsByStep[inp.stepId]) inputsByStep[inp.stepId] = [];
    inputsByStep[inp.stepId].push(inp);
  }

  // ── Input subgraph steps ──────────────────────────────────────────────────
  const subgraphRows = inputRows.length > 0
    ? await db
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

  // ── Step outputs ──────────────────────────────────────────────────────────
  const outputRows = stepIds.length > 0
    ? await db.select().from(stepOutputs).where(inArray(stepOutputs.stepId, stepIds)).all()
    : [];

  const outputsByStep: Record<string, typeof outputRows> = {};
  for (const out of outputRows) {
    if (!outputsByStep[out.stepId]) outputsByStep[out.stepId] = [];
    outputsByStep[out.stepId].push(out);
  }

  // ── Distinct hazard types per output ─────────────────────────────────────
  const outputIds = outputRows.map((o) => o.id);
  const outputHazardTypeRows = outputIds.length > 0
    ? await db
        .select({ outputId: outputHazards.outputId, type: hazards.type })
        .from(outputHazards)
        .innerJoin(hazards, eq(outputHazards.hazardId, hazards.id))
        .where(inArray(outputHazards.outputId, outputIds))
        .all()
    : [];

  const hazardTypesByOutput: Record<string, string[]> = {};
  for (const row of outputHazardTypeRows) {
    if (!hazardTypesByOutput[row.outputId]) hazardTypesByOutput[row.outputId] = [];
    if (!hazardTypesByOutput[row.outputId].includes(row.type)) {
      hazardTypesByOutput[row.outputId].push(row.type);
    }
  }

  return (
    <ProcessFlowEditor
      planId={planId}
      initialSteps={steps}
      hazardCounts={hazardCountMap}
      hazardTypesByStep={hazardTypesByStep}
      initialInputs={inputsByStep}
      initialSubgraphSteps={subgraphStepsByInput}
      initialOutputsByStep={outputsByStep}
      hazardTypesByOutput={hazardTypesByOutput}
    />
  );
}
