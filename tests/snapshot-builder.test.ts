import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import { createTestDb, type TestDB } from "../src/lib/db/test-db";
import { buildCurrentSnapshot } from "../src/lib/queries/build-snapshot";
import {
  haccpPlans,
  processSteps,
  stepHazards,
  hazards,
  controlMeasures,
  ccps,
  criticalLimits,
  stepInputs,
  inputSubgraphSteps,
  ingredients,
  ingredientHazards,
  ingredientControlMeasures,
} from "../src/lib/db/schema";

// ── ID counter ────────────────────────────────────────────────────────────────

let _seq = 0;
const id = () => `test-${++_seq}`;

// ── Fixture helpers ───────────────────────────────────────────────────────────

function insertPlan(db: TestDB, overrides: Partial<{ id: string; name: string; facilityName: string }> = {}) {
  const planId = overrides.id ?? id();
  db.insert(haccpPlans).values({
    id: planId,
    name: overrides.name ?? "Test Plan",
    facilityName: overrides.facilityName ?? "Test Facility",
    status: "draft",
    currentVersion: 0,
  }).run();
  return planId;
}

function insertStep(db: TestDB, planId: string, stepNumber: number, name: string, extra: Record<string, unknown> = {}) {
  const stepId = id();
  db.insert(processSteps).values({
    id: stepId,
    planId,
    stepNumber,
    name,
    category: "processing",
    isCcp: false,
    ccpNumber: null,
    description: null,
    notes: null,
    ...extra,
  }).run();
  return stepId;
}

function insertHazard(db: TestDB, name: string, type = "biological") {
  const hazardId = id();
  db.insert(hazards).values({
    id: hazardId,
    name,
    type,
    severity: "2",
    likelihood: "2",
    isSystemDefault: false,
  }).run();
  return hazardId;
}

function insertStepHazard(db: TestDB, stepId: string, hazardId: string) {
  const shId = id();
  db.insert(stepHazards).values({
    id: shId,
    stepId,
    hazardId,
    isSignificant: false,
    justification: null,
    severityOverride: null,
    likelihoodOverride: null,
    decisionTreeAnswers: null,
  }).run();
  return shId;
}

function insertControlMeasure(db: TestDB, stepHazardId: string, description: string) {
  const cmId = id();
  db.insert(controlMeasures).values({ id: cmId, stepHazardId, description, type: "preventive" }).run();
  return cmId;
}

function insertCcp(db: TestDB, stepId: string) {
  const ccpId = id();
  db.insert(ccps).values({
    id: ccpId,
    stepId,
    hazardDescription: "Pathogen survival",
    controlMeasureDescription: "Thermal processing",
  }).run();
  return ccpId;
}

function insertCriticalLimit(db: TestDB, ccpId: string) {
  const clId = id();
  db.insert(criticalLimits).values({
    id: clId,
    ccpId,
    parameter: "Temperature",
    minimum: "72",
    unit: "°C",
  }).run();
  return clId;
}

function insertInput(db: TestDB, stepId: string, name: string, type = "material") {
  const inputId = id();
  db.insert(stepInputs).values({ id: inputId, stepId, name, type, notes: null }).run();
  return inputId;
}

function insertSubgraphStep(db: TestDB, inputId: string, stepNumber: number, name: string) {
  const ssId = id();
  db.insert(inputSubgraphSteps).values({
    id: ssId,
    inputId,
    name,
    stepNumber,
    category: "receiving",
  }).run();
  return ssId;
}

function insertIngredient(db: TestDB, planId: string, name: string) {
  const ingId = id();
  db.insert(ingredients).values({ id: ingId, planId, name, category: "raw-material", description: null, supplier: null }).run();
  return ingId;
}

function insertIngredientHazard(db: TestDB, ingredientId: string, hazardId: string) {
  const ihId = id();
  db.insert(ingredientHazards).values({
    id: ihId,
    ingredientId,
    hazardId,
    isSignificant: false,
    justification: null,
    severityOverride: null,
    likelihoodOverride: null,
  }).run();
  return ihId;
}

