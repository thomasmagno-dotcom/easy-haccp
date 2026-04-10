/**
 * Builds a complete, current snapshot of a HACCP plan from the database.
 *
 * This function is extracted from the two version routes that previously
 * duplicated this ~80-line block inline. It accepts `db` as a parameter
 * so it can be called with either the production DB or an in-memory test DB.
 */

// We accept any Drizzle libsql DB instance via a structural type rather than
// the concrete DB import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

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
  stepInputs,
  inputSubgraphSteps,
  ingredients,
  ingredientHazards,
  ingredientControlMeasures,
} from "@/lib/db/schema";
import { eq, asc, inArray } from "drizzle-orm";

// ── Exported types ────────────────────────────────────────────────────────────

export type HaccpPlan = typeof haccpPlans.$inferSelect;

export type ControlMeasureRow = typeof controlMeasures.$inferSelect;
export type HazardRow = typeof hazards.$inferSelect;
export type StepHazardRow = typeof stepHazards.$inferSelect;
export type StepInputRow = typeof stepInputs.$inferSelect;
export type SubgraphStepRow = typeof inputSubgraphSteps.$inferSelect;

export type StepInputWithSubgraph = StepInputRow & {
  subgraphSteps: SubgraphStepRow[];
};

export type StepHazardWithDetails = StepHazardRow & {
  hazard: HazardRow;
  controlMeasures: ControlMeasureRow[];
};

export type CcpRow = typeof ccps.$inferSelect;
export type CcpWithDetails = CcpRow & {
  criticalLimits: (typeof criticalLimits.$inferSelect)[];
  monitoringProcedures: (typeof monitoringProcedures.$inferSelect)[];
  correctiveActions: (typeof correctiveActions.$inferSelect)[];
  verificationProcedures: (typeof verificationProcedures.$inferSelect)[];
};

export type StepWithData = typeof processSteps.$inferSelect & {
  hazards: StepHazardWithDetails[];
  ccp: CcpWithDetails | null;
  inputs: StepInputWithSubgraph[];
};

export type IngredientRow = typeof ingredients.$inferSelect;
export type IngredientHazardRow = typeof ingredientHazards.$inferSelect;
export type IngredientControlMeasureRow = typeof ingredientControlMeasures.$inferSelect;

export type IngredientHazardWithDetails = IngredientHazardRow & {
  hazard: HazardRow;
  controlMeasures: IngredientControlMeasureRow[];
};

export type IngredientWithHazards = IngredientRow & {
  hazards: IngredientHazardWithDetails[];
};

export interface PlanSnapshot {
  plan: HaccpPlan;
  processSteps: StepWithData[];
  ingredients: IngredientWithHazards[];
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Returns the full current state of a plan as a nested snapshot object,
 * or null if the plan does not exist.
 */
export async function buildCurrentSnapshot(db: AnyDb, planId: string): Promise<PlanSnapshot | null> {
  // 1. Plan record
  const plan = await db
    .select()
    .from(haccpPlans)
    .where(eq(haccpPlans.id, planId))
    .get();

  if (!plan) return null;

  // 2. Process steps (ordered)
  const steps = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .orderBy(asc(processSteps.stepNumber))
    .all();

  // 3. Per-step: hazards + CCP details
  type StepRow = typeof steps[0];
  const stepsWithData = await Promise.all(steps.map(async (step: StepRow) => {
    // Step hazards joined to hazard reference
    const shList = await db
      .select({ stepHazard: stepHazards, hazard: hazards })
      .from(stepHazards)
      .innerJoin(hazards, eq(stepHazards.hazardId, hazards.id))
      .where(eq(stepHazards.stepId, step.id))
      .all();

    type ShRow = { stepHazard: StepHazardRow; hazard: HazardRow };
    const hazardData: StepHazardWithDetails[] = await Promise.all(shList.map(async (sh: ShRow) => {
      const measures = await db
        .select()
        .from(controlMeasures)
        .where(eq(controlMeasures.stepHazardId, sh.stepHazard.id))
        .all();
      return { ...sh.stepHazard, hazard: sh.hazard, controlMeasures: measures };
    }));

    // CCP sub-records (only if step is a CCP)
    let ccpData: CcpWithDetails | null = null;
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

    return { ...step, hazards: hazardData, ccp: ccpData };
  }));

  // 4. Step inputs (bulk fetch, grouped by stepId)
  const allInputRows: StepInputRow[] = steps.length > 0
    ? await db.select().from(stepInputs).where(inArray(stepInputs.stepId, steps.map((s: StepRow) => s.id))).all()
    : [];

  // 5. Input subgraph steps (bulk fetch, grouped by inputId)
  const allSubgraphRows: SubgraphStepRow[] = allInputRows.length > 0
    ? await db
        .select()
        .from(inputSubgraphSteps)
        .where(inArray(inputSubgraphSteps.inputId, allInputRows.map((i) => i.id)))
        .orderBy(asc(inputSubgraphSteps.stepNumber))
        .all()
    : [];

  const subgraphByInputId = new Map<string, SubgraphStepRow[]>();
  for (const ss of allSubgraphRows) {
    if (!subgraphByInputId.has(ss.inputId)) subgraphByInputId.set(ss.inputId, []);
    subgraphByInputId.get(ss.inputId)!.push(ss);
  }

  const inputsByStepId = new Map<string, StepInputWithSubgraph[]>();
  for (const inp of allInputRows) {
    if (!inputsByStepId.has(inp.stepId)) inputsByStepId.set(inp.stepId, []);
    inputsByStepId.get(inp.stepId)!.push({
      ...inp,
      subgraphSteps: subgraphByInputId.get(inp.id) ?? [],
    });
  }

  type StepWithHazards = (typeof stepsWithData)[0];
  const stepsWithInputs: StepWithData[] = stepsWithData.map((step: StepWithHazards) => ({
    ...step,
    inputs: inputsByStepId.get(step.id) ?? [],
  }));

  // 6. Ingredients with hazard assignments
  const ingredientRows = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.planId, planId))
    .orderBy(asc(ingredients.createdAt))
    .all();

  type IngRow = typeof ingredientRows[0];
  const ingredientsWithHazards: IngredientWithHazards[] = await Promise.all(ingredientRows.map(async (ing: IngRow) => {
    const ihList = await db
      .select({ ih: ingredientHazards, hazard: hazards })
      .from(ingredientHazards)
      .innerJoin(hazards, eq(ingredientHazards.hazardId, hazards.id))
      .where(eq(ingredientHazards.ingredientId, ing.id))
      .all();

    type IhRow = { ih: IngredientHazardRow; hazard: HazardRow };
    return {
      ...ing,
      hazards: await Promise.all(ihList.map(async (r: IhRow) => {
        const cms = await db
          .select()
          .from(ingredientControlMeasures)
          .where(eq(ingredientControlMeasures.ingredientHazardId, r.ih.id))
          .all();
        return { ...r.ih, hazard: r.hazard, controlMeasures: cms };
      })),
    };
  }));

  return {
    plan,
    processSteps: stepsWithInputs,
    ingredients: ingredientsWithHazards,
  };
}
