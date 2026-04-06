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
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
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

  const snapshot = {
    plan,
    processSteps: stepsWithData,
    snapshotAt: new Date().toISOString(),
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
