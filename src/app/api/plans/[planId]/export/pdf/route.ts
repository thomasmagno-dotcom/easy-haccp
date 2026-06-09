import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { db } from "@/lib/db";
import { buildForms59Rows } from "@/lib/logic/forms59";
import {
  haccpPlans,
  processSteps,
  stepHazards,
  hazards,
  controlMeasures,
  ccps,
  criticalLimits,
  monitoringProcedures,
  correctiveActions,
  verificationProcedures,
  ingredients,
  ingredientHazards,
  ingredientControlMeasures,
  stepInputs,
  inputSubgraphSteps,
  inputSubgraphStepHazards,
  inputSubgraphStepControlMeasures,
  stepOutputs,
  stepOutputSources,
  stepConnections,
  outputHazards,
  outputControlMeasures,
  outputCcps,
  outputCriticalLimits,
  outputMonitoringProcedures,
  outputCorrectiveActions,
  outputVerificationProcedures,
  hazardPrp,
  prpMaster,
  planVersions,
  flowCharts,
  flowChartSteps,
} from "@/lib/db/schema";
import { eq, asc, desc, inArray, or } from "drizzle-orm";
import { PdfHaccpPlan } from "@/components/pdf/PdfHaccpPlan";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;

  const plan = await db
    .select()
    .from(haccpPlans)
    .where(eq(haccpPlans.id, planId))
    .get();

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // ── Flow charts (in creation order) ───────────────────────────────────────
  const allCharts = await db
    .select()
    .from(flowCharts)
    .where(eq(flowCharts.haccpPlanId, planId))
    .orderBy(asc(flowCharts.createdAt))
    .all();

  // Steps per chart, in junction sequence order (not raw stepNumber)
  const chartStepRows = await Promise.all(
    allCharts.map(async (chart) => {
      const rows = await db
        .select({ step: processSteps, sequence: flowChartSteps.sequence })
        .from(flowChartSteps)
        .innerJoin(processSteps, eq(flowChartSteps.stepId, processSteps.id))
        .where(eq(flowChartSteps.flowChartId, chart.id))
        .orderBy(asc(flowChartSteps.sequence))
        .all();
      // Use the array index (1-based position) as chartSequence — not r.sequence,
      // which may be a global number for non-default charts.
      return { chart, steps: rows.map((r, idx) => ({ ...r.step, chartSequence: idx + 1 })) };
    }),
  );

  // Chart letter map: chartId → "A", "B", "C"…
  const chartLetterMap = new Map<string, string>();
  allCharts.forEach((chart, idx) => {
    chartLetterMap.set(chart.id, String.fromCharCode(65 + idx));
  });

  // Per-step: (chartId, stepId) → chartSequence so we can build labels like "A3"
  const stepChartSequenceMap = new Map<string, number>();
  // Also build step → chart mapping for cross-chart label lookups
  const stepChartIdMap = new Map<string, string>(); // stepId → first chartId it appears in
  for (const { chart, steps: chartSteps } of chartStepRows) {
    chartSteps.forEach((s, idx) => {
      const seq = (s as any).chartSequence ?? (idx + 1); // position-based
      if (!stepChartSequenceMap.has(s.id)) {
        stepChartSequenceMap.set(s.id, seq);
        stepChartIdMap.set(s.id, chart.id);
      }
    });
  }

  const makeStepLabelPdf = (stepId: string, chartId?: string): string => {
    const seq = stepChartSequenceMap.get(stepId) ?? 0;
    const resolvedChartId = chartId ?? stepChartIdMap.get(stepId);
    const letter = (resolvedChartId && chartLetterMap.get(resolvedChartId)) ?? "A";
    return `${letter}${seq}`;
  };

  // Flat deduplicated list for shared-step hazard data fetching
  const seenStepIds = new Set<string>();
  const steps = chartStepRows
    .flatMap((c) => c.steps)
    .filter((s) => { if (seenStepIds.has(s.id)) return false; seenStepIds.add(s.id); return true; });

  const stepIds = steps.map((s) => s.id);

  // ── Step inputs (with subgraph steps) ─────────────────────────────────────
  const allInputRows = stepIds.length > 0
    ? await db.select().from(stepInputs).where(inArray(stepInputs.stepId, stepIds)).all()
    : [];
  const allInputIds = allInputRows.map((i) => i.id);
  const allSubgraphRows = allInputIds.length > 0
    ? await db
        .select()
        .from(inputSubgraphSteps)
        .where(inArray(inputSubgraphSteps.inputId, allInputIds))
        .orderBy(asc(inputSubgraphSteps.stepNumber))
        .all()
    : [];
  // Hazard types per subgraph step (for B/C/P badges in PDF)
  const allSubgraphIds = allSubgraphRows.map((ss) => ss.id);
  const subgraphHazardTypeRows = allSubgraphIds.length > 0
    ? await db
        .select({ subgraphStepId: inputSubgraphStepHazards.subgraphStepId, type: hazards.type })
        .from(inputSubgraphStepHazards)
        .innerJoin(hazards, eq(inputSubgraphStepHazards.hazardId, hazards.id))
        .where(inArray(inputSubgraphStepHazards.subgraphStepId, allSubgraphIds))
        .all()
    : [];
  const hazardTypesBySubgraphStepId = new Map<string, string[]>();
  for (const row of subgraphHazardTypeRows) {
    if (!hazardTypesBySubgraphStepId.has(row.subgraphStepId)) hazardTypesBySubgraphStepId.set(row.subgraphStepId, []);
    const arr = hazardTypesBySubgraphStepId.get(row.subgraphStepId)!;
    if (!arr.includes(row.type)) arr.push(row.type);
  }

  const subgraphByInputId = new Map<string, Array<typeof allSubgraphRows[0] & { hazardTypes: string[] }>>();
  for (const ss of allSubgraphRows) {
    if (!subgraphByInputId.has(ss.inputId)) subgraphByInputId.set(ss.inputId, []);
    subgraphByInputId.get(ss.inputId)!.push({ ...ss, hazardTypes: hazardTypesBySubgraphStepId.get(ss.id) || [] });
  }
  const inputsByStep = new Map<string, Array<typeof allInputRows[0] & { subgraphSteps: ReturnType<typeof subgraphByInputId.get> extends undefined ? never : NonNullable<ReturnType<typeof subgraphByInputId.get>> }>>();
  for (const inp of allInputRows) {
    if (!inputsByStep.has(inp.stepId)) inputsByStep.set(inp.stepId, []);
    (inputsByStep.get(inp.stepId) as Array<unknown>)!.push({ ...inp, subgraphSteps: subgraphByInputId.get(inp.id) || [] });
  }

  // ── Step outputs ───────────────────────────────────────────────────────────
  const allOutputRows = stepIds.length > 0
    ? await db.select().from(stepOutputs).where(inArray(stepOutputs.stepId, stepIds)).all()
    : [];

  // Distinct hazard types per output (for flow diagram badges)
  const allOutputIds = allOutputRows.map((o) => o.id);
  const outputHazardTypeRows = allOutputIds.length > 0
    ? await db
        .select({ outputId: outputHazards.outputId, type: hazards.type })
        .from(outputHazards)
        .innerJoin(hazards, eq(outputHazards.hazardId, hazards.id))
        .where(inArray(outputHazards.outputId, allOutputIds))
        .all()
    : [];

  const hazardTypesByOutputId = new Map<string, string[]>();
  for (const row of outputHazardTypeRows) {
    if (!hazardTypesByOutputId.has(row.outputId)) hazardTypesByOutputId.set(row.outputId, []);
    const arr = hazardTypesByOutputId.get(row.outputId)!;
    if (!arr.includes(row.type)) arr.push(row.type);
  }

  type OutputProducer = { stepId: string; stepLabel: string; stepName: string; isPrimary: boolean };
  type OutgoingConnection = { targetStepName: string; targetStepLabel: string; connectionType: string };
  type EnrichedOutput = typeof allOutputRows[0] & {
    hazardTypes: string[];
    sourceSteps?: Array<{ stepId: string; stepName: string; stepNumber: number; stepLabel: string }>;
    allProducers?: OutputProducer[]; // pre-computed: primary owner + all additional sources
    outgoingConnections?: OutgoingConnection[];
  };
  const outputsByStep = new Map<string, Array<EnrichedOutput>>();
  for (const out of allOutputRows) {
    if (!outputsByStep.has(out.stepId)) outputsByStep.set(out.stepId, []);
    outputsByStep.get(out.stepId)!.push({
      ...out,
      hazardTypes: hazardTypesByOutputId.get(out.id) || [],
    });
  }

  // ── Step output sources (multiple steps → same output) ────────────────────
  const outputSourceRows = allOutputIds.length > 0
    ? await db
        .select({ source: stepOutputSources, step: processSteps, output: stepOutputs })
        .from(stepOutputSources)
        .innerJoin(processSteps, eq(stepOutputSources.stepId, processSteps.id))
        .innerJoin(stepOutputs, eq(stepOutputSources.outputId, stepOutputs.id))
        .where(
          or(
            inArray(stepOutputSources.outputId, allOutputIds),
            stepIds.length > 0 ? inArray(stepOutputSources.stepId, stepIds) : undefined,
          ),
        )
        .all()
    : [];

  // Build source step list per output (for PDF "shared by" annotation)
  const outputSourceStepsByOutputId = new Map<string, Array<{ stepId: string; stepName: string; stepNumber: number; stepLabel: string }>>();
  for (const row of outputSourceRows) {
    const oid = row.source.outputId;
    if (!outputSourceStepsByOutputId.has(oid)) outputSourceStepsByOutputId.set(oid, []);
    const srcSeq = stepChartSequenceMap.get(row.step.id) ?? row.step.stepNumber;
    outputSourceStepsByOutputId.get(oid)!.push({ stepId: row.step.id, stepName: row.step.name, stepNumber: srcSeq, stepLabel: makeStepLabelPdf(row.step.id) });
    // Add the output to the source step's list too
    if (!outputsByStep.has(row.step.id)) outputsByStep.set(row.step.id, []);
    const arr = outputsByStep.get(row.step.id)!;
    if (!arr.find((o) => o.id === row.output.id)) {
      arr.push({ ...row.output, hazardTypes: hazardTypesByOutputId.get(row.output.id) || [] });
    }
  }

  // Attach sourceSteps + allProducers to each output
  for (const [, outs] of outputsByStep) {
    for (const out of outs) {
      const sourceStePs = outputSourceStepsByOutputId.get(out.id) ?? [];
      (out as EnrichedOutput).sourceSteps = sourceStePs;

      // Build the full producing-steps list (same structure as the app's allProducingStepsByOutput)
      // Primary = out.stepId (always, regardless of which step's column we're in)
      const ownerStep = steps.find((s) => s.id === out.stepId);
      const producers: OutputProducer[] = [];
      if (ownerStep) {
        producers.push({
          stepId: ownerStep.id,
          stepLabel: makeStepLabelPdf(ownerStep.id),
          stepName: ownerStep.name,
          isPrimary: true,
        });
      }
      for (const src of sourceStePs) {
        producers.push({
          stepId: src.stepId,
          stepLabel: src.stepLabel,
          stepName: src.stepName,
          isPrimary: false,
        });
      }
      (out as EnrichedOutput).allProducers = producers;
    }
  }

  // ── Step connections (for connected-input display in PDF) ─────────────────
  const allConns = stepIds.length > 0
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

  // Build enriched connection map: targetStepId → [{outputName, outputType, allSourceSteps, connectionType}]
  type SourceStepRef = { stepName: string; stepNumber: number; stepLabel?: string };
  type ConnectedInput = { outputId: string; outputName: string; outputType: string; allSourceSteps: SourceStepRef[]; connectionType: string };
  const connectedInputsByStep = new Map<string, ConnectedInput[]>();
  for (const conn of allConns) {
    const srcStep = steps.find((s) => s.id === conn.sourceStepId);
    const srcOut  = allOutputRows.find((o) => o.id === conn.sourceOutputId);

    // Collect all steps that produce this output: primary owner + additional sources
    const allSourceSteps: SourceStepRef[] = [];
    const srcSeq2 = stepChartSequenceMap.get(srcStep?.id ?? "") ?? srcStep?.stepNumber ?? 0;
    if (srcStep) allSourceSteps.push({ stepName: srcStep.name, stepNumber: srcSeq2, stepLabel: makeStepLabelPdf(srcStep.id, conn.sourceFlowChartId) });
    const additionalSrcs = outputSourceStepsByOutputId.get(conn.sourceOutputId) ?? [];
    for (const s of additionalSrcs) {
      if (!allSourceSteps.find((x) => x.stepName === s.stepName)) {
        allSourceSteps.push({ stepName: s.stepName, stepNumber: s.stepNumber, stepLabel: s.stepLabel });
      }
    }

    if (!connectedInputsByStep.has(conn.targetStepId)) connectedInputsByStep.set(conn.targetStepId, []);
    connectedInputsByStep.get(conn.targetStepId)!.push({
      outputId:       conn.sourceOutputId,
      outputName:     srcOut?.name ?? "—",
      outputType:     srcOut?.outputType ?? "other",
      allSourceSteps,
      connectionType: conn.connectionType,
    });
  }

  // Build outgoing connections per output: outputId → [{targetStepName, connectionType}]
  const outgoingConnsByOutputId = new Map<string, OutgoingConnection[]>();
  for (const conn of allConns) {
    const tgtStep = steps.find((s) => s.id === conn.targetStepId);
    if (!outgoingConnsByOutputId.has(conn.sourceOutputId)) outgoingConnsByOutputId.set(conn.sourceOutputId, []);
    outgoingConnsByOutputId.get(conn.sourceOutputId)!.push({
      targetStepName:  tgtStep?.name ?? "—",
      targetStepLabel: makeStepLabelPdf(conn.targetStepId),
      connectionType:  conn.connectionType,
    });
  }

  // Attach outgoing connections to each enriched output
  for (const [, outs] of outputsByStep) {
    for (const out of outs) {
      (out as EnrichedOutput).outgoingConnections = outgoingConnsByOutputId.get(out.id) ?? [];
    }
  }

  // ── Hazard data per step (with control measures + decision tree) ───────────
  const stepsWithData = await Promise.all(steps.map(async (step) => {
    const shList = await db
      .select({ stepHazard: stepHazards, hazard: hazards })
      .from(stepHazards)
      .innerJoin(hazards, eq(stepHazards.hazardId, hazards.id))
      .where(eq(stepHazards.stepId, step.id))
      .all();

    const hazardData = await Promise.all(shList.map(async (sh) => {
      const measures = await db
        .select()
        .from(controlMeasures)
        .where(eq(controlMeasures.stepHazardId, sh.stepHazard.id))
        .all();
      return { ...sh.stepHazard, hazard: sh.hazard, controlMeasures: measures };
    }));

    let ccpData = null;
    if (step.isCcp) {
      const ccp = await db.select().from(ccps).where(eq(ccps.stepId, step.id)).get();
      if (ccp) {
        ccpData = {
          ...ccp,
          criticalLimits: await db.select().from(criticalLimits).where(eq(criticalLimits.ccpId, ccp.id)).all(),
          monitoringProcedures: await db.select().from(monitoringProcedures).where(eq(monitoringProcedures.ccpId, ccp.id)).all(),
          correctiveActions: await db.select().from(correctiveActions).where(eq(correctiveActions.ccpId, ccp.id)).all(),
          verificationProcedures: await db.select().from(verificationProcedures).where(eq(verificationProcedures.ccpId, ccp.id)).all(),
        };
      }
    }

    return {
      ...step,
      hazards: hazardData,
      ccp: ccpData,
      inputs: inputsByStep.get(step.id) || [],
      outputs: outputsByStep.get(step.id) || [],
      connectedInputs: connectedInputsByStep.get(step.id) || [],
    };
  }));

  // ── PRP links for all hazards in the plan ─────────────────────────────────
  // Collect all distinct hazardIds referenced across all steps
  const allHazardIds = Array.from(
    new Set(stepsWithData.flatMap((s) => s.hazards.map((h) => h.hazardId))),
  );

  const prpLinks = allHazardIds.length > 0
    ? await db
        .select({ link: hazardPrp, prp: prpMaster })
        .from(hazardPrp)
        .innerJoin(prpMaster, eq(hazardPrp.prpMasterId, prpMaster.id))
        .where(inArray(hazardPrp.hazardId, allHazardIds))
        .all()
    : [];

  // Build map: hazardId → PrpMaster[]
  const prpsByHazardId = new Map<string, Array<typeof prpLinks[0]["prp"]>>();
  for (const { link, prp } of prpLinks) {
    if (!prpsByHazardId.has(link.hazardId)) prpsByHazardId.set(link.hazardId, []);
    prpsByHazardId.get(link.hazardId)!.push(prp);
  }

  // Attach PRPs to each step's hazard data
  const stepsWithPrps = stepsWithData.map((step) => ({
    ...step,
    hazards: step.hazards.map((sh) => ({
      ...sh,
      linkedPrps: prpsByHazardId.get(sh.hazardId) || [],
    })),
  }));

  // ── Ingredients ────────────────────────────────────────────────────────────
  const ingredientRows = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.planId, planId))
    .orderBy(asc(ingredients.createdAt))
    .all();

  const ingredientsWithHazards = await Promise.all(ingredientRows.map(async (ing) => {
    const ihList = await db
      .select({ ih: ingredientHazards, hazard: hazards })
      .from(ingredientHazards)
      .innerJoin(hazards, eq(ingredientHazards.hazardId, hazards.id))
      .where(eq(ingredientHazards.ingredientId, ing.id))
      .all();
    return {
      ...ing,
      hazards: await Promise.all(ihList.map(async (r) => {
        const cms = await db
          .select()
          .from(ingredientControlMeasures)
          .where(eq(ingredientControlMeasures.ingredientHazardId, r.ih.id))
          .all();
        return { ...r.ih, hazard: r.hazard, controlMeasures: cms };
      })),
    };
  }));

  // ── Version history ────────────────────────────────────────────────────────
  const allVersions = await db
    .select()
    .from(planVersions)
    .where(eq(planVersions.planId, planId))
    .orderBy(desc(planVersions.versionNumber))
    .all();

  const latestVersion = allVersions[0] ?? null;
  const snapshotAt = new Date().toISOString();

  // ── Input subgraph step full hazard analysis ──────────────────────────────
  // Collect all subgraph step IDs across all inputs
  const allSubgraphStepIds = allSubgraphRows.map((ss) => ss.id);
  const subgraphHazardAssignments = allSubgraphStepIds.length > 0
    ? await db
        .select({ assignment: inputSubgraphStepHazards, hazard: hazards })
        .from(inputSubgraphStepHazards)
        .innerJoin(hazards, eq(inputSubgraphStepHazards.hazardId, hazards.id))
        .where(inArray(inputSubgraphStepHazards.subgraphStepId, allSubgraphStepIds))
        .all()
    : [];

  // Build enriched subgraph hazard data grouped by subgraph step ID
  const subgraphHazardsByStepId = new Map<string, object[]>();
  for (const { assignment, hazard } of subgraphHazardAssignments) {
    const measures = await db
      .select({ measure: inputSubgraphStepControlMeasures, prp: prpMaster })
      .from(inputSubgraphStepControlMeasures)
      .leftJoin(prpMaster, eq(inputSubgraphStepControlMeasures.prpMasterId, prpMaster.id))
      .where(eq(inputSubgraphStepControlMeasures.subgraphHazardId, assignment.id))
      .all();
    if (!subgraphHazardsByStepId.has(assignment.subgraphStepId)) {
      subgraphHazardsByStepId.set(assignment.subgraphStepId, []);
    }
    subgraphHazardsByStepId.get(assignment.subgraphStepId)!.push({
      ...assignment,
      hazard,
      controlMeasures: measures.map(({ measure, prp }) => ({ ...measure, prpName: prp?.programName ?? null, prpFsepCode: prp?.fsepCode ?? null })),
    });
  }

  // ── Output full hazard analysis ────────────────────────────────────────────
  const outputHazardAssignments = allOutputIds.length > 0
    ? await db
        .select({ oh: outputHazards, hazard: hazards })
        .from(outputHazards)
        .innerJoin(hazards, eq(outputHazards.hazardId, hazards.id))
        .where(inArray(outputHazards.outputId, allOutputIds))
        .all()
    : [];

  const outputHazardsByOutputId = new Map<string, object[]>();
  for (const { oh, hazard } of outputHazardAssignments) {
    const measures = await db.select().from(outputControlMeasures).where(eq(outputControlMeasures.outputHazardId, oh.id)).all();
    if (!outputHazardsByOutputId.has(oh.outputId)) outputHazardsByOutputId.set(oh.outputId, []);
    outputHazardsByOutputId.get(oh.outputId)!.push({ ...oh, hazard, controlMeasures: measures });
  }

  // Output CCP details
  const outputCcpByOutputId = new Map<string, object>();
  for (const out of allOutputRows) {
    if (!out.isCcp) continue;
    const ccp = await db.select().from(outputCcps).where(eq(outputCcps.outputId, out.id)).get();
    if (!ccp) continue;
    const [limits, monitoring, corrective, verification] = await Promise.all([
      db.select().from(outputCriticalLimits).where(eq(outputCriticalLimits.outputCcpId, ccp.id)).all(),
      db.select().from(outputMonitoringProcedures).where(eq(outputMonitoringProcedures.outputCcpId, ccp.id)).all(),
      db.select().from(outputCorrectiveActions).where(eq(outputCorrectiveActions.outputCcpId, ccp.id)).all(),
      db.select().from(outputVerificationProcedures).where(eq(outputVerificationProcedures.outputCcpId, ccp.id)).all(),
    ]);
    outputCcpByOutputId.set(out.id, { ...ccp, criticalLimits: limits, monitoringProcedures: monitoring, correctiveActions: corrective, verificationProcedures: verification });
  }

  // Build a lookup so chart-grouped steps can get their enriched data
  const stepDataById = new Map(stepsWithPrps.map((s) => [s.id, s]));

  const flowChartGroups = chartStepRows.map(({ chart, steps: chartSteps }) => ({
    id: chart.id,
    name: chart.name,
    flowChartType: chart.flowChartType,
    // Preserve position-based chartSequence from chartSteps while enriching with hazard data
    steps: chartSteps.map((s) => ({
      ...(stepDataById.get(s.id) ?? s),
      chartSequence: (s as any).chartSequence, // position-based (1, 2, 3…)
    })),
  }));

  // Build enriched output list (with hazard analysis + CCP details)
  const enrichedOutputs = allOutputRows.map((out) => ({
    ...out,
    hazards: outputHazardsByOutputId.get(out.id) ?? [],
    ccp: outputCcpByOutputId.get(out.id) ?? null,
  }));
  // Group by step for PDF
  const enrichedOutputsByStepId = new Map<string, typeof enrichedOutputs>();
  for (const out of enrichedOutputs) {
    if (!enrichedOutputsByStepId.has(out.stepId)) enrichedOutputsByStepId.set(out.stepId, []);
    enrichedOutputsByStepId.get(out.stepId)!.push(out);
  }

  // Build enriched input/subgraph list grouped by parent process step
  // Each process step → inputs → subgraph steps with hazard data
  const enrichedInputsByStepId = new Map<string, object[]>();
  for (const inp of allInputRows) {
    if (!enrichedInputsByStepId.has(inp.stepId)) enrichedInputsByStepId.set(inp.stepId, []);
    const subStepsWithHazards = (subgraphByInputId.get(inp.id) ?? []).map((ss: { id: string } & object) => ({
      ...ss,
      hazards: subgraphHazardsByStepId.get((ss as { id: string }).id) ?? [],
    }));
    enrichedInputsByStepId.get(inp.stepId)!.push({ ...inp, subgraphSteps: subStepsWithHazards });
  }

  const forms59Rows = await buildForms59Rows(planId);

  const snapshot = {
    plan,
    forms59Rows,
    // New multi-chart structure — used by PDF for Form 3 and hazard analysis
    flowChartGroups,
    // Flat list kept for backward-compat with older version snapshots
    processSteps: stepsWithPrps,
    ingredients: ingredientsWithHazards,
    // Full hazard data for inputs and outputs (Forms 4B, 4C, 5)
    enrichedInputsByStepId: Object.fromEntries(enrichedInputsByStepId),
    enrichedOutputsByStepId: Object.fromEntries(enrichedOutputsByStepId),
    snapshotAt,
    publishedBy: latestVersion?.publishedBy ?? null,
    changeDescription: latestVersion?.changeDescription ?? null,
    allVersions: allVersions.map((v) => ({
      versionNumber: v.versionNumber,
      publishedAt: v.publishedAt,
      publishedBy: v.publishedBy,
      changeDescription: v.changeDescription,
      changeLog: v.changeLog ? (() => { try { return JSON.parse(v.changeLog); } catch { return []; } })() : [],
    })),
  };

  const pdfElement = React.createElement(PdfHaccpPlan, { snapshot });
  const buffer = await renderToBuffer(pdfElement as Parameters<typeof renderToBuffer>[0]);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="HACCP-Plan-${plan.name.replace(/[^a-zA-Z0-9]/g, "-")}-v${plan.currentVersion}.pdf"`,
    },
  });
}
