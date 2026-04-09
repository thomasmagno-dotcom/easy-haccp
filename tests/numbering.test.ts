import { describe, it, expect } from "bun:test";
import { getNextNumber, renumberedAfterRemoval } from "../src/lib/logic/numbering";

describe("getNextNumber", () => {
  it("returns 1 for an empty array", () => {
    expect(getNextNumber([])).toBe(1);
  });

  it("returns 2 when only [1] exists", () => {
    expect(getNextNumber([1])).toBe(2);
  });

  it("returns 4 for a contiguous sequence [1, 2, 3]", () => {
    expect(getNextNumber([1, 2, 3])).toBe(4);
  });

  it("uses max-based logic, not count-based — [1, 3] returns 4, not 3", () => {
    expect(getNextNumber([1, 3])).toBe(4);
  });

  it("handles a single large number", () => {
    expect(getNextNumber([5])).toBe(6);
  });

  it("handles an unordered array correctly", () => {
    expect(getNextNumber([3, 1, 2])).toBe(4);
  });
});

describe("renumberedAfterRemoval", () => {
  type Item = { id: string; stepNumber: number; name: string };

  const makeItems = (...names: string[]): Item[] =>
    names.map((name, i) => ({ id: `id-${i + 1}`, stepNumber: i + 1, name }));

  it("removes the item with the given id", () => {
    const items = makeItems("A", "B", "C");
    const result = renumberedAfterRemoval(items, "id-2");
    expect(result.map((i) => i.name)).toEqual(["A", "C"]);
  });

  it("renumbers remaining items 1-based", () => {
    const items = makeItems("A", "B", "C");
    const result = renumberedAfterRemoval(items, "id-1");
    expect(result.map((i) => i.stepNumber)).toEqual([1, 2]);
  });

  it("preserves other fields on each item", () => {
    const items = makeItems("A", "B", "C");
    const result = renumberedAfterRemoval(items, "id-2");
    expect(result[0].name).toBe("A");
    expect(result[1].name).toBe("C");
  });

  it("returns an empty array when removing the last item", () => {
    const items = makeItems("only");
    expect(renumberedAfterRemoval(items, "id-1")).toEqual([]);
  });

  it("returns all items renumbered when the id is not found", () => {
    const items = makeItems("A", "B");
    const result = renumberedAfterRemoval(items, "no-such-id");
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.stepNumber)).toEqual([1, 2]);
  });

  it("sorts by stepNumber before renumbering even if input is out of order", () => {
    const items: Item[] = [
      { id: "x3", stepNumber: 3, name: "C" },
      { id: "x1", stepNumber: 1, name: "A" },
      { id: "x2", stepNumber: 2, name: "B" },
    ];
    const result = renumberedAfterRemoval(items, "x2");
    expect(result.map((i) => i.name)).toEqual(["A", "C"]);
    expect(result.map((i) => i.stepNumber)).toEqual([1, 2]);
  });

  it("works with types that carry extra fields beyond id and stepNumber", () => {
    type Extended = { id: string; stepNumber: number; tag: number; label: string };
    const items: Extended[] = [
      { id: "a", stepNumber: 1, tag: 100, label: "first" },
      { id: "b", stepNumber: 2, tag: 200, label: "second" },
      { id: "c", stepNumber: 3, tag: 300, label: "third" },
    ];
    const result = renumberedAfterRemoval(items, "b");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "a", stepNumber: 1, tag: 100, label: "first" });
    expect(result[1]).toMatchObject({ id: "c", stepNumber: 2, tag: 300, label: "third" });
  });
});
