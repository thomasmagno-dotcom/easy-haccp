import { describe, it, expect } from "bun:test";
import { diffSnapshots, type ChangeEntry } from "../src/lib/diff-snapshots";

// ── Snapshot builder helpers ──────────────────────────────────────────────────

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    name: "Test Plan",
    facilityName: "Test Facility",
    facilityAddress: "123 Main St",
    scope: "Fresh vegetables",
    productDescription: "{}",
    teamMembers: "[]",
    ...overrides,
  };
}

function makeSnapshot(planOverrides = {}, steps: unknown[] = [], ingredients: unknown[] = []) {
  return {
    plan: makePlan(planOverrides),
    processSteps: steps,
    ingredients,
  };
}

function makeStep(id: string, stepNumber: number, name: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    stepNumber,
    name,
    description: null,
    isCcp: false,
    ccpNumber: null,
    hazards: [],
    ccp: null,
    inputs: [],
    ...extra,
  };
}

function makeIngredient(id: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name,
    category: null,
    supplier: null,
    hazards: [],
    ...extra,
  };
}

function makeHazard(hazardId: string, name: string, type = "biological", extra: Record<string, unknown> = {}) {
  return {
    hazardId,
    isSignificant: false,
    severityOverride: null,
    likelihoodOverride: null,
    hazard: { id: hazardId, name, type },
    controlMeasures: [],
    ...extra,
  };
}

// ── Helper to check if changes contain an entry matching criteria ─────────────

function hasEntry(changes: ChangeEntry[], section: ChangeEntry["section"], textFragment: string) {
  return changes.some((c) => c.section === section && c.text.includes(textFragment));
}

// ─────────────────────────────────────────────────────────────────────────────

describe("diffSnapshots — null previous", () => {
  it("returns a single 'Initial version' entry when previous is null", () => {
    const changes = diffSnapshots(null, makeSnapshot());
    expect(changes).toHaveLength(1);
    expect(changes[0].section).toBe("plan");
    expect(changes[0].text).toContain("Initial version");
  });
});

describe("diffSnapshots — identical snapshots", () => {
  it("returns an empty array when nothing changed", () => {
    const snap = makeSnapshot();
    expect(diffSnapshots(snap, snap)).toEqual([]);
  });
});

describe("diffSnapshots — plan metadata changes", () => {
  it("detects plan name change", () => {
    const prev = makeSnapshot({ name: "Old Name" });
    const curr = makeSnapshot({ name: "New Name" });
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "plan", "Plan name changed")).toBe(true);
    expect(hasEntry(changes, "plan", "Old Name")).toBe(true);
    expect(hasEntry(changes, "plan", "New Name")).toBe(true);
  });

  it("detects facility name change", () => {
    const prev = makeSnapshot({ facilityName: "Old Facility" });
    const curr = makeSnapshot({ facilityName: "New Facility" });
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "plan", "Facility name changed")).toBe(true);
  });

  it("detects facility address change", () => {
    const prev = makeSnapshot({ facilityAddress: "Old Address" });
    const curr = makeSnapshot({ facilityAddress: "New Address" });
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "plan", "Facility address updated")).toBe(true);
  });

  it("detects scope change", () => {
    const prev = makeSnapshot({ scope: "Old scope" });
    const curr = makeSnapshot({ scope: "New scope" });
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "plan", "Plan scope updated")).toBe(true);
  });

  it("detects productDescription field change", () => {
    const prev = makeSnapshot({ productDescription: JSON.stringify({ name: "Old product" }) });
    const curr = makeSnapshot({ productDescription: JSON.stringify({ name: "New product" }) });
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "plan", "Product description updated")).toBe(true);
    expect(hasEntry(changes, "plan", "Product name")).toBe(true);
  });

  it("does not emit entries when plan metadata is unchanged", () => {
    const snap = makeSnapshot({ name: "Same", facilityName: "Same Facility" });
    const changes = diffSnapshots(snap, snap);
    expect(changes.filter((c) => c.section === "plan")).toHaveLength(0);
  });
});

