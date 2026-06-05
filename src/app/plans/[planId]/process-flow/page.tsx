import { db } from "@/lib/db";
import {
  processSteps,
  stepHazards,
  hazards,
  outputHazards,
  stepInputs,
  inputSubgraphSteps,
  inputSubgraphStepHazards,
  stepOutputs,
  stepOutputSources,
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

  // Use the array index (1-based position) as the chart-local display number.
  // junction.sequence is only used for ordering — it may not start at 1 for
  // non-default charts (steps inherit their global stepNumber as their sequence
  // when first added to a chart).
  const steps = junctionRows.map(({ junction, step }, index) => {
    const overrides = (() => { try { return junction.localOverrides ? JSON.parse(junction.localOverrides) : {}; } catch { return {}; } })();
    return {
      ...step,
      junctionId: junction.id,
      sequence: index + 1,          // ← position-based (1, 2, 3…) not raw junction.sequence
      isShared: junction.isShared,
      localOverrides: overrides,
      name:        overrides.name        ?? step.name,
      description: overrides.description ?? step.description,
      masterName:        step.name,
      masterDescription: step.description,
    };
  });

  const stepIds = steps.map((s) => s.id);

  // Chart-local sequence map: stepId → 1-based position within this chart
  const stepSequenceMap: Record<string, number> = {};
  steps.forEach((s) => {
    stepSequenceMap[s.id] = s.sequence; // already position-based from map above
  });

  // Chart letter: A for first chart, B for second, C for third, …
  // allCharts is sorted by createdAt so the index is stable.
  const activeChartIndex = allCharts.findIndex((c) => c.id === activeChartId);
  const activeChartLetter = String.fromCharCode(65 + Math.max(0, activeChartIndex));

  // Per-chart letter lookup for cross-chart connection references
  const chartLetterById: Record<string, string> = {};
  allCharts.forEach((c, idx) => {
    chartLetterById[c.id] = String.fromCharCode(65 + idx);
  });

  // stepLabelMap: stepId → label for steps in the ACTIVE chart (e.g. "A3")
  const stepLabelMap: Record<string, string> = {};
  for (const [stepId, seq] of Object.entries(stepSequenceMap)) {
    stepLabelMap[stepId] = `${activeChartLetter}${seq}`;
  }

  // ── Global step label map — covers ALL charts in the plan ─────────────────
  // Required for cross-chart references (e.g. "B3: Water Treatment" when viewed
  // from Main Process chart A).  We load every chart's steps, sorted by
  // sequence, and use the array index (position) to compute the correct label.
  const allPlanChartRows = await db
    .select({
      chartId: flowChartSteps.flowChartId,
      stepId:  flowChartSteps.stepId,
    })
    .from(flowChartSteps)
    .innerJoin(flowCharts, eq(flowChartSteps.flowChartId, flowCharts.id))
    .where(eq(flowCharts.haccpPlanId, planId))
    .orderBy(asc(flowChartSteps.sequence))
    .all();

  // Group by chart to compute 1-based positions
  const chartStepGroups: Record<string, string[]> = {};
  for (const row of allPlanChartRows) {
    if (!chartStepGroups[row.chartId]) chartStepGroups[row.chartId] = [];
    chartStepGroups[row.chartId].push(row.stepId);
  }

  // stepGlobalLabelMap: stepId → "B3", "C1", etc.
  // First-chart-wins for shared steps.
  const stepGlobalLabelMap: Record<string, string> = {};
  for (const [chartId, stepIds] of Object.entries(chartStepGroups)) {
    const letter = chartLetterById[chartId];
    if (!letter) continue;
    stepIds.forEach((stepId, idx) => {
      if (!stepGlobalLabelMap[stepId]) {
        stepGlobalLabelMap[stepId] = `${letter}${idx + 1}`;
      }
    });
  }

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

  // ── Hazard types per subgraph step (for B/C/P badges) ────────────────────
  const subgraphIds = subgraphRows.map((ss) => ss.id);
  const subgraphHazardTypeRows = subgraphIds.length > 0
    ? await db
        .select({ subgraphStepId: inputSubgraphStepHazards.subgraphStepId, type: hazards.type })
        .from(inputSubgraphStepHazards)
        .innerJoin(hazards, eq(inputSubgraphStepHazards.hazardId, hazards.id))
        .where(inArray(inputSubgraphStepHazards.subgraphStepId, subgraphIds))
        .all()
    : [];
  const hazardTypesBySubgraphStep: Record<string, string[]> = {};
  for (const row of subgraphHazardTypeRows) {
    if (!hazardTypesBySubgraphStep[row.subgraphStepId]) hazardTypesBySubgraphStep[row.subgraphStepId] = [];
    if (!hazardTypesBySubgraphStep[row.subgraphStepId].includes(row.type)) {
      hazardTypesBySubgraphStep[row.subgraphStepId].push(row.type);
    }
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

  // ── Step output sources (multiple steps → same output) ───────────────────
  // Query 1: source links for outputs owned by steps in this chart.
  const outputSourceByOutputId = outputIds.length > 0
    ? await db
        .select({ source: stepOutputSources, step: processSteps, output: stepOutputs })
        .from(stepOutputSources)
        .innerJoin(processSteps, eq(stepOutputSources.stepId, processSteps.id))
        .innerJoin(stepOutputs, eq(stepOutputSources.outputId, stepOutputs.id))
        .where(inArray(stepOutputSources.outputId, outputIds))
        .all()
    : [];
  // Query 2: source links where this chart's step is itself an additional source.
  const outputSourceByStepId = stepIds.length > 0
    ? await db
        .select({ source: stepOutputSources, step: processSteps, output: stepOutputs })
        .from(stepOutputSources)
        .innerJoin(processSteps, eq(stepOutputSources.stepId, processSteps.id))
        .innerJoin(stepOutputs, eq(stepOutputSources.outputId, stepOutputs.id))
        .where(inArray(stepOutputSources.stepId, stepIds))
        .all()
    : [];
  // Merge and deduplicate
  const seenSourceIds = new Set<string>();
  const outputSourceRows = [...outputSourceByOutputId, ...outputSourceByStepId].filter((r) => {
    if (seenSourceIds.has(r.source.id)) return false;
    seenSourceIds.add(r.source.id);
    return true;
  });

  // outputSourcesByOutput: outputId → [{id, stepId, stepName, stepNumber, stepLabel}]
  const outputSourcesByOutput: Record<string, Array<{ id: string; stepId: string; stepName: string; stepNumber: number; stepLabel: string }>> = {};
  for (const row of outputSourceRows) {
    const oid = row.source.outputId;
    if (!outputSourcesByOutput[oid]) outputSourcesByOutput[oid] = [];
    const seq = stepSequenceMap[row.source.stepId] ?? row.step.stepNumber;
    outputSourcesByOutput[oid].push({
      id: row.source.id,
      stepId: row.source.stepId,
      stepName: row.step.name,
      stepNumber: seq,
      stepLabel: stepGlobalLabelMap[row.source.stepId] ?? stepLabelMap[row.source.stepId] ?? `${activeChartLetter}${seq}`,
    });
  }

  // Add shared outputs to the outputsByStep map for source steps
  // (outputs owned by a different step but also produced here)
  for (const row of outputSourceRows) {
    const sid = row.source.stepId;
    if (!outputsByStep[sid]) outputsByStep[sid] = [];
    // Only add if not already present (avoid duplicates when primary step is also in chart)
    if (!outputsByStep[sid].find((o) => o.id === row.output.id)) {
      outputsByStep[sid].push(row.output);
    }
    // Also include hazard types for the shared output
    if (!hazardTypesByOutput[row.output.id]) {
      hazardTypesByOutput[row.output.id] = [];
    }
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

  // Enrich connections with step/chart names + output type + all source steps for display
  const enrichedConns = await Promise.all(
    conns.map(async (c) => {
      const srcStep = await db.select({ name: processSteps.name, stepNumber: processSteps.stepNumber }).from(processSteps).where(eq(processSteps.id, c.sourceStepId)).get();
      const srcStepSeq = stepSequenceMap[c.sourceStepId] ?? srcStep?.stepNumber ?? 0;
      const srcChartLetter = chartLetterById[c.sourceFlowChartId] ?? activeChartLetter;
      // Use the global label map for accurate cross-chart labels (e.g. "B3" not "A7")
      const srcStepLabel = stepGlobalLabelMap[c.sourceStepId] ?? `${srcChartLetter}${srcStepSeq}`;
      const tgtStep = await db.select({ name: processSteps.name }).from(processSteps).where(eq(processSteps.id, c.targetStepId)).get();
      const srcOut  = await db.select({ name: stepOutputs.name, outputType: stepOutputs.outputType }).from(stepOutputs).where(eq(stepOutputs.id, c.sourceOutputId)).get();
      const srcChart = allCharts.find((ch) => ch.id === c.sourceFlowChartId);
      const tgtChart = allCharts.find((ch) => ch.id === c.targetFlowChartId)
        ?? await db.select({ name: flowCharts.name }).from(flowCharts).where(eq(flowCharts.id, c.targetFlowChartId)).get();

      // Build the full list of steps that produce this output (primary + additional sources)
      const additionalSrcs = outputSourcesByOutput[c.sourceOutputId] ?? [];
      const allSourceSteps: Array<{ stepName: string; stepNumber: number; stepLabel: string }> = [];
      if (srcStep) allSourceSteps.push({ stepName: srcStep.name, stepNumber: srcStepSeq, stepLabel: srcStepLabel });
      for (const s of additionalSrcs) {
        if (!allSourceSteps.find((x) => x.stepName === s.stepName)) {
          allSourceSteps.push({ stepName: s.stepName, stepNumber: s.stepNumber, stepLabel: s.stepLabel });
        }
      }

      return {
        ...c,
        sourceStepName:      srcStep?.name ?? null,
        targetStepName:      tgtStep?.name ?? null,
        sourceOutputName:    srcOut?.name ?? null,
        sourceOutputType:    srcOut?.outputType ?? null,
        sourceFlowChartName: srcChart?.name ?? null,
        targetFlowChartName: (tgtChart as { name?: string })?.name ?? null,
        allSourceSteps,
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
      key={activeChartId}
      planId={planId}
      flowCharts={allCharts as any[]}
      activeFlowChartId={activeChartId}
      initialSteps={steps as any[]}
      hazardCounts={hazardCountMap}
      hazardTypesByStep={hazardTypesByStep}
      initialInputs={inputsByStep}
      initialSubgraphSteps={subgraphStepsByInput}
      hazardTypesBySubgraphStep={hazardTypesBySubgraphStep}
      initialOutputsByStep={outputsByStep}
      hazardTypesByOutput={hazardTypesByOutput}
      connectionsFromOutput={connectionsFromOutput as any}
      connectionsToStep={connectionsToStep as any}
      initialOutputSourcesByOutput={outputSourcesByOutput}
      chartLetterById={chartLetterById}
      stepGlobalLabelMap={stepGlobalLabelMap}
    />
  );
}
