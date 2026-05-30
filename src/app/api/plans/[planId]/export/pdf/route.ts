import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { db } from "@/lib/db";
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
  stepOutputs,
  outputHazards,
  hazardPrp,
  prpMaster,
  planVersions,
} from "@/lib/db/schema";
import { eq, asc, desc, inArray } from "drizzle-orm";
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

  const steps = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .orderBy(asc(processSteps.stepNumber))
    .all();

  const stepIds = steps.map((s) => s.id);

  // ── Step inputs ────────────────────────────────────────────────────────────
  const allInputRows = stepIds.length > 0
    ? await db.select().from(stepInputs).where(inArray(stepInputs.stepId, stepIds)).all()
    : [];
  const inputsByStep = new Map<string, typeof allInputRows>();
  for (const inp of allInputRows) {
    if (!inputsByStep.has(inp.stepId)) inputsByStep.set(inp.stepId, []);
    inputsByStep.get(inp.stepId)!.push(inp);
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

  const outputsByStep = new Map<string, Array<typeof allOutputRows[0] & { hazardTypes: string[] }>>();
  for (const out of allOutputRows) {
    if (!outputsByStep.has(out.stepId)) outputsByStep.set(out.stepId, []);
    outputsByStep.get(out.stepId)!.push({
      ...out,
      hazardTypes: hazardTypesByOutputId.get(out.id) || [],
    });
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

  const snapshot = {
    plan,
    processSteps: stepsWithPrps,
    ingredients: ingredientsWithHazards,
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
