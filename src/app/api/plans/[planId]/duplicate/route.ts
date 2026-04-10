import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  haccpPlans,
  processSteps,
  stepHazards,
  controlMeasures,
  ccps,
  criticalLimits,
  monitoringProcedures,
  correctiveActions,
  verificationProcedures,
  stepInputs,
  ingredients,
  ingredientHazards,
  ingredientControlMeasures,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;

  // ── Fetch the source plan ────────────────────────────────────
  const sourcePlan = await db.select().from(haccpPlans).where(eq(haccpPlans.id, planId)).get();
  if (!sourcePlan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const newPlanId = generateId();
  const newPlanName = `Copy of ${sourcePlan.name}`;

  // ── Duplicate the plan header ────────────────────────────────
  await db.insert(haccpPlans).values({
    id: newPlanId,
    name: newPlanName,
    facilityName: sourcePlan.facilityName,
    facilityAddress: sourcePlan.facilityAddress ?? null,
    productDescription: sourcePlan.productDescription ?? null,
    teamMembers: sourcePlan.teamMembers ?? null,
    scope: sourcePlan.scope ?? null,
    status: "draft",
    currentVersion: 0,
  }).run();

  await logAudit({
    planId: newPlanId,
    entityType: "plan",
    entityId: newPlanId,
    action: "create",
    newValue: { action: "duplicate", sourceId: planId },
  });

  // ── Fetch & duplicate process steps ─────────────────────────
  const sourceSteps = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .orderBy(asc(processSteps.stepNumber))
    .all();

  for (const step of sourceSteps) {
    const newStepId = generateId();

    await db.insert(processSteps).values({
      id: newStepId,
      planId: newPlanId,
      stepNumber: step.stepNumber,
      name: step.name,
      description: step.description ?? null,
      category: step.category ?? null,
      isCcp: step.isCcp,
      ccpNumber: step.ccpNumber ?? null,
      notes: step.notes ?? null,
    }).run();

    // ── Step hazards ──────────────────────────────────────────
    const sourceStepHazards = await db
      .select()
      .from(stepHazards)
      .where(eq(stepHazards.stepId, step.id))
      .all();

    for (const sh of sourceStepHazards) {
      const newShId = generateId();

      await db.insert(stepHazards).values({
        id: newShId,
        stepId: newStepId,
        hazardId: sh.hazardId,
        isSignificant: sh.isSignificant,
        justification: sh.justification ?? null,
        severityOverride: sh.severityOverride ?? null,
        likelihoodOverride: sh.likelihoodOverride ?? null,
        decisionTreeAnswers: sh.decisionTreeAnswers ?? null,
      }).run();

      // Control measures per step-hazard
      const sourceCms = await db
        .select()
        .from(controlMeasures)
        .where(eq(controlMeasures.stepHazardId, sh.id))
        .all();

      for (const cm of sourceCms) {
        await db.insert(controlMeasures).values({
          id: generateId(),
          stepHazardId: newShId,
          description: cm.description,
          type: cm.type ?? null,
        }).run();
      }
    }

    // ── CCP details ───────────────────────────────────────────
    if (step.isCcp) {
      const sourceCcp = await db.select().from(ccps).where(eq(ccps.stepId, step.id)).get();
      if (sourceCcp) {
        const newCcpId = generateId();

        await db.insert(ccps).values({
          id: newCcpId,
          stepId: newStepId,
          hazardDescription: sourceCcp.hazardDescription,
          controlMeasureDescription: sourceCcp.controlMeasureDescription,
        }).run();

        // Critical limits
        const sourceLimits = await db.select().from(criticalLimits).where(eq(criticalLimits.ccpId, sourceCcp.id)).all();
        for (const lim of sourceLimits) {
          await db.insert(criticalLimits).values({
            id: generateId(),
            ccpId: newCcpId,
            parameter: lim.parameter,
            minimum: lim.minimum ?? null,
            maximum: lim.maximum ?? null,
            target: lim.target ?? null,
            unit: lim.unit ?? null,
            scientificBasis: lim.scientificBasis ?? null,
          }).run();
        }

        // Monitoring procedures
        const sourceMons = await db.select().from(monitoringProcedures).where(eq(monitoringProcedures.ccpId, sourceCcp.id)).all();
        for (const mon of sourceMons) {
          await db.insert(monitoringProcedures).values({
            id: generateId(),
            ccpId: newCcpId,
            what: mon.what,
            how: mon.how,
            frequency: mon.frequency,
            who: mon.who,
            recordForm: mon.recordForm ?? null,
          }).run();
        }

        // Corrective actions
        const sourceCas = await db.select().from(correctiveActions).where(eq(correctiveActions.ccpId, sourceCcp.id)).all();
        for (const ca of sourceCas) {
          await db.insert(correctiveActions).values({
            id: generateId(),
            ccpId: newCcpId,
            deviation: ca.deviation,
            immediateAction: ca.immediateAction,
            productDisposition: ca.productDisposition,
            rootCauseAnalysis: ca.rootCauseAnalysis ?? null,
            preventiveAction: ca.preventiveAction ?? null,
            responsiblePerson: ca.responsiblePerson,
            recordForm: ca.recordForm ?? null,
          }).run();
        }

        // Verification procedures
        const sourceVers = await db.select().from(verificationProcedures).where(eq(verificationProcedures.ccpId, sourceCcp.id)).all();
        for (const ver of sourceVers) {
          await db.insert(verificationProcedures).values({
            id: generateId(),
            ccpId: newCcpId,
            activity: ver.activity,
            frequency: ver.frequency,
            responsiblePerson: ver.responsiblePerson,
            method: ver.method ?? null,
            recordReference: ver.recordReference ?? null,
          }).run();
        }
      }
    }

    // ── Step inputs ───────────────────────────────────────────
    const sourceInputs = await db.select().from(stepInputs).where(eq(stepInputs.stepId, step.id)).all();
    for (const inp of sourceInputs) {
      await db.insert(stepInputs).values({
        id: generateId(),
        stepId: newStepId,
        name: inp.name,
        type: inp.type ?? null,
        notes: inp.notes ?? null,
      }).run();
    }
  }

  // ── Fetch & duplicate ingredients ───────────────────────────
  const sourceIngredients = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.planId, planId))
    .orderBy(asc(ingredients.createdAt))
    .all();

  for (const ing of sourceIngredients) {
    const newIngId = generateId();

    await db.insert(ingredients).values({
      id: newIngId,
      planId: newPlanId,
      name: ing.name,
      category: ing.category ?? null,
      description: ing.description ?? null,
      supplier: ing.supplier ?? null,
    }).run();

    const sourceIngHazards = await db
      .select()
      .from(ingredientHazards)
      .where(eq(ingredientHazards.ingredientId, ing.id))
      .all();

    for (const ih of sourceIngHazards) {
      const newIhId = generateId();

      await db.insert(ingredientHazards).values({
        id: newIhId,
        ingredientId: newIngId,
        hazardId: ih.hazardId,
        isSignificant: ih.isSignificant,
        justification: ih.justification ?? null,
        severityOverride: ih.severityOverride ?? null,
        likelihoodOverride: ih.likelihoodOverride ?? null,
      }).run();

      const sourceIngCms = await db
        .select()
        .from(ingredientControlMeasures)
        .where(eq(ingredientControlMeasures.ingredientHazardId, ih.id))
        .all();

      for (const cm of sourceIngCms) {
        await db.insert(ingredientControlMeasures).values({
          id: generateId(),
          ingredientHazardId: newIhId,
          description: cm.description,
          type: cm.type ?? null,
        }).run();
      }
    }
  }

  return NextResponse.json(
    {
      id: newPlanId,
      name: newPlanName,
      facilityName: sourcePlan.facilityName,
      status: "draft",
      currentVersion: 0,
    },
    { status: 201 },
  );
}
