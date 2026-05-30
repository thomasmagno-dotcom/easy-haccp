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
import type { OutputHazardAssignment, DecisionTreeAnswers } from "@/lib/types";

interface Props {
  planId: string;
  outputId: string;
  isCcp: boolean;
  significantHazards: OutputHazardAssignment[];
  onUpdate: (updatedAssignment: OutputHazardAssignment) => void;
  onCcpStatusChanged: (isCcp: boolean, ccpNumber: string | null) => void;
}

export function OutputDecisionTreeSection({
  planId,
  outputId,
  isCcp,
  significantHazards,
  onUpdate,
  onCcpStatusChanged,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, DecisionTreeAnswers>>(() => {
    const map: Record<string, DecisionTreeAnswers> = {};
    for (const h of significantHazards) {
      map[h.id] = parseDecisionTree(h.decisionTreeAnswers);
    }
    return map;
  });

  async function updateAnswer(
    ohId: string,
    question: keyof DecisionTreeAnswers,
    value: boolean,
  ) {
    const current = answers[ohId] || { q1: null, q2: null, q3: null, q4: null, result: null };
    const updated = { ...current, [question]: value };

    // Clear downstream answers when an upstream answer changes
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

    const allAnswers = { ...answers, [ohId]: updated };
    const outputShouldBeCcp = stepIsCcp(allAnswers);

    setAnswers((prev) => ({ ...prev, [ohId]: updated }));

    const res = await fetch(`/api/plans/${planId}/output-hazard-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ohId, decisionTreeAnswers: updated }),
    });

    if (res.ok) {
      const hazard = significantHazards.find((h) => h.id === ohId);
      if (hazard) {
        onUpdate({ ...hazard, decisionTreeAnswers: JSON.stringify(updated) });
      }

      if (outputShouldBeCcp !== isCcp) {
        if (outputShouldBeCcp) {
          const newCcpNumber = "CCP-O-1";
          await fetch(`/api/plans/${planId}/step-outputs`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: outputId, isCcp: true, ccpNumber: newCcpNumber }),
          });
          onCcpStatusChanged(true, newCcpNumber);
        } else {
          await fetch(`/api/plans/${planId}/step-outputs`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: outputId, isCcp: false, ccpNumber: null }),
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

  if (significantHazards.length === 0) {
    return (
      <p className="text-sm text-neutral-500 italic">
        No significant hazards identified. Mark hazards as significant in Section 1.
      </p>
    );
  }

  return (
    <div>
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
            const dt = answers[h.id] || { q1: null, q2: null, q3: null, q4: null, result: null };
            const result = computeResult(dt);

            const showQ2 = dt.q1 === false;
            const showQ3 = dt.q1 === false && dt.q2 === true;
            const showQ4 = dt.q1 === false && dt.q2 === true && dt.q3 === false;

            return (
              <TableRow key={h.id}>
                <TableCell>
                  <span className="text-sm font-medium">{h.hazard.name}</span>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center gap-1">
                    <YesNoButton value={dt.q1} expected={true}  onClick={() => updateAnswer(h.id, "q1", true)}  />
                    <YesNoButton value={dt.q1} expected={false} onClick={() => updateAnswer(h.id, "q1", false)} />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {showQ2 ? (
                    <div className="flex justify-center gap-1">
                      <YesNoButton value={dt.q2} expected={true}  onClick={() => updateAnswer(h.id, "q2", true)}  />
                      <YesNoButton value={dt.q2} expected={false} onClick={() => updateAnswer(h.id, "q2", false)} />
                    </div>
                  ) : <span className="text-neutral-300">—</span>}
                </TableCell>
                <TableCell className="text-center">
                  {showQ3 ? (
                    <div className="flex justify-center gap-1">
                      <YesNoButton value={dt.q3} expected={true}  onClick={() => updateAnswer(h.id, "q3", true)}  />
                      <YesNoButton value={dt.q3} expected={false} onClick={() => updateAnswer(h.id, "q3", false)} />
                    </div>
                  ) : <span className="text-neutral-300">—</span>}
                </TableCell>
                <TableCell className="text-center">
                  {showQ4 ? (
                    <div className="flex justify-center gap-1">
                      <YesNoButton value={dt.q4} expected={true}  onClick={() => updateAnswer(h.id, "q4", true)}  />
                      <YesNoButton value={dt.q4} expected={false} onClick={() => updateAnswer(h.id, "q4", false)} />
                    </div>
                  ) : <span className="text-neutral-300">—</span>}
                </TableCell>
                <TableCell className="text-center">
                  <ResultBadge result={result} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

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