describe("diffSnapshots — team members", () => {
  it("detects a new team member being added", () => {
    const prev = makeSnapshot({ teamMembers: JSON.stringify([{ name: "Alice", role: "QA Manager" }]) });
    const curr = makeSnapshot({ teamMembers: JSON.stringify([{ name: "Alice", role: "QA Manager" }, { name: "Bob", role: "Production" }]) });
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "team", "Team member added")).toBe(true);
    expect(hasEntry(changes, "team", "Bob")).toBe(true);
  });

  it("detects a team member being removed", () => {
    const prev = makeSnapshot({ teamMembers: JSON.stringify([{ name: "Alice" }, { name: "Bob" }]) });
    const curr = makeSnapshot({ teamMembers: JSON.stringify([{ name: "Alice" }]) });
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "team", "Team member removed")).toBe(true);
    expect(hasEntry(changes, "team", "Bob")).toBe(true);
  });

  it("detects a role change on an existing member", () => {
    const prev = makeSnapshot({ teamMembers: JSON.stringify([{ name: "Alice", role: "QA" }]) });
    const curr = makeSnapshot({ teamMembers: JSON.stringify([{ name: "Alice", role: "HACCP Coordinator" }]) });
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "team", "Team member updated")).toBe(true);
    expect(hasEntry(changes, "team", "Alice")).toBe(true);
  });
});

describe("diffSnapshots — process steps", () => {
  it("detects a new step being added", () => {
    const prev = makeSnapshot({}, [makeStep("s1", 1, "Receiving")]);
    const curr = makeSnapshot({}, [makeStep("s1", 1, "Receiving"), makeStep("s2", 2, "Washing")]);
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "steps", "Process step added")).toBe(true);
    expect(hasEntry(changes, "steps", "Washing")).toBe(true);
  });

  it("detects a step being removed", () => {
    const prev = makeSnapshot({}, [makeStep("s1", 1, "Receiving"), makeStep("s2", 2, "Washing")]);
    const curr = makeSnapshot({}, [makeStep("s1", 1, "Receiving")]);
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "steps", "Process step removed")).toBe(true);
    expect(hasEntry(changes, "steps", "Washing")).toBe(true);
  });

  it("detects a step being renamed", () => {
    const prev = makeSnapshot({}, [makeStep("s1", 1, "Old Step Name")]);
    const curr = makeSnapshot({}, [makeStep("s1", 1, "New Step Name")]);
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "steps", "renamed")).toBe(true);
  });

  it("detects a step being reordered", () => {
    const prev = makeSnapshot({}, [makeStep("s1", 1, "A"), makeStep("s2", 2, "B")]);
    const curr = makeSnapshot({}, [makeStep("s1", 2, "A"), makeStep("s2", 1, "B")]);
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "steps", "reordered")).toBe(true);
  });

  it("detects CCP designation being added", () => {
    const prev = makeSnapshot({}, [makeStep("s1", 1, "Cooking", { isCcp: false })]);
    const curr = makeSnapshot({}, [makeStep("s1", 1, "Cooking", { isCcp: true, ccpNumber: "CCP-1" })]);
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "steps", "designated as")).toBe(true);
    expect(hasEntry(changes, "steps", "CCP-1")).toBe(true);
  });

  it("detects CCP designation being removed", () => {
    const prev = makeSnapshot({}, [makeStep("s1", 1, "Cooking", { isCcp: true, ccpNumber: "CCP-1" })]);
    const curr = makeSnapshot({}, [makeStep("s1", 1, "Cooking", { isCcp: false })]);
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "steps", "CCP designation")).toBe(true);
    expect(hasEntry(changes, "steps", "removed")).toBe(true);
  });

  it("detects a hazard being added to a step", () => {
    const prev = makeSnapshot({}, [makeStep("s1", 1, "Receiving", { hazards: [] })]);
    const curr = makeSnapshot({}, [makeStep("s1", 1, "Receiving", { hazards: [makeHazard("h1", "Salmonella")] })]);
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "steps", "hazard added")).toBe(true);
    expect(hasEntry(changes, "steps", "Salmonella")).toBe(true);
  });

  it("detects a hazard being removed from a step", () => {
    const prev = makeSnapshot({}, [makeStep("s1", 1, "Receiving", { hazards: [makeHazard("h1", "Salmonella")] })]);
    const curr = makeSnapshot({}, [makeStep("s1", 1, "Receiving", { hazards: [] })]);
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "steps", "hazard removed")).toBe(true);
  });

  it("detects a control measure being added", () => {
    const h = makeHazard("h1", "Salmonella", "biological", { controlMeasures: [] });
    const hWithCm = makeHazard("h1", "Salmonella", "biological", {
      controlMeasures: [{ id: "cm1", description: "Temperature control" }],
    });
    const prev = makeSnapshot({}, [makeStep("s1", 1, "Cooking", { hazards: [h] })]);
    const curr = makeSnapshot({}, [makeStep("s1", 1, "Cooking", { hazards: [hWithCm] })]);
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "steps", "control measure")).toBe(true);
    expect(hasEntry(changes, "steps", "added")).toBe(true);
  });

  it("detects a step input being added", () => {
    const prev = makeSnapshot({}, [makeStep("s1", 1, "Packaging", { inputs: [] })]);
    const curr = makeSnapshot({}, [makeStep("s1", 1, "Packaging", {
      inputs: [{ id: "inp1", name: "Packaging material", type: "material" }],
    })]);
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "steps", "input added")).toBe(true);
    expect(hasEntry(changes, "steps", "Packaging material")).toBe(true);
  });

  it("detects a step input being removed", () => {
    const prev = makeSnapshot({}, [makeStep("s1", 1, "Packaging", {
      inputs: [{ id: "inp1", name: "Old input", type: "material" }],
    })]);
    const curr = makeSnapshot({}, [makeStep("s1", 1, "Packaging", { inputs: [] })]);
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "steps", "input removed")).toBe(true);
  });
});

