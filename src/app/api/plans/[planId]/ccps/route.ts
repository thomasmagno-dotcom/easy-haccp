import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ccps,
  criticalLimits,
  monitoringProcedures,
  correctiveActions,
  verificationProcedures,
  processSteps,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

// GET all CCPs for a plan
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;

  const allSteps = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .all();
  const steps = allSteps.filter((s) => s.isCcp);

  const result = await Promise.all(steps.map(async (step) => {
    const ccp = await db
      .select()
      .from(ccps)
      .where(eq(ccps.stepId, step.id))
      .get();

    if (!ccp) return { step, ccp: null };

    const limits = await db
      .select()
      .from(criticalLimits)
      .where(eq(criticalLimits.ccpId, ccp.id))
      .all();
    const monitoring = await db
      .select()
      .from(monitoringProcedures)
      .where(eq(monitoringProcedures.ccpId, ccp.id))
      .all();
    const corrective = await db
      .select()
      .from(correctiveActions)
      .where(eq(correctiveActions.ccpId, ccp.id))
      .all();
    const verification = await db
      .select()
      .from(verificationProcedures)
      .where(eq(verificationProcedures.ccpId, ccp.id))
      .all();

    return {
      step,
      ccp: {
        ...ccp,
        criticalLimits: limits,
        monitoringProcedures: monitoring,
        correctiveActions: corrective,
        verificationProcedures: verification,
      },
    };
  }));

  return NextResponse.json(result);
}

// POST: Create or update a full CCP with all sub-records
export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { stepId, hazardDescription, controlMeasureDescription, limits, monitoring, corrective, verification } = body;

  // Check if CCP already exists for this step
  let ccp = await db.select().from(ccps).where(eq(ccps.stepId, stepId)).get();

  if (ccp) {
    // Update existing
    await db.update(ccps)
      .set({ hazardDescription, controlMeasureDescription })
      .where(eq(ccps.id, ccp.id))
      .run();

    await logAudit({ planId, entityType: "ccp", entityId: ccp.id, action: "update", newValue: { hazardDescription, controlMeasureDescription } });
  } else {
    // Create new
    const ccpId = generateId();
    await db.insert(ccps).values({
      id: ccpId,
      stepId,
      hazardDescription,
      controlMeasureDescription,
    }).run();
    ccp = { id: ccpId, stepId, hazardDescription, controlMeasureDescription, createdAt: "", updatedAt: "" };

    await logAudit({ planId, entityType: "ccp", entityId: ccpId, action: "create", newValue: ccp });
  }

  // Replace critical limits
  await db.delete(criticalLimits).where(eq(criticalLimits.ccpId, ccp.id)).run();
  if (limits && Array.isArray(limits)) {
    for (const lim of limits) {
      const limId = generateId();
      await db.insert(criticalLimits).values({
        id: limId,
        ccpId: ccp.id,
        parameter: lim.parameter,
        minimum: lim.minimum || null,
        maximum: lim.maximum || null,
        target: lim.target || null,
        unit: lim.unit || null,
        scientificBasis: lim.scientificBasis || null,
      }).run();
    }
  }

  // Replace monitoring procedures
  await db.delete(monitoringProcedures).where(eq(monitoringProcedures.ccpId, ccp.id)).run();
  if (monitoring && Array.isArray(monitoring)) {
    for (const mon of monitoring) {
      await db.insert(monitoringProcedures).values({
        id: generateId(),
        ccpId: ccp.id,
        what: mon.what,
        how: mon.how,
        frequency: mon.frequency,
        who: mon.who,
        recordForm: mon.recordForm || null,
      }).run();
    }
  }

  // Replace corrective actions
  await db.delete(correctiveActions).where(eq(correctiveActions.ccpId, ccp.id)).run();
  if (corrective && Array.isArray(corrective)) {
    for (const ca of corrective) {
      await db.insert(correctiveActions).values({
        id: generateId(),
        ccpId: ccp.id,
        deviation: ca.deviation,
        immediateAction: ca.immediateAction,
        productDisposition: ca.productDisposition,
        rootCauseAnalysis: ca.rootCauseAnalysis || null,
        preventiveAction: ca.preventiveAction || null,
        responsiblePerson: ca.responsiblePerson,
        recordForm: ca.recordForm || null,
      }).run();
    }
  }

  // Replace verification procedures
  await db.delete(verificationProcedures).where(eq(verificationProcedures.ccpId, ccp.id)).run();
  if (verification && Array.isArray(verification)) {
    for (const vp of verification) {
      await db.insert(verificationProcedures).values({
        id: generateId(),
        ccpId: ccp.id,
        activity: vp.activity,
        frequency: vp.frequency,
        responsiblePerson: vp.responsiblePerson,
        method: vp.method || null,
        recordReference: vp.recordReference || null,
      }).run();
    }
  }

  return NextResponse.json({ id: ccp.id, success: true });
}
