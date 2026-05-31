import { db } from "@/lib/db";
import {
  processSteps,
  stepHazards,
  hazards,
  outputHazards,
  stepInputs,
  inputSubgraphSteps,
  stepOutputs,
  flowChartSteps,
  stepConnections,
} from "@/lib/db/schema";
import { eq, asc, sql, inArray, or } from "drizzle-orm";
import { ProcessFlowEditor } from "@/components/process-flow/ProcessFlowEditor";
import { ensureDefaultFlowChart, ensureJunction } from "@/lib/logic/flow-chart";

export const dynamic = "force-dynamic";

export default async function ProcessFlowPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ chartId?: string }>;
}) {
  const { planId } = await params;
  const { chartId: chartIdParam } = await searchParams;

  // ── Flow chart resolution ─────────────────────────────────────────────────
  // Import flowCharts here to avoid circular — use db directly
  const { flowCharts } = await import("@/lib/db/schema");
  await ensureDefaultFlowChart(planId);

  const allCharts = await db
    .select()
    .from(flowCharts)
    .where(eq(flowCharts.haccpPlanId, planId))
    .orderBy(asc(flowCharts.createdAt))
    .all();

  const activeChart = chartIdParam
    ? (allCharts.find((c) => c.id === chartIdParam) ?? allCharts[0])
    : allCharts[0];

  const activeChartId = activeChart.id;
  await ensureJunction(activeChartId, planId);

  // ── Steps via junction ────────────────────────────────────────────────────
  const junctionRows = await db
    .select({ junction: flowChartSteps, step: processSteps })
    .from(flowChartSteps)
    .innerJoin(processSteps, eq(flowChartSteps.stepId, processSteps.id))
    .where(eq(flowChartSteps.flowChartId, activeChartId))
    .orderBy(asc(flowChartSteps.sequence))
    .all();

  const steps = junctionRows.map(({ junction, step }) => {
    const overrides = (() => { try { return junction.localOverrides ? JSON.parse(junction.localOverrides) : {}; } catch { return {}; } })();
    return {
      ...step,
      junctionId: junction.id,
      sequence: junction.sequence,
      isShared: junction.isShared,
      localOverrides: overrides,
      name:        overrides.name        ?? step.name,
      description: overrides.description ?? step.description,
      masterName:        step.name,
      masterDescription: step.description,
    };
  });

  const stepIds = steps.map((s) => s.id);

  // ── Hazard counts ─────────────────────────────────────────────────────────
  const hazardCounts = await db
    .select({ stepId: stepHazards.stepId, count: sql<number>`count(*)` })
    .from(stepHazards)
    .groupBy(stepHazards.stepId)
    .all();
  const hazardCountMap: Record<string, number> = {};
  for (const hc of hazardCounts) hazardCountMap[hc.stepId] = hc.count;

  // ── Distinct hazard types per step ────────────────────────────────────────
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
    if (!hazardTypesByStep[row.stepId].includes(row.type)) hazardTypesByStep[row.stepId].push(row.type);
  }

  // ── Step inputs / subgraph steps ──────────────────────────────────────────
  const inputRows = stepIds.length > 0
    ? await db.select().from(stepInputs).where(inArray(stepInputs.stepId, stepIds)).all()
    : [];
  const inputsByStep: Record<string, typeof inputRows> = {};
  for (const inp of inputRows) {
    if (!inputsByStep[inp.stepId]) inputsByStep[inp.stepId] = [];
    inputsByStep[inp.stepId].push(inp);
  }

  const subgraphRows = inputRows.length > 0
    ? await db.select().from(inputSubgraphSteps)
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

  // ── Hazard types per output ───────────────────────────────────────────────
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
    if (!hazardTypesByOutput[row.outputId].includes(row.type)) hazardTypesByOutput[row.outputId].push(row.type);
  }

  // ── Step connections (bidirectional — all connections touching this chart) ─
  const conns = stepIds.length > 0
    ? await db
        .select()
        .from(stepConnections)
        .where(
          or(
            inArray(stepConnections.sourceStepId, stepIds),
            inArray(stepConnections.targetStepId, stepIds),
          ),
        )
        .all()
    : [];

  // Enrich connections with step/chart names for display
  const enrichedConns = await Promise.all(
    conns.map(async (c) => {
      const srcStep = await db.select({ name: processSteps.name }).from(processSteps).where(eq(processSteps.id, c.sourceStepId)).get();
      const tgtStep = await db.select({ name: processSteps.name }).from(processSteps).where(eq(processSteps.id, c.targetStepId)).get();
      const srcOut  = await db.select({ name: stepOutputs.name }).from(stepOutputs).where(eq(stepOutputs.id, c.sourceOutputId)).get();
      const srcChart = allCharts.find((ch) => ch.id === c.sourceFlowChartId);
      const tgtChart = allCharts.find((ch) => ch.id === c.targetFlowChartId)
        ?? await db.select({ name: flowCharts.name }).from(flowCharts).where(eq(flowCharts.id, c.targetFlowChartId)).get();
      return {
        ...c,
        sourceStepName:      srcStep?.name ?? null,
        targetStepName:      tgtStep?.name ?? null,
        sourceOutputName:    srcOut?.name ?? null,
        sourceFlowChartName: srcChart?.name ?? null,
        targetFlowChartName: (tgtChart as { name?: string })?.name ?? null,
      };
    }),
  );

  // Build maps for quick lookup in the UI
  // connectionsFromOutput: outputId → connection[]
  // connectionsToStep: stepId → connection[]
  const connectionsFromOutput: Record<string, typeof enrichedConns> = {};
  const connectionsToStep: Record<string, typeof enrichedConns> = {};
  for (const c of enrichedConns) {
    if (!connectionsFromOutput[c.sourceOutputId]) connectionsFromOutput[c.sourceOutputId] = [];
    connectionsFromOutput[c.sourceOutputId].push(c);
    if (!connectionsToStep[c.targetStepId]) connectionsToStep[c.targetStepId] = [];
    connectionsToStep[c.targetStepId].push(c);
  }

  return (
    <ProcessFlowEditor
      planId={planId}
      flowCharts={allCharts as any[]}
      activeFlowChartId={activeChartId}
      initialSteps={steps as any[]}
      hazardCounts={hazardCountMap}
      hazardTypesByStep={hazardTypesByStep}
      initialInputs={inputsByStep}
      initialSubgraphSteps={subgraphStepsByInput}
      initialOutputsByStep={outputsByStep}
      hazardTypesByOutput={hazardTypesByOutput}
      connectionsFromOutput={connectionsFromOutput as any}
      connectionsToStep={connectionsToStep as any}
    />
  );
}