function insertIngredientControlMeasure(db: TestDB, ingredientHazardId: string, description: string) {
  const icmId = id();
  db.insert(ingredientControlMeasures).values({ id: icmId, ingredientHazardId, description, type: "preventive" }).run();
  return icmId;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildCurrentSnapshot", () => {
  let db: TestDB;

  beforeEach(() => {
    db = createTestDb();
  });

  it("returns null for an unknown planId", () => {
    expect(buildCurrentSnapshot(db, "no-such-plan")).toBeNull();
  });

  it("returns plan metadata for a minimal plan with no steps or ingredients", () => {
    const planId = insertPlan(db, { name: "Minimal Plan" });
    const snap = buildCurrentSnapshot(db, planId);
    expect(snap).not.toBeNull();
    expect(snap!.plan.name).toBe("Minimal Plan");
    expect(snap!.processSteps).toHaveLength(0);
    expect(snap!.ingredients).toHaveLength(0);
  });

  it("includes a step with empty hazards, null ccp, and empty inputs", () => {
    const planId = insertPlan(db);
    insertStep(db, planId, 1, "Receiving");
    const snap = buildCurrentSnapshot(db, planId)!;
    expect(snap.processSteps).toHaveLength(1);
    const step = snap.processSteps[0];
    expect(step.name).toBe("Receiving");
    expect(step.hazards).toHaveLength(0);
    expect(step.ccp).toBeNull();
    expect(step.inputs).toHaveLength(0);
  });

  it("nests hazard and control measure correctly under a step", () => {
    const planId = insertPlan(db);
    const stepId = insertStep(db, planId, 1, "Cooking");
    const hazardId = insertHazard(db, "Salmonella");
    const shId = insertStepHazard(db, stepId, hazardId);
    insertControlMeasure(db, shId, "Heat to 72°C");

    const snap = buildCurrentSnapshot(db, planId)!;
    const step = snap.processSteps[0];
    expect(step.hazards).toHaveLength(1);
    expect(step.hazards[0].hazard.name).toBe("Salmonella");
    expect(step.hazards[0].controlMeasures).toHaveLength(1);
    expect(step.hazards[0].controlMeasures[0].description).toBe("Heat to 72°C");
  });

  it("populates ccp sub-records when step is a CCP", () => {
    const planId = insertPlan(db);
    const stepId = insertStep(db, planId, 1, "Pasteurisation", { isCcp: true, ccpNumber: "CCP-1" });
    const ccpId = insertCcp(db, stepId);
    insertCriticalLimit(db, ccpId);

    const snap = buildCurrentSnapshot(db, planId)!;
    const step = snap.processSteps[0];
    expect(step.ccp).not.toBeNull();
    expect(step.ccp!.criticalLimits).toHaveLength(1);
    expect(step.ccp!.monitoringProcedures).toHaveLength(0);
    expect(step.ccp!.correctiveActions).toHaveLength(0);
    expect(step.ccp!.verificationProcedures).toHaveLength(0);
  });

  it("attaches step inputs with their subgraph steps", () => {
    const planId = insertPlan(db);
    const stepId = insertStep(db, planId, 1, "Packaging");
    const inputId = insertInput(db, stepId, "Packaging materials", "material");
    insertSubgraphStep(db, inputId, 1, "Receiving of packaging");
    insertSubgraphStep(db, inputId, 2, "Storage of packaging");

    const snap = buildCurrentSnapshot(db, planId)!;
    const step = snap.processSteps[0];
    expect(step.inputs).toHaveLength(1);
    expect(step.inputs[0].name).toBe("Packaging materials");
    expect(step.inputs[0].subgraphSteps).toHaveLength(2);
    expect(step.inputs[0].subgraphSteps[0].name).toBe("Receiving of packaging");
    expect(step.inputs[0].subgraphSteps[1].name).toBe("Storage of packaging");
  });

  it("orders steps by stepNumber ascending even if inserted in reverse order", () => {
    const planId = insertPlan(db);
    insertStep(db, planId, 3, "Shipping");
    insertStep(db, planId, 1, "Receiving");
    insertStep(db, planId, 2, "Processing");

    const snap = buildCurrentSnapshot(db, planId)!;
    const names = snap.processSteps.map((s) => s.name);
    expect(names).toEqual(["Receiving", "Processing", "Shipping"]);
  });

  it("subgraph steps are ordered by stepNumber ascending", () => {
    const planId = insertPlan(db);
    const stepId = insertStep(db, planId, 1, "Filling");
    const inputId = insertInput(db, stepId, "Water", "water");
    insertSubgraphStep(db, inputId, 2, "Water treatment");
    insertSubgraphStep(db, inputId, 1, "Source intake");

    const snap = buildCurrentSnapshot(db, planId)!;
    const subSteps = snap.processSteps[0].inputs[0].subgraphSteps;
    expect(subSteps[0].name).toBe("Source intake");
    expect(subSteps[1].name).toBe("Water treatment");
  });

  it("includes ingredients with nested hazard and control measure arrays", () => {
    const planId = insertPlan(db);
    const ingId = insertIngredient(db, planId, "Raw carrots");
    const hazardId = insertHazard(db, "E. coli O157:H7");
    const ihId = insertIngredientHazard(db, ingId, hazardId);
    insertIngredientControlMeasure(db, ihId, "Washing with sanitizer");

    const snap = buildCurrentSnapshot(db, planId)!;
    expect(snap.ingredients).toHaveLength(1);
    expect(snap.ingredients[0].name).toBe("Raw carrots");
    expect(snap.ingredients[0].hazards).toHaveLength(1);
    expect(snap.ingredients[0].hazards[0].hazard.name).toBe("E. coli O157:H7");
    expect(snap.ingredients[0].hazards[0].controlMeasures).toHaveLength(1);
    expect(snap.ingredients[0].hazards[0].controlMeasures[0].description).toBe("Washing with sanitizer");
  });

  // ── CCP designation regression tests ──────────────────────────────────────
  // These guard against the bug where a step was visually labelled "CCP" in the
  // decision tree UI but processSteps.isCcp was never written to the DB, so the
  // step never appeared on the CCP Summary page.

  it("step with isCcp=true is reflected in snapshot with ccpNumber", () => {
    const planId = insertPlan(db);
    insertStep(db, planId, 1, "Pasteurisation", { isCcp: true, ccpNumber: "CCP-1" });
    const snap = buildCurrentSnapshot(db, planId)!;
    expect(snap.processSteps[0].isCcp).toBe(true);
    expect(snap.processSteps[0].ccpNumber).toBe("CCP-1");
  });

  it("step with isCcp=false has ccp=null in snapshot", () => {
    const planId = insertPlan(db);
    insertStep(db, planId, 1, "Receiving", { isCcp: false, ccpNumber: null });
    const snap = buildCurrentSnapshot(db, planId)!;
    expect(snap.processSteps[0].isCcp).toBe(false);
    expect(snap.processSteps[0].ccp).toBeNull();
  });

  it("updating a step to isCcp=true is immediately visible in subsequent snapshot", () => {
    const planId = insertPlan(db);
    const stepId = insertStep(db, planId, 1, "Cooking");

    // Simulate what the process-steps PUT route does when the decision tree fires
    db.update(processSteps)
      .set({ isCcp: true, ccpNumber: "CCP-1" })
      .where(eq(processSteps.id, stepId))
      .run();

    const snap = buildCurrentSnapshot(db, planId)!;
    expect(snap.processSteps[0].isCcp).toBe(true);
    expect(snap.processSteps[0].ccpNumber).toBe("CCP-1");
  });

  it("handles a plan with multiple steps, each with their own inputs and hazards", () => {
    const planId = insertPlan(db);
    const s1 = insertStep(db, planId, 1, "Receiving");
    const s2 = insertStep(db, planId, 2, "Processing");

    const h1 = insertHazard(db, "Listeria");
    insertStepHazard(db, s1, h1);

    const i1 = insertInput(db, s2, "Process water", "water");
    insertSubgraphStep(db, i1, 1, "Water source");

    const snap = buildCurrentSnapshot(db, planId)!;
    expect(snap.processSteps).toHaveLength(2);
    expect(snap.processSteps[0].hazards).toHaveLength(1);
    expect(snap.processSteps[0].inputs).toHaveLength(0);
    expect(snap.processSteps[1].hazards).toHaveLength(0);
    expect(snap.processSteps[1].inputs).toHaveLength(1);
    expect(snap.processSteps[1].inputs[0].subgraphSteps).toHaveLength(1);
  });
});
