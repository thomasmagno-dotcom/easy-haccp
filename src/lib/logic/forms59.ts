import { db } from "@/lib/db";
import {
  flowCharts,
  flowChartSteps,
  processSteps,
  stepHazards,
  controlMeasures,
  hazards,
  stepOutputs,
  outputHazards,
  outputControlMeasures,
  stepInputs,
  inputSubgraphSteps,
  inputSubgraphStepHazards,
  inputSubgraphStepControlMeasures,
  hazardPrp,
  prpMaster,
} from "@/lib/db/schema";
import { eq, asc, inArray } from "drizzle-orm";

export interface HazardSummaryRow {
  flowChartName: string;
  stepName: string;
  objectType: "Input" | "Step" | "Output";
  objectName: string;
  hazardType: string;
  hazardDescription: string | null;
  severity: string | null;
  likelihood: string | null;
  riskLevel: string | null;
  severityWithControls: string | null;
  likelihoodWithControls: string | null;
  riskLevelWithControls: string | null;
  isSignificant: boolean;
  ccpDetermination: string; // "CCP" | "Non-CCP" | ""
  ccpNumber: string | null;
  prpReferences: string[];
  controlMeasures: string[];
}

function calcRiskLevel(severity: string | null, likelihood: string | null): string | null {
  const s = parseInt(severity ?? "0", 10);
  const l = parseInt(likelihood ?? "0", 10);
  if (!s || !l) return null;
  const product = s * l;
  if (product >= 8) return "High";
  if (product >= 4) return "Medium";
  return "Low";
}

function ccpDetermFromAnswers(dtJson: string | null): string {
  if (!dtJson) return "";
  try {
    const dt = JSON.parse(dtJson);
    if (!dt.result) return "";
    return dt.result === "ccp" ? "CCP" : "Non-CCP";
  } catch {
    return "";
  }
}

function formatPrp(p: { programName: string; documentReference: string | null }): string {
  return p.documentReference ? `${p.programName} (${p.documentReference})` : p.programName;
}

