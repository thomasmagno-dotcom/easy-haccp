import { describe, it, expect } from "bun:test";
import {
  computeRiskScore,
  getCellCategory,
  migrateOldLevel,
} from "../src/lib/risk-matrix";

describe("computeRiskScore", () => {
  it("returns not-assessed sentinel for (null, null)", () => {
    const r = computeRiskScore(null, null);
    expect(r.score).toBe(0);
    expect(r.category).toBe("low");
    expect(r.isSignificant).toBe(false);
    expect(r.label).toBe("Not assessed");
  });

  it("returns not-assessed for out-of-range values ('0', '5')", () => {
    const r = computeRiskScore("0", "5");
    expect(r.score).toBe(0);
    expect(r.isSignificant).toBe(false);
  });

  it("score ('1','1') = 1 — low, not significant", () => {
    const r = computeRiskScore("1", "1");
    expect(r.score).toBe(1);
    expect(r.category).toBe("low");
    expect(r.isSignificant).toBe(false);
    expect(r.label).toBe("Low Risk");
  });

  it("score ('1','3') = 3 — low, not significant", () => {
    const r = computeRiskScore("1", "3");
    expect(r.score).toBe(3);
    expect(r.category).toBe("low");
    expect(r.isSignificant).toBe(false);
  });

  it("score ('2','2') = 4 — medium, not significant", () => {
    const r = computeRiskScore("2", "2");
    expect(r.score).toBe(4);
    expect(r.category).toBe("medium");
    expect(r.isSignificant).toBe(false);
    expect(r.label).toBe("Medium Risk");
  });

  it("score ('2','3') = 6 — medium, not significant", () => {
    const r = computeRiskScore("2", "3");
    expect(r.score).toBe(6);
    expect(r.category).toBe("medium");
    expect(r.isSignificant).toBe(false);
  });

  it("score ('2','4') = 8 — high, SIGNIFICANT", () => {
    const r = computeRiskScore("2", "4");
    expect(r.score).toBe(8);
    expect(r.category).toBe("high");
    expect(r.isSignificant).toBe(true);
    expect(r.label).toBe("High Risk");
  });

  it("score ('3','3') = 9 — high, SIGNIFICANT", () => {
    const r = computeRiskScore("3", "3");
    expect(r.score).toBe(9);
    expect(r.category).toBe("high");
    expect(r.isSignificant).toBe(true);
  });

  it("score ('3','4') = 12 — critical, SIGNIFICANT", () => {
    const r = computeRiskScore("3", "4");
    expect(r.score).toBe(12);
    expect(r.category).toBe("critical");
    expect(r.isSignificant).toBe(true);
    expect(r.label).toBe("Critical Risk");
  });

  it("score ('4','4') = 16 — critical, SIGNIFICANT", () => {
    const r = computeRiskScore("4", "4");
    expect(r.score).toBe(16);
    expect(r.category).toBe("critical");
    expect(r.isSignificant).toBe(true);
  });

  it("returns correct severity and likelihood numeric values", () => {
    const r = computeRiskScore("3", "2");
    expect(r.severity).toBe(3);
    expect(r.likelihood).toBe(2);
    expect(r.score).toBe(6);
  });

  it("all 16 valid combinations produce valid categories", () => {
    const validCategories = new Set(["low", "medium", "high", "critical"]);
    for (let s = 1; s <= 4; s++) {
      for (let l = 1; l <= 4; l++) {
        const r = computeRiskScore(String(s), String(l));
        expect(validCategories.has(r.category)).toBe(true);
        expect(r.score).toBe(s * l);
      }
    }
  });
});

describe("getCellCategory", () => {
  it("(1,1) → 'low'", () => expect(getCellCategory(1, 1)).toBe("low"));
  it("(1,3) → 'low'", () => expect(getCellCategory(1, 3)).toBe("low"));
  it("(2,2) → 'medium'", () => expect(getCellCategory(2, 2)).toBe("medium"));
  it("(2,4) → 'high'", () => expect(getCellCategory(2, 4)).toBe("high"));
  it("(3,3) → 'high'", () => expect(getCellCategory(3, 3)).toBe("high"));
  it("(3,4) → 'critical'", () => expect(getCellCategory(3, 4)).toBe("critical"));
  it("(4,4) → 'critical'", () => expect(getCellCategory(4, 4)).toBe("critical"));

  it("all 16 cells return a valid category", () => {
    const valid = new Set(["low", "medium", "high", "critical"]);
    for (let s = 1; s <= 4; s++) {
      for (let l = 1; l <= 4; l++) {
        expect(valid.has(getCellCategory(s, l))).toBe(true);
      }
    }
  });
});

describe("migrateOldLevel", () => {
  it("maps 'low' → '1'", () => expect(migrateOldLevel("low")).toBe("1"));
  it("maps 'medium' → '2'", () => expect(migrateOldLevel("medium")).toBe("2"));
  it("maps 'high' → '4'", () => expect(migrateOldLevel("high")).toBe("4"));
  it("returns null for null input", () => expect(migrateOldLevel(null)).toBeNull());
  it("passes numeric string '3' through unchanged", () => expect(migrateOldLevel("3")).toBe("3"));
  it("passes numeric string '1' through unchanged", () => expect(migrateOldLevel("1")).toBe("1"));
  it("passes unknown strings through unchanged", () => expect(migrateOldLevel("extreme")).toBe("extreme"));
});
