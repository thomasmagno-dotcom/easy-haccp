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
  planVersions,
} from "@/lib/db/schema";
import { eq, asc, desc, inArray } from "drizzle-orm";
import { PdfHaccpPlan } from "@/components/pdf/PdfHaccpPlan";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;

  const plan = db
    .select()
    .from(haccpPlans)
    .where(eq(haccpPlans.id, planId))
    .get();

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const steps = db
    .select()
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .orderBy(asc(processSteps.stepNumber))
    .all();

  const stepsWithData = steps.map((step) => {
    const shList = db
      .select({ stepHazard: stepHazards, hazard: hazards })
      .from(stepHazards)
      .innerJoin(hazards, eq(stepHazards.hazardId, hazards.id))
      .where(eq(stepHazards.stepId, step.id))
      .all();

    const hazardData = shList.map((sh) => {
      const measures = db
        .select()
        .from(controlMeasures)
        .where(eq(controlMeasures.stepHazardId, sh.stepHazard.id))
        .all();
      return { ...sh.stepHazard, hazard: sh.hazard, controlMeasures: measures };
    });

    let ccpData = null;
    if (step.isCcp) {
      const ccp = db.select().from(ccps).where(eq(ccps.stepId, step.id)).get();
      if (ccp) {
        ccpData = {
          ...ccp,
          criticalLimits: db.select().from(criticalLimits).where(eq(criticalLimits.ccpId, ccp.id)).all(),
          monitoringProcedures: db.select().from(monitoringProcedures).where(eq(monitoringProcedures.ccpId, ccp.id)).all(),
          correctiveActions: db.select().from(correctiveActions).where(eq(correctiveActions.ccpId, ccp.id)).all(),
          verificationProcedures: db.select().from(verificationProcedures).where(eq(verificationProcedures.ccpId, ccp.id)).all(),
        };
      }
    }

    return { ...step, hazards: hazardData, ccp: ccpData };
  });

  // Attach step inputs
  const allInputRows = steps.length > 0
    ? db.select().from(stepInputs).where(inArray(stepInputs.stepId, steps.map((s) => s.id))).all()
    : [];
  const inputsByStepId = new Map<string, typeof allInputRows>();
  for (const inp of allInputRows) {
    if (!inputsByStepId.has(inp.stepId)) inputsByStepId.set(inp.stepId, []);
    inputsByStepId.get(inp.stepId)!.push(inp);
  }
  const stepsWithInputs = stepsWithData.map((step) => ({
    ...step,
    inputs: inputsByStepId.get(step.id) || [],
  }));

  const ingredientRows = db
    .select()
    .from(ingredients)
    .where(eq(ingredients.planId, planId))
    .orderBy(asc(ingredients.createdAt))
    .all();

  const ingredientsWithHazards = ingredientRows.map((ing) => {
    const ihList = db
      .select({ ih: ingredientHazards, hazard: hazards })
      .from(ingredientHazards)
      .innerJoin(hazards, eq(ingredientHazards.hazardId, hazards.id))
      .where(eq(ingredientHazards.ingredientId, ing.id))
      .all();
    return {
      ...ing,
      hazards: ihList.map((r) => {
        const cms = db
          .select()
          .from(ingredientControlMeasures)
          .where(eq(ingredientControlMeasures.ingredientHazardId, r.ih.id))
          .all();
        return { ...r.ih, hazard: r.hazard, controlMeasures: cms };
      }),
    };
  });

  // Pull all published versions for the full amendment logbook
  const allVersions = db
    .select()
    .from(planVersions)
    .where(eq(planVersions.planId, planId))
    .orderBy(desc(planVersions.versionNumber))
    .all();

  const latestVersion = allVersions[0] ?? null;
  const snapshotAt = new Date().toISOString();

  const snapshot = {
    plan,
    processSteps: stepsWithInputs,
    ingredients: ingredientsWithHazards,
    snapshotAt,
    publishedBy: latestVersion?.publishedBy ?? null,
    changeDescription: latestVersion?.changeDescription ?? null,
    // Full version history for Document Control page
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