export async function buildForms59Rows(planId: string): Promise<HazardSummaryRow[]> {
  const allCharts = await db
    .select()
    .from(flowCharts)
    .where(eq(flowCharts.haccpPlanId, planId))
    .orderBy(asc(flowCharts.createdAt))
    .all();

  if (allCharts.length === 0) return [];

  // Steps per chart in sequence order (shared steps appear once per chart)
  const chartStepRows = await Promise.all(
    allCharts.map(async (chart) => {
      const rows = await db
        .select({ step: processSteps, sequence: flowChartSteps.sequence })
        .from(flowChartSteps)
        .innerJoin(processSteps, eq(flowChartSteps.stepId, processSteps.id))
        .where(eq(flowChartSteps.flowChartId, chart.id))
        .orderBy(asc(flowChartSteps.sequence))
        .all();
      return { chart, steps: rows.map((r) => r.step) };
    }),
  );

  // Collect all distinct step IDs for batch queries
  const allStepIds = Array.from(
    new Set(chartStepRows.flatMap((c) => c.steps.map((s) => s.id))),
  );
  if (allStepIds.length === 0) return [];

  // ── Step-level hazards ──────────────────────────────────────────────────────
  const stepHazardRows = await db
    .select({ sh: stepHazards, h: hazards })
    .from(stepHazards)
    .innerJoin(hazards, eq(stepHazards.hazardId, hazards.id))
    .where(inArray(stepHazards.stepId, allStepIds))
    .all();

  const stepHazardsByStepId = new Map<string, Array<typeof stepHazardRows[0]>>();
  for (const row of stepHazardRows) {
    if (!stepHazardsByStepId.has(row.sh.stepId)) stepHazardsByStepId.set(row.sh.stepId, []);
    stepHazardsByStepId.get(row.sh.stepId)!.push(row);
  }

  // ── Outputs and output hazards ──────────────────────────────────────────────
  const allOutputRows = await db
    .select()
    .from(stepOutputs)
    .where(inArray(stepOutputs.stepId, allStepIds))
    .all();

  const allOutputIds = allOutputRows.map((o) => o.id);
  const outputHazardRows = allOutputIds.length > 0
    ? await db
        .select({ oh: outputHazards, h: hazards })
        .from(outputHazards)
        .innerJoin(hazards, eq(outputHazards.hazardId, hazards.id))
        .where(inArray(outputHazards.outputId, allOutputIds))
        .all()
    : [];

  const outputHazardsByOutputId = new Map<string, Array<typeof outputHazardRows[0]>>();
  for (const row of outputHazardRows) {
    if (!outputHazardsByOutputId.has(row.oh.outputId)) outputHazardsByOutputId.set(row.oh.outputId, []);
    outputHazardsByOutputId.get(row.oh.outputId)!.push(row);
  }

  const outputsByStepId = new Map<string, typeof allOutputRows>();
  for (const out of allOutputRows) {
    if (!outputsByStepId.has(out.stepId)) outputsByStepId.set(out.stepId, []);
    outputsByStepId.get(out.stepId)!.push(out);
  }

  // ── Inputs and input subgraph hazards ───────────────────────────────────────
  const allInputRows = await db
    .select()
    .from(stepInputs)
    .where(inArray(stepInputs.stepId, allStepIds))
    .all();

  const allInputIds = allInputRows.map((i) => i.id);
  const allSubgraphRows = allInputIds.length > 0
    ? await db
        .select()
        .from(inputSubgraphSteps)
        .where(inArray(inputSubgraphSteps.inputId, allInputIds))
        .orderBy(asc(inputSubgraphSteps.stepNumber))
        .all()
    : [];

  const allSubgraphIds = allSubgraphRows.map((ss) => ss.id);
  const subgraphHazardRows = allSubgraphIds.length > 0
    ? await db
        .select({ ish: inputSubgraphStepHazards, h: hazards })
        .from(inputSubgraphStepHazards)
        .innerJoin(hazards, eq(inputSubgraphStepHazards.hazardId, hazards.id))
        .where(inArray(inputSubgraphStepHazards.subgraphStepId, allSubgraphIds))
        .all()
    : [];

  const subgraphHazardsBySubgraphId = new Map<string, Array<typeof subgraphHazardRows[0]>>();
  for (const row of subgraphHazardRows) {
    if (!subgraphHazardsBySubgraphId.has(row.ish.subgraphStepId)) subgraphHazardsBySubgraphId.set(row.ish.subgraphStepId, []);
    subgraphHazardsBySubgraphId.get(row.ish.subgraphStepId)!.push(row);
  }

  const subgraphByInputId = new Map<string, typeof allSubgraphRows>();
  for (const ss of allSubgraphRows) {
    if (!subgraphByInputId.has(ss.inputId)) subgraphByInputId.set(ss.inputId, []);
    subgraphByInputId.get(ss.inputId)!.push(ss);
  }

  const inputsByStepId = new Map<string, typeof allInputRows>();
  for (const inp of allInputRows) {
    if (!inputsByStepId.has(inp.stepId)) inputsByStepId.set(inp.stepId, []);
    inputsByStepId.get(inp.stepId)!.push(inp);
  }

  // ── PRP lookups for all hazard IDs ─────────────────────────────────────────
  const allHazardIds = Array.from(new Set([
    ...stepHazardRows.map((r) => r.sh.hazardId),
    ...outputHazardRows.map((r) => r.oh.hazardId),
    ...subgraphHazardRows.map((r) => r.ish.hazardId),
  ]));

  const prpLinks = allHazardIds.length > 0
    ? await db
        .select({ link: hazardPrp, prp: prpMaster })
        .from(hazardPrp)
        .innerJoin(prpMaster, eq(hazardPrp.prpMasterId, prpMaster.id))
        .where(inArray(hazardPrp.hazardId, allHazardIds))
        .all()
    : [];

  const prpsByHazardId = new Map<string, Array<typeof prpLinks[0]["prp"]>>();
  for (const { link, prp } of prpLinks) {
    if (!prpsByHazardId.has(link.hazardId)) prpsByHazardId.set(link.hazardId, []);
    prpsByHazardId.get(link.hazardId)!.push(prp);
  }

  // ── Control measures by step hazard id ─────────────────────────────────────
  const allStepHazardIds = stepHazardRows.map((r) => r.sh.id);
  const cmRowsByShId = new Map<string, string[]>();
  if (allStepHazardIds.length > 0) {
    const cmRows = await db.select().from(controlMeasures).where(inArray(controlMeasures.stepHazardId, allStepHazardIds)).all();
    for (const cm of cmRows) {
      if (!cmRowsByShId.has(cm.stepHazardId)) cmRowsByShId.set(cm.stepHazardId, []);
      cmRowsByShId.get(cm.stepHazardId)!.push(cm.description);
    }
  }

  // ── Control measures by output hazard id ───────────────────────────────────
  const allOutputHazardIds = outputHazardRows.map((r) => r.oh.id);
  const cmRowsByOhId = new Map<string, string[]>();
  if (allOutputHazardIds.length > 0) {
    const cmRows = await db.select().from(outputControlMeasures).where(inArray(outputControlMeasures.outputHazardId, allOutputHazardIds)).all();
    for (const cm of cmRows) {
      if (!cmRowsByOhId.has(cm.outputHazardId)) cmRowsByOhId.set(cm.outputHazardId, []);
      cmRowsByOhId.get(cm.outputHazardId)!.push(cm.description);
    }
  }

  // ── Control measures by subgraph hazard id ─────────────────────────────────
  const allSubgraphHazardIds = subgraphHazardRows.map((r) => r.ish.id);
  const cmRowsBySshId = new Map<string, string[]>();
  if (allSubgraphHazardIds.length > 0) {
    const cmRows = await db.select().from(inputSubgraphStepControlMeasures).where(inArray(inputSubgraphStepControlMeasures.subgraphHazardId, allSubgraphHazardIds)).all();
    for (const cm of cmRows) {
      if (!cmRowsBySshId.has(cm.subgraphHazardId)) cmRowsBySshId.set(cm.subgraphHazardId, []);
      cmRowsBySshId.get(cm.subgraphHazardId)!.push(cm.description);
    }
  }

  // ── Build rows ──────────────────────────────────────────────────────────────
  const rows: HazardSummaryRow[] = [];

  for (const { chart, steps } of chartStepRows) {
    for (const step of steps) {
      // Inputs (subgraph)
      for (const inp of inputsByStepId.get(step.id) ?? []) {
        for (const subStep of subgraphByInputId.get(inp.id) ?? []) {
          for (const { ish, h } of subgraphHazardsBySubgraphId.get(subStep.id) ?? []) {
            const severity = ish.severityOverride ?? h.severity;
            const likelihood = ish.likelihoodOverride ?? h.likelihood;
            const swc = ish.severityWithControls ?? null;
            const lwc = ish.likelihoodWithControls ?? null;
            const prps = (prpsByHazardId.get(ish.hazardId) ?? []).map(formatPrp);
            rows.push({
              flowChartName: chart.name,
              stepName: step.name,
              objectType: "Input",
              objectName: `${inp.name} — ${subStep.name}`,
              hazardType: h.type,
              hazardDescription: h.description ?? h.name,
              severity,
              likelihood,
              riskLevel: calcRiskLevel(severity, likelihood),
              severityWithControls: swc,
              likelihoodWithControls: lwc,
              riskLevelWithControls: calcRiskLevel(swc, lwc),
              isSignificant: ish.isSignificant,
              ccpDetermination: ccpDetermFromAnswers(ish.decisionTreeAnswers),
              ccpNumber: null,
              prpReferences: prps,
              controlMeasures: cmRowsBySshId.get(ish.id) ?? [],
            });
          }
        }
      }

      // Step-level hazards
      for (const { sh, h } of stepHazardsByStepId.get(step.id) ?? []) {
        const severity = sh.severityOverride ?? h.severity;
        const likelihood = sh.likelihoodOverride ?? h.likelihood;
        const swc = sh.severityWithControls ?? null;
        const lwc = sh.likelihoodWithControls ?? null;
        const prps = (prpsByHazardId.get(sh.hazardId) ?? []).map(formatPrp);
        rows.push({
          flowChartName: chart.name,
          stepName: step.name,
          objectType: "Step",
          objectName: step.name,
          hazardType: h.type,
          hazardDescription: h.description ?? h.name,
          severity,
          likelihood,
          riskLevel: calcRiskLevel(severity, likelihood),
          severityWithControls: swc,
          likelihoodWithControls: lwc,
          riskLevelWithControls: calcRiskLevel(swc, lwc),
          isSignificant: sh.isSignificant,
          ccpDetermination: ccpDetermFromAnswers(sh.decisionTreeAnswers),
          ccpNumber: step.ccpNumber ?? null,
          prpReferences: prps,
          controlMeasures: cmRowsByShId.get(sh.id) ?? [],
        });
      }

      // Outputs
      for (const out of outputsByStepId.get(step.id) ?? []) {
        for (const { oh, h } of outputHazardsByOutputId.get(out.id) ?? []) {
          const severity = oh.severityOverride ?? h.severity;
          const likelihood = oh.likelihoodOverride ?? h.likelihood;
          const swc = oh.severityWithControls ?? null;
          const lwc = oh.likelihoodWithControls ?? null;
          const prps = (prpsByHazardId.get(oh.hazardId) ?? []).map(formatPrp);
          rows.push({
            flowChartName: chart.name,
            stepName: step.name,
            objectType: "Output",
            objectName: out.name,
            hazardType: h.type,
            hazardDescription: h.description ?? h.name,
            severity,
            likelihood,
            riskLevel: calcRiskLevel(severity, likelihood),
            severityWithControls: swc,
            likelihoodWithControls: lwc,
            riskLevelWithControls: calcRiskLevel(swc, lwc),
            isSignificant: oh.isSignificant,
            ccpDetermination: ccpDetermFromAnswers(oh.decisionTreeAnswers),
            ccpNumber: out.ccpNumber ?? null,
            prpReferences: prps,
            controlMeasures: cmRowsByOhId.get(oh.id) ?? [],
          });
        }
      }
    }
  }

  return rows;
}
