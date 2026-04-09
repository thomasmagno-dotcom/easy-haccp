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
      q1: null,
      q2: null,
      q3: null,
      q4: null,
      result: null,
    };
    const updated = { ...current, [question]: value };
    updated.result = computeResult(updated);

    // Clear downstream answers when upstream changes
    if (question === "q1" && !value) {
      updated.q2 = null;
      updated.q3 = null;
      updated.q4 = null;
    }
    if (question === "q2" && value) {
      updated.q3 = null;
      updated.q4 = null;
    }
    if (question === "q3" && !value) {
      updated.q4 = null;
    }

    updated.result = computeResult(updated);

    // Compute merged answers NOW (before setAnswers) to check CCP status
    const allAnswers = { ...answers, [shId]: updated };
    const stepShouldBeCcp = stepIsCcp(allAnswers);

    setAnswers((prev) => ({ ...prev, [shId]: updated }));

    const res = await fetch(`/api/plans/${planId}/hazard-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: shId,
        decisionTreeAnswers: updated,
      }),
    });

    if (res.ok) {
      // Propagate to parent so assignments state stays in sync
      const hazard = significantHazards.find((h) => h.id === shId);
      if (hazard) {
        onUpdate({
          ...hazard,
          decisionTreeAnswers: JSON.stringify(updated),
        });
      }

      // Designate or un-designate CCP on the process step
      if (stepShouldBeCcp !== isCcp) {
        if (stepShouldBeCcp) {
          // Determine next CCP number across the plan
          const stepsRes = await fetch(`/api/plans/${planId}/process-steps`);
          const allSteps: { isCcp: boolean; ccpNumber: string | null }[] =
            stepsRes.ok ? await stepsRes.json() : [];
          const usedNumbers = allSteps
            .filter((s) => s.isCcp && s.ccpNumber)
            .map((s) => {
              const n = parseInt((s.ccpNumber ?? "").replace("CCP-", ""), 10);
              return isNaN(n) ? 0 : n;
            });
          const nextNum =
            usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
          const newCcpNumber = `CCP-${nextNum}`;

          await fetch(`/api/plans/${planId}/process-steps`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: stepId,
              isCcp: true,
              ccpNumber: newCcpNumber,
            }),
          });
          onCcpStatusChanged(true, newCcpNumber);
        } else {
          await fetch(`/api/plans/${planId}/process-steps`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: stepId,
              isCcp: false,
              ccpNumber: null,
            }),
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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Hazard</TableHead>
          <TableHead className="text-center w-28">
            Q1: Control exists?
          </TableHead>
          <TableHead className="text-center w-28">
            Q2: Designed to eliminate?
          </TableHead>
          <TableHead className="text-center w-28">
            Q3: Could increase?
          </TableHead>
          <TableHead className="text-center w-28">
            Q4: Subsequent step?
          </TableHead>
          <TableHead className="text-center w-24">Result</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {significantHazards.map((h) => {
          const dt = answers[h.id] || {
            q1: null,
            q2: null,
            q3: null,
            q4: null,
            result: null,
          };
          const result = computeResult(dt);
          const showQ2 = dt.q1 === true;
          const showQ3 = dt.q1 === true && dt.q2 === false;
          const showQ4 = showQ3 && dt.q3 === true;

          return (
            <TableRow key={h.id}>
              <TableCell>
                <span className="text-sm font-medium">{h.hazard.name}</span>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex justify-center gap-1">
                  <YesNoButton
                    value={dt.q1}
                    expected={true}
                    onClick={() => updateAnswer(h.id, "q1", true)}
                  />
                  <YesNoButton
                    value={dt.q1}
                    expected={false}
                    onClick={() => updateAnswer(h.id, "q1", false)}
                  />
                </div>
              </TableCell>
              <TableCell className="text-center">
                {showQ2 ? (
                  <div className="flex justify-center gap-1">
                    <YesNoButton
                      value={dt.q2}
                      expected={true}
                      onClick={() => updateAnswer(h.id, "q2", true)}
                    />
                    <YesNoButton
                      value={dt.q2}
                      expected={false}
                      onClick={() => updateAnswer(h.id, "q2", false)}
                    />
                  </div>
                ) : (
                  <span className="text-neutral-300">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {showQ3 ? (
                  <div className="flex justify-center gap-1">
                    <YesNoButton
                      value={dt.q3}
                      expected={true}
                      onClick={() => updateAnswer(h.id, "q3", true)}
                    />
                    <YesNoButton
                      value={dt.q3}
                      expected={false}
                      onClick={() => updateAnswer(h.id, "q3", false)}
                    />
                  </div>
                ) : (
                  <span className="text-neutral-300">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {showQ4 ? (
                  <div className="flex justify-center gap-1">
                    <YesNoButton
                      value={dt.q4}
                      expected={true}
                      onClick={() => updateAnswer(h.id, "q4", true)}
                    />
                    <YesNoButton
                      value={dt.q4}
                      expected={false}
                      onClick={() => updateAnswer(h.id, "q4", false)}
                    />
                  </div>
                ) : (
                  <span className="text-neutral-300">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {result === "ccp" ? (
                  <Badge variant="destructive">CCP</Badge>
                ) : result === "not_ccp" ? (
                  <Badge variant="secondary">Not CCP</Badge>
                ) : (
                  <span className="text-neutral-300">—</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