describe("diffSnapshots — ingredients", () => {
  it("detects an ingredient being added", () => {
    const prev = makeSnapshot({}, [], []);
    const curr = makeSnapshot({}, [], [makeIngredient("ing1", "Raw carrots")]);
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "ingredients", "Ingredient added")).toBe(true);
    expect(hasEntry(changes, "ingredients", "Raw carrots")).toBe(true);
  });

  it("detects an ingredient being removed", () => {
    const prev = makeSnapshot({}, [], [makeIngredient("ing1", "Raw carrots")]);
    const curr = makeSnapshot({}, [], []);
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "ingredients", "Ingredient removed")).toBe(true);
  });

  it("detects an ingredient being renamed", () => {
    const prev = makeSnapshot({}, [], [makeIngredient("ing1", "Old Name")]);
    const curr = makeSnapshot({}, [], [makeIngredient("ing1", "New Name")]);
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "ingredients", "renamed")).toBe(true);
  });

  it("detects a supplier change on an ingredient", () => {
    const prev = makeSnapshot({}, [], [makeIngredient("ing1", "Carrots", { supplier: "Supplier A" })]);
    const curr = makeSnapshot({}, [], [makeIngredient("ing1", "Carrots", { supplier: "Supplier B" })]);
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "ingredients", "supplier updated")).toBe(true);
  });

  it("detects a hazard added to an ingredient", () => {
    const prev = makeSnapshot({}, [], [makeIngredient("ing1", "Carrots", { hazards: [] })]);
    const curr = makeSnapshot({}, [], [makeIngredient("ing1", "Carrots", {
      hazards: [makeHazard("h1", "E. coli")],
    })]);
    const changes = diffSnapshots(prev, curr);
    expect(hasEntry(changes, "ingredients", "hazard added")).toBe(true);
    expect(hasEntry(changes, "ingredients", "E. coli")).toBe(true);
  });

  it("does not emit entries when ingredients are unchanged", () => {
    const snap = makeSnapshot({}, [], [makeIngredient("ing1", "Carrots")]);
    const changes = diffSnapshots(snap, snap);
    expect(changes.filter((c) => c.section === "ingredients")).toHaveLength(0);
  });
});
