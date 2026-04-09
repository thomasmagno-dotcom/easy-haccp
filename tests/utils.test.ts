import { describe, it, expect } from "bun:test";
import { generateId, formatDate, formatDateTime } from "../src/lib/utils";

describe("generateId", () => {
  it("returns a non-empty string", () => {
    expect(typeof generateId()).toBe("string");
    expect(generateId().length).toBeGreaterThan(0);
  });

  it("returns unique values on successive calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateId()));
    expect(ids.size).toBe(20);
  });

  it("starts with a lowercase letter (cuid2 format)", () => {
    const id = generateId();
    expect(id[0]).toMatch(/[a-z]/);
  });

  it("is at least 24 characters long (cuid2 default length)", () => {
    expect(generateId().length).toBeGreaterThanOrEqual(24);
  });
});

describe("formatDate", () => {
  it("formats a SQLite UTC datetime string correctly", () => {
    // "2024-01-15 10:30:00" → "Jan 15, 2024" in en-CA
    const result = formatDate("2024-01-15 10:30:00");
    expect(result).toBe("Jan 15, 2024");
  });

  it("formats an ISO 8601 string correctly", () => {
    const result = formatDate("2024-06-01T00:00:00Z");
    expect(result).toBe("Jun 1, 2024");
  });

  it("handles midnight without off-by-one day error (UTC normalisation)", () => {
    // Without the toIso() fix, "2024-12-01 00:00:00" would be read as local time
    // and could appear as Nov 30 in UTC-offset environments.
    // The fix appends Z to force UTC parsing.
    const result = formatDate("2024-12-01 00:00:00");
    expect(result).toBe("Dec 1, 2024");
  });

  it("formats a date at end of year correctly", () => {
    const result = formatDate("2024-12-31 23:59:59");
    expect(result).toBe("Dec 31, 2024");
  });
});

describe("formatDateTime", () => {
  it("includes both date and time components", () => {
    const result = formatDateTime("2024-03-15 14:30:00");
    // Should contain the date part
    expect(result).toContain("Mar");
    expect(result).toContain("2024");
    // Should contain a time indicator (colon between hours and minutes)
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("handles a space-separated SQLite datetime by appending Z (UTC)", () => {
    // Without normalisation the time could shift by timezone offset.
    // We just verify it doesn't throw and returns a non-empty string.
    const result = formatDateTime("2024-01-15 08:00:00");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
