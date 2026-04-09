/**
 * Pure validation/filtering helpers for HACCP plan updates.
 * No DB access — fully unit-testable.
 */

export const ALLOWED_PLAN_FIELDS = [
  "name",
  "facilityName",
  "facilityAddress",
  "productDescription",
  "teamMembers",
  "scope",
  "status",
] as const;

export type PlanUpdateFields = {
  [K in (typeof ALLOWED_PLAN_FIELDS)[number]]?: string;
};

/**
 * Copies only the allowed string fields from `body` into a plain object.
 * - Returns {} for any non-plain-object input (null, array, string, number).
 * - Non-string values for allowed fields are excluded.
 * - Never includes updatedAt, id, currentVersion, or any other field.
 */
export function filterPlanUpdateFields(body: unknown): PlanUpdateFields {
  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return {};
  }

  const result: PlanUpdateFields = {};
  const record = body as Record<string, unknown>;

  for (const field of ALLOWED_PLAN_FIELDS) {
    if (field in record && typeof record[field] === "string") {
      (result as Record<string, string>)[field] = record[field] as string;
    }
  }

  return result;
}
