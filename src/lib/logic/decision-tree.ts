/**
 * Pure decision-tree logic for CCP designation — no DB access, fully unit-testable.
 *
 * Implements the updated Codex Alimentarius CCP Decision Tree
 * (CXC 1-1969 Rev. 2020 / CCFH 2022 adoption).
 *
 * Q1: Can the significant hazard be controlled to an acceptable level at this
 *     step by prerequisite programs (e.g., GHPs)?
 *     → Yes = controlled by GHPs/PRPs (result: "prp")
 *     → No  = proceed to Q2
 *
 * Q2: Do specific control measures for the identified significant hazard
 *     exist at this step?
 *     → No  = not_ccp (no specific control here; address in process design)
 *     → Yes = proceed to Q3
 *
 * Q3: Will a subsequent step prevent or eliminate the identified significant
 *     hazard or reduce it to an acceptable level?
 *     → Yes = not_ccp (identify and designate that subsequent step as the CCP)
 *     → No  = proceed to Q4
 *
 * Q4: Can this step specifically prevent or eliminate the identified significant
 *     hazard or reduce it to an acceptable level?
 *     → Yes = CCP
 *     → No  = modify (process/product must be modified to implement a control measure)
 *
 * Result map:
 *   Q1 = Yes                               → "prp"     (GHPs/PRPs sufficient)
 *   Q1 = No, Q2 = No                       → "not_ccp" (no specific control at this step)
 *   Q1 = No, Q2 = Yes, Q3 = Yes            → "not_ccp" (subsequent step controls it)
 *   Q1 = No, Q2 = Yes, Q3 = No, Q4 = Yes  → "ccp"
 *   Q1 = No, Q2 = Yes, Q3 = No, Q4 = No   → "modify"  (process modification required)
 *   Any incomplete path                    → null
 */

export interface DecisionTreeAnswers {
  q1: boolean | null;
  q2: boolean | null;
  q3: boolean | null;
  q4: boolean | null;
  result: "ccp" | "not_ccp" | "prp" | "modify" | null;
}

/**
 * Computes the decision tree result from the current answers.
 * Returns null when not enough questions have been answered to reach a conclusion.
 */
export function computeResult(
  dt: Pick<DecisionTreeAnswers, "q1" | "q2" | "q3" | "q4">,
): DecisionTreeAnswers["result"] {
  if (dt.q1 === true) return "prp";
  if (dt.q1 === false) {
    if (dt.q2 === false) return "not_ccp";
    if (dt.q2 === true) {
      if (dt.q3 === true) return "not_ccp";
      if (dt.q3 === false) {
        if (dt.q4 === true) return "ccp";
        if (dt.q4 === false) return "modify";
      }
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
