"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  computeResult,
  stepIsCcp,
  parseDecisionTree,
} from "@/lib/logic/decision-tree";
import type { StepHazardAssignment, DecisionTreeAnswers } from "@/lib/types";

interface Props {
  planId: string;
  stepId: string;
  isCcp: boolean;
  significantHazards: StepHazardAssignment[];
  onUpdate: (updatedAssignment: StepHazardAssignment) => void;
  onCcpStatusChanged: (isCcp: boolean, ccpNumber: string | null) => void;
}

export function DecisionTreeSection({
  planId,
  stepId,
  isCcp,
  significantHazards,
  onUpdate,
  onCcpStatusChanged,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, DecisionTreeAnswers>>(
    () => {
      const map: Record<string, DecisionTreeAnswers> = {};
      for (const h of significantHazards) {
        map[h.id] = parseDecisionTree(h.decisionTreeAnswers);
      }
      return map;
    },
  );

  async function updateAnswer(
    shId: string,
    question: keyof DecisionTreeAnswers,
    value: boolean,
  ) {
    const current = answers[shId] || {
      q1: null, q2: null, q3: null, q4: null, result: null,
    };
    const updated = { ...current, [question]: value };

    // Clear downstream answers when an upstream answer changes
    // New tree flow: Q1 → Q2 → Q3 → Q4
    if (question === "q1") {
      updated.q2 = null;
      updated.q3 = null;
      updated.q4 = null;
    }
    if (question === "q2") {
      updated.q3 = null;
      updated.q4 = null;
    }
    if (question === "q3") {
      updated.q4 = null;
    }

    updated.result = computeResult(updated);

    const allAnswers = { ...answers, [shId]: updated };
    const stepShouldBeCcp = stepIsCcp(allAnswers);

    setAnswers((prev) => ({ ...prev, [shId]: updated }));

    const res = await fetch(`/api/plans/${planId}/hazard-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: shId, decisionTreeAnswers: updated }),
    });

    if (res.ok) {
      const hazard = significantHazards.find((h) => h.id === shId);
      if (hazard) {
        onUpdate({ ...hazard, decisionTreeAnswers: JSON.stringify(updated) });
      }

      if (stepShouldBeCcp !== isCcp) {
        if (stepShouldBeCcp) {
          const stepsRes = await fetch(`/api/plans/${planId}/process-steps`);
          const allSteps: { isCcp: boolean; ccpNumber: string | null }[] =
            stepsRes.ok ? await stepsRes.json() : [];
          const usedNumbers = allSteps
            .filter((s) => s.isCcp && s.ccpNumber)
            .map((s) => {
              const n = parseInt((s.ccpNumber ?? "").replace("CCP-", ""), 10);
              return isNaN(n) ? 0 : n;
            });
          const nextNum = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
          const newCcpNumber = `CCP-${nextNum}`;

          await fetch(`/api/plans/${planId}/process-steps`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: stepId, isCcp: true, ccpNumber: newCcpNumber }),
          });
          onCcpStatusChanged(true, newCcpNumber);
        } else {
          await fetch(`/api/plans/${planId}/process-steps`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: stepId, isCcp: false, ccpNumber: null }),
          });
          onCcpStatusChanged(false, null);
        }
      }
    }
  }

  function YesNoButton({
    value,
    expected,
    onClick,
  }: {
    value: boolean | null;
    expected: boolean;
    onClick: () => void;
  }) {
    const isSelected = value === expected;
    return (
      <button
        onClick={onClick}
        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
          isSelected
            ? expected
              ? "bg-green-100 text-green-700"
              : "bg-neutral-200 text-neutral-700"
            : "bg-neutral-50 text-neutral-400 hover:bg-neutral-100"
        }`}
      >
        {expected ? "Yes" : "No"}
      </button>
    );
  }

  function ResultBadge({ result }: { result: DecisionTreeAnswers["result"] }) {
    if (result === "ccp")
      return <Badge variant="destructive">CCP</Badge>;
    if (result === "not_ccp")
      return <Badge variant="secondary">Not CCP</Badge>;
    if (result === "prp")
      return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">GHP / PRP</Badge>;
    if (result === "modify")
      return <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100">Modify Process</Badge>;
    return <span className="text-neutral-300">—</span>;
  }

  return (
    <div>
      {/* Reference header */}
      <p className="text-xs text-neutral-500 mb-3">
        Codex Alimentarius CCP Decision Tree — CXC 1-1969 Rev. 2020 (CCFH 2022)
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">Hazard</TableHead>
            <TableHead className="text-center w-32">
              <span className="block text-[11px] font-semibold">Q1</span>
              <span className="block text-[10px] font-normal text-neutral-500 leading-tight">
                Controlled by GHPs / PRPs?
              </span>
            </TableHead>
            <TableHead className="text-center w-32">
              <span className="block text-[11px] font-semibold">Q2</span>
              <span className="block text-[10px] font-normal text-neutral-500 leading-tight">
                Specific control measures exist here?
              </span>
            </TableHead>
            <TableHead className="text-center w-32">
              <span className="block text-[11px] font-semibold">Q3</span>
              <span className="block text-[10px] font-normal text-neutral-500 leading-tight">
                Subsequent step controls it?
              </span>
            </TableHead>
            <TableHead className="text-center w-32">
              <span className="block text-[11px] font-semibold">Q4</span>
              <span className="block text-[10px] font-normal text-neutral-500 leading-tight">
                This step can control it?
              </span>
            </TableHead>
            <TableHead className="text-center w-28">Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {significantHazards.map((h) => {
            const dt = answers[h.id] || {
              q1: null, q2: null, q3: null, q4: null, result: null,
            };
            const result = computeResult(dt);

            // New flow:
            //   Q1 always shown
            //   Q2 shown only if Q1 = No
            //   Q3 shown only if Q1 = No AND Q2 = Yes
            //   Q4 shown only if Q1 = No AND Q2 = Yes AND Q3 = No
            const showQ2 = dt.q1 === false;
            const showQ3 = dt.q1 === false && dt.q2 === true;
            const showQ4 = dt.q1 === false && dt.q2 === true && dt.q3 === false;

            return (
              <TableRow key={h.id}>
                <TableCell>
                  <span className="text-sm font-medium">{h.hazard.name}</span>
                </TableCell>

                {/* Q1 */}
                <TableCell className="text-center">
                  <div className="flex justify-center gap-1">
                    <YesNoButton value={dt.q1} expected={true}  onClick={() => updateAnswer(h.id, "q1", true)}  />
                    <YesNoButton value={dt.q1} expected={false} onClick={() => updateAnswer(h.id, "q1", false)} />
                  </div>
                </TableCell>

                {/* Q2 */}
                <TableCell className="text-center">
                  {showQ2 ? (
                    <div className="flex justify-center gap-1">
                      <YesNoButton value={dt.q2} expected={true}  onClick={() => updateAnswer(h.id, "q2", true)}  />
                      <YesNoButton value={dt.q2} expected={false} onClick={() => updateAnswer(h.id, "q2", false)} />
                    </div>
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </TableCell>

                {/* Q3 */}
                <TableCell className="text-center">
                  {showQ3 ? (
                    <div className="flex justify-center gap-1">
                      <YesNoButton value={dt.q3} expected={true}  onClick={() => updateAnswer(h.id, "q3", true)}  />
                      <YesNoButton value={dt.q3} expected={false} onClick={() => updateAnswer(h.id, "q3", false)} />
                    </div>
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </TableCell>

                {/* Q4 */}
                <TableCell className="text-center">
                  {showQ4 ? (
                    <div className="flex justify-center gap-1">
                      <YesNoButton value={dt.q4} expected={true}  onClick={() => updateAnswer(h.id, "q4", true)}  />
                      <YesNoButton value={dt.q4} expected={false} onClick={() => updateAnswer(h.id, "q4", false)} />
                    </div>
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </TableCell>

                {/* Result */}
                <TableCell className="text-center">
                  <ResultBadge result={result} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Question legend */}
      <div className="mt-4 p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-xs text-neutral-600 space-y-1">
        <p className="font-semibold text-neutral-700 mb-1.5">Decision Tree Questions (Codex CXC 1-1969 Rev. 2020)</p>
        <p><span className="font-semibold">Q1:</span> Can the significant hazard be controlled to an acceptable level at this step by prerequisite programs (e.g., GHPs)?</p>
        <p><span className="font-semibold">Q2:</span> Do specific control measures for the identified significant hazard exist at this step?</p>
        <p><span className="font-semibold">Q3:</span> Will a subsequent step prevent or eliminate the identified significant hazard or reduce it to an acceptable level?</p>
        <p><span className="font-semibold">Q4:</span> Can this step specifically prevent or eliminate the identified significant hazard or reduce it to an acceptable level?</p>
      </div>
    </div>
  );
}
