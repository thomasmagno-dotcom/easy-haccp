import { describe, it, expect } from "bun:test";
import { filterPlanUpdateFields, ALLOWED_PLAN_FIELDS } from "../src/lib/validators/plan";

describe("filterPlanUpdateFields", () => {
  it("returns {} for an empty object", () => {
    expect(filterPlanUpdateFields({})).toEqual({});
  });

  it("copies 'name' when present and a string", () => {
    expect(filterPlanUpdateFields({ name: "My Plan" })).toEqual({ name: "My Plan" });
  });

  it("copies all 7 allowed fields when all are present", () => {
    const body = {
      name: "n",
      facilityName: "fn",
      facilityAddress: "fa",
      productDescription: "pd",
      teamMembers: "[]",
      scope: "s",
      status: "draft",
    };
    const result = filterPlanUpdateFields(body);
    expect(result).toEqual(body);
  });

  it("ignores 'id' even if present", () => {
    const result = filterPlanUpdateFields({ id: "some-id", name: "Plan" });
    expect(result).not.toHaveProperty("id");
    expect(result).toEqual({ name: "Plan" });
  });

  it("ignores 'currentVersion' even if present", () => {
    const result = filterPlanUpdateFields({ currentVersion: 5, facilityName: "X" });
    expect(result).not.toHaveProperty("currentVersion");
    expect(result).toEqual({ facilityName: "X" });
  });

  it("ignores 'createdAt' and 'updatedAt'", () => {
    const result = filterPlanUpdateFields({ createdAt: "2024-01-01", updatedAt: "2024-01-02", scope: "food safety" });
    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
    expect(result).toEqual({ scope: "food safety" });
  });

  it("excludes allowed fields with non-string values (number)", () => {
    const result = filterPlanUpdateFields({ name: 123 });
    expect(result).toEqual({});
  });

  it("excludes allowed fields with non-string values (boolean)", () => {
    const result = filterPlanUpdateFields({ name: true, facilityName: "Valid" });
    expect(result).toEqual({ facilityName: "Valid" });
  });

  it("excludes allowed fields with null values", () => {
    const result = filterPlanUpdateFields({ name: null, scope: "ok" });
    expect(result).toEqual({ scope: "ok" });
  });

  it("returns {} for null input without throwing", () => {
    expect(filterPlanUpdateFields(null)).toEqual({});
  });

  it("returns {} for string input without throwing", () => {
    expect(filterPlanUpdateFields("not an object")).toEqual({});
  });

  it("returns {} for number input without throwing", () => {
    expect(filterPlanUpdateFields(42)).toEqual({});
  });

  it("returns {} for array input without throwing", () => {
    expect(filterPlanUpdateFields(["name", "value"])).toEqual({});
  });

  it("ALLOWED_PLAN_FIELDS contains exactly the 7 expected keys", () => {
    const fields = [...ALLOWED_PLAN_FIELDS].sort();
    expect(fields).toContain("name");
    expect(fields).toContain("facilityName");
    expect(fields).toContain("facilityAddress");
    expect(fields).toContain("productDescription");
    expect(fields).toContain("teamMembers");
    expect(fields).toContain("scope");
    expect(fields).toContain("status");
    expect(fields).toHaveLength(7);
  });
});
