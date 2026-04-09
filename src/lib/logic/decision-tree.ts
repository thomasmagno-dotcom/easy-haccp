/**
 * Pure decision-tree logic for CCP designation — no DB access, fully unit-testable.
 *
 * The Codex decision tree has four questions:
 *   Q1: Does a control measure exist for the identified hazard?
 *   Q2: Is this step specifically designed to eliminate or reduce the hazard to an acceptable level?
 *   Q3: Could contamination occur at this step above acceptable levels?
 *   Q4: Will a subsequent step eliminate or reduce the hazard to an acceptable level?
 *
 * Result rules:
 *   Q1 = No  →  not_ccp  (no control measure — modify the step)
 *   Q1 = Yes, Q2 = Yes  →  ccp
 *   Q1 = Yes, Q2 = No,  Q3 = No   →  not_ccp
 *   Q1 = Yes, Q2 = No,  Q3 = Yes, Q4 = Yes  →  not_ccp  (subsequent step handles it)
 *   Q1 = Yes, Q2 = No,  Q3 = Yes, Q4 = No   →  ccp
 *   Any incomplete path  →  null
 */

export interface DecisionTreeAnswers {
  q1: boolean | null;
  q2: boolean | null;
  q3: boolean | null;
  q4: boolean | null;
  result: "ccp" | "not_ccp" | null;
}

/**
 * Computes the decision tree result from the current answers.
 * Returns null when not enough questions have been answered to reach a conclusion.
 */
export function computeResult(
  dt: Pick<DecisionTreeAnswers, "q1" | "q2" | "q3" | "q4">,
): DecisionTreeAnswers["result"] {
  if (dt.q1 === false) return "not_ccp";
  if (dt.q1 === true && dt.q2 === true) return "ccp";
  if (dt.q1 === true && dt.q2 === false) {
    if (dt.q3 === false) return "not_ccp";
    if (dt.q3 === true) {
      if (dt.q4 === true) return "not_ccp";
      if (dt.q4 === false) return "ccp";
    }
  }
  return null;
}

/**
 * Returns true if at least one hazard in the given answers map resolves to "ccp".
 * Used to determine whether the process step should be designated as a CCP.
 */
export function stepIsCcp(
  allAnswers: Record<string, Pick<DecisionTreeAnswers, "q1" | "q2" | "q3" | "q4">>,
): boolean {
  return Object.values(allAnswers).some(
    (dt) => computeResult(dt) === "ccp",
  );
}

/**
 * Parses a JSON decision-tree string from the DB into a DecisionTreeAnswers object.
 * Returns a blank (all-null) object on null input or parse error.
 */
export function parseDecisionTree(json: string | null): DecisionTreeAnswers {
  if (!json) return { q1: null, q2: null, q3: null, q4: null, result: null };
  try {
    return JSON.parse(json);
  } catch {
    return { q1: null, q2: null, q3: null, q4: null, result: null };
  }
}
