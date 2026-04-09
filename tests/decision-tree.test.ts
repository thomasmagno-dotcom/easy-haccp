import { describe, it, expect } from "bun:test";
import {
  computeResult,
  stepIsCcp,
  parseDecisionTree,
} from "../src/lib/logic/decision-tree";

// ── computeResult ─────────────────────────────────────────────────────────────

describe("computeResult", () => {
  // ── Incomplete paths → null ────────────────────────────────────────────────

  it("returns null when no questions answered", () => {
    expect(computeResult({ q1: null, q2: null, q3: null, q4: null })).toBeNull();
  });

  it("returns null when only Q1=true answered (Q2 pending)", () => {
    expect(computeResult({ q1: true, q2: null, q3: null, q4: null })).toBeNull();
  });

  it("returns null when Q1=true, Q2=false, Q3 pending", () => {
    expect(computeResult({ q1: true, q2: false, q3: null, q4: null })).toBeNull();
  });

  it("returns null when Q1=true, Q2=false, Q3=true, Q4 pending", () => {
    expect(computeResult({ q1: true, q2: false, q3: true, q4: null })).toBeNull();
  });

  // ── Complete paths → not_ccp ───────────────────────────────────────────────

  it("Q1=false → not_ccp (no control measure exists)", () => {
    expect(computeResult({ q1: false, q2: null, q3: null, q4: null })).toBe("not_ccp");
  });

  it("Q1=true, Q2=false, Q3=false → not_ccp (contamination cannot occur)", () => {
    expect(computeResult({ q1: true, q2: false, q3: false, q4: null })).toBe("not_ccp");
  });

  it("Q1=true, Q2=false, Q3=true, Q4=true → not_ccp (subsequent step controls it)", () => {
    expect(computeResult({ q1: true, q2: false, q3: true, q4: true })).toBe("not_ccp");
  });

  // ── Complete paths → ccp ───────────────────────────────────────────────────

  it("Q1=true, Q2=true → ccp (step designed to eliminate hazard)", () => {
    expect(computeResult({ q1: true, q2: true, q3: null, q4: null })).toBe("ccp");
  });

  it("Q1=true, Q2=false, Q3=true, Q4=false → ccp (no subsequent step to handle it)", () => {
    expect(computeResult({ q1: true, q2: false, q3: true, q4: false })).toBe("ccp");
  });

  // ── Q2/Q3/Q4 irrelevant when Q1=false ─────────────────────────────────────

  it("Q1=false with other answers set still returns not_ccp", () => {
    expect(computeResult({ q1: false, q2: true, q3: true, q4: false })).toBe("not_ccp");
  });
});

// ── stepIsCcp ─────────────────────────────────────────────────────────────────

describe("stepIsCcp", () => {
  it("returns false for an empty answers map", () => {
    expect(stepIsCcp({})).toBe(false);
  });

  it("returns false when all hazards are not_ccp", () => {
    expect(
      stepIsCcp({
        h1: { q1: false, q2: null, q3: null, q4: null },
        h2: { q1: true, q2: false, q3: false, q4: null },
      }),
    ).toBe(false);
  });

  it("returns false when all hazards are incomplete (null result)", () => {
    expect(
      stepIsCcp({
        h1: { q1: null, q2: null, q3: null, q4: null },
        h2: { q1: true, q2: null, q3: null, q4: null },
      }),
    ).toBe(false);
  });

  it("returns true when at least one hazard resolves to ccp", () => {
    expect(
      stepIsCcp({
        h1: { q1: false, q2: null, q3: null, q4: null }, // not_ccp
        h2: { q1: true, q2: true, q3: null, q4: null },  // ccp
      }),
    ).toBe(true);
  });

  it("returns true when ALL hazards resolve to ccp", () => {
    expect(
      stepIsCcp({
        h1: { q1: true, q2: true, q3: null, q4: null },
        h2: { q1: true, q2: false, q3: true, q4: false },
      }),
    ).toBe(true);
  });

  it("returns false when only one hazard is present and it is not_ccp", () => {
    expect(
      stepIsCcp({ h1: { q1: true, q2: false, q3: false, q4: null } }),
    ).toBe(false);
  });

  it("flips to true as soon as one hazard becomes ccp", () => {
    const before = {
      h1: { q1: false, q2: null, q3: null, q4: null }, // not_ccp
      h2: { q1: true, q2: null, q3: null, q4: null },  // incomplete
    };
    expect(stepIsCcp(before)).toBe(false);

    const after = {
      ...before,
      h2: { q1: true, q2: true, q3: null, q4: null }, // now ccp
    };
    expect(stepIsCcp(after)).toBe(true);
  });
});

// ── parseDecisionTree ─────────────────────────────────────────────────────────

describe("parseDecisionTree", () => {
  it("returns all-null object for null input", () => {
    expect(parseDecisionTree(null)).toEqual({
      q1: null, q2: null, q3: null, q4: null, result: null,
    });
  });

  it("returns all-null object for invalid JSON", () => {
    expect(parseDecisionTree("not-json")).toEqual({
      q1: null, q2: null, q3: null, q4: null, result: null,
    });
  });

  it("parses a valid JSON string correctly", () => {
    const input = JSON.stringify({ q1: true, q2: true, q3: null, q4: null, result: "ccp" });
    expect(parseDecisionTree(input)).toEqual({
      q1: true, q2: true, q3: null, q4: null, result: "ccp",
    });
  });
});
