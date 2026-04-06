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

  const steps = db
    .select()
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .all()
    .filter((s) => s.isCcp);

  const result = steps.map((step) => {
    const ccp = db
      .select()
      .from(ccps)
      .where(eq(ccps.stepId, step.id))
      .get();

    if (!ccp) return { step, ccp: null };

    const limits = db
      .select()
      .from(criticalLimits)
      .where(eq(criticalLimits.ccpId, ccp.id))
      .all();
    const monitoring = db
      .select()
      .from(monitoringProcedures)
      .where(eq(monitoringProcedures.ccpId, ccp.id))
      .all();
    const corrective = db
      .select()
      .from(correctiveActions)
      .where(eq(correctiveActions.ccpId, ccp.id))
      .all();
    const verification = db
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
  });

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
  let ccp = db.select().from(ccps).where(eq(ccps.stepId, stepId)).get();

  if (ccp) {
    // Update existing
    db.update(ccps)
      .set({ hazardDescription, controlMeasureDescription })
      .where(eq(ccps.id, ccp.id))
      .run();

    logAudit({ planId, entityType: "ccp", entityId: ccp.id, action: "update", newValue: { hazardDescription, controlMeasureDescription } });
  } else {
    // Create new
    const ccpId = generateId();
    db.insert(ccps).values({
      id: ccpId,
      stepId,
      hazardDescription,
      controlMeasureDescription,
    }).run();
    ccp = { id: ccpId, stepId, hazardDescription, controlMeasureDescription, createdAt: "", updatedAt: "" };

    logAudit({ planId, entityType: "ccp", entityId: ccpId, action: "create", newValue: ccp });
  }

  // Replace critical limits
  db.delete(criticalLimits).where(eq(criticalLimits.ccpId, ccp.id)).run();
  if (limits && Array.isArray(limits)) {
    for (const lim of limits) {
      const limId = generateId();
      db.insert(criticalLimits).values({
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
  db.delete(monitoringProcedures).where(eq(monitoringProcedures.ccpId, ccp.id)).run();
  if (monitoring && Array.isArray(monitoring)) {
    for (const mon of monitoring) {
      db.insert(monitoringProcedures).values({
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
  db.delete(correctiveActions).where(eq(correctiveActions.ccpId, ccp.id)).run();
  if (corrective && Array.isArray(corrective)) {
    for (const ca of corrective) {
      db.insert(correctiveActions).values({
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
  db.delete(verificationProcedures).where(eq(verificationProcedures.ccpId, ccp.id)).run();
  if (verification && Array.isArray(verification)) {
    for (const vp of verification) {
      db.insert(verificationProcedures).values({
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
