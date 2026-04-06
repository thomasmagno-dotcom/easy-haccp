"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { HazardIdentificationSection } from "./HazardIdentificationSection";
import { RiskMatrix } from "./RiskMatrix";
import { DecisionTreeSection } from "./DecisionTreeSection";
import { ControlMeasuresSection } from "./ControlMeasuresSection";
import { CcpDetailsSection } from "./CcpDetailsSection";
import type {
  ProcessStep,
  StepHazardAssignment,
  CcpData,
  Hazard,
} from "@/lib/types";

interface Props {
  planId: string;
  step: ProcessStep;
  hazardAssignments: StepHazardAssignment[];
  ccpData: CcpData | null;
  availableHazards: Hazard[];
}

export function StepAnalysis({
  planId,
  step,
  hazardAssignments: initialAssignments,
  ccpData,
  availableHazards,
}: Props) {
  const [assignments, setAssignments] = useState(initialAssignments);

  const significantHazards = assignments.filter((a) => a.isSignificant);
  const hasAssessedHazards = assignments.some(
    (a) =>
      (a.severityOverride || a.hazard.severity) &&
      (a.likelihoodOverride || a.hazard.likelihood),
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href={`/plans/${planId}/process-flow`}
              className="text-neutral-400 hover:text-neutral-600"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <h2 className="text-lg font-semibold">
              Step {step.stepNumber}: {step.name}
            </h2>
            {step.isCcp && (
              <Badge variant="destructive">{step.ccpNumber}</Badge>
            )}
          </div>
          {step.description && (
            <p className="text-sm text-neutral-500 mt-1 ml-8">
              {step.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="capitalize px-2 py-1 rounded bg-neutral-100">
            {step.category}
          </span>
        </div>
      </div>

      <Separator />

      {/* Section 1: Hazard Identification & Risk Assessment */}
      <section>
        <h3 className="text-base font-semibold mb-1">
          1. Hazard Identification &amp; Risk Assessment
        </h3>
        <p className="text-xs text-neutral-500 mb-4">
          Assess severity (S1–S4) and likelihood (L1–L4). Risk score = S × L.
          Hazards scoring ≥8 are automatically marked significant.
        </p>
        <HazardIdentificationSection
          planId={planId}
          stepId={step.id}
          assignments={assignments}
          availableHazards={availableHazards}
          onUpdate={(updated) => setAssignments(updated)}
        />
      </section>

      {/* Section 2: Risk Matrix Visual */}
      {hasAssessedHazards && (
        <>
          <Separator />
          <section>
            <h3 className="text-base font-semibold mb-1">2. Risk Matrix</h3>
            <p className="text-xs text-neutral-500 mb-4">
              Visual placement of hazards on the 4×4 severity–likelihood matrix.
              Hazards in orange/red zones are significant.
            </p>
            <RiskMatrix assignments={assignments} />
          </section>
        </>
      )}

      <Separator />

      {/* Section 3: Decision Tree */}
      <section>
        <h3 className="text-base font-semibold mb-4">
          {hasAssessedHazards ? "3" : "2"}. Decision Tree (Significant Hazards)
        </h3>
        {significantHazards.length === 0 ? (
          <p className="text-sm text-neutral-500 italic">
            No significant hazards identified. Hazards with risk score ≥8 are
            automatically significant, or you can manually override any
            hazard&apos;s significance.
          </p>
        ) : (
          <DecisionTreeSection
            planId={planId}
            significantHazards={significantHazards}
            onUpdate={(updatedAssignment) =>
              setAssignments((prev) =>
                prev.map((a) =>
                  a.id === updatedAssignment.id ? updatedAssignment : a,
                ),
              )
            }
          />
        )}
      </section>

      <Separator />

      {/* Section 4: Control Measures */}
      <section>
        <h3 className="text-base font-semibold mb-4">
          {hasAssessedHazards ? "4" : "3"}. Control Measures
        </h3>
        <ControlMeasuresSection
          planId={planId}
          assignments={assignments}
          onUpdate={(updated) => setAssignments(updated)}
        />
      </section>

      {/* Section 5: CCP Details (only if CCP) */}
      {step.isCcp && (
        <>
          <Separator />
          <section>
            <h3 className="text-base font-semibold mb-4">
              {hasAssessedHazards ? "5" : "4"}. CCP Details — {step.ccpNumber}
            </h3>
            <CcpDetailsSection
              planId={planId}
              stepId={step.id}
              ccpData={ccpData}
            />
          </section>
        </>
      )}
    </div>
  );
}
