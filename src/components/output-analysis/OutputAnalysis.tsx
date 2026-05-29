"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { OutputHazardIdentificationSection } from "./OutputHazardIdentificationSection";
import { OutputRiskMatrix } from "./OutputRiskMatrix";
import { OutputDecisionTreeSection } from "./OutputDecisionTreeSection";
import { OutputControlMeasuresSection } from "./OutputControlMeasuresSection";
import { OutputCcpDetailsSection } from "./OutputCcpDetailsSection";
import type {
  StepOutput,
  OutputHazardAssignment,
  OutputCcpData,
  Hazard,
} from "@/lib/types";

const OUTPUT_TYPE_LABELS: Record<string, string> = {
  primary_product: "Primary Product",
  waste: "Waste",
  rejected_product: "Rejected Product",
  water_discharge: "Water Discharge",
  other: "Other",
};

interface Props {
  planId: string;
  stepId: string;
  stepName: string;
  output: StepOutput;
  hazardAssignments: OutputHazardAssignment[];
  ccpData: OutputCcpData | null;
  availableHazards: Hazard[];
}

export function OutputAnalysis({
  planId,
  stepId,
  stepName,
  output,
  hazardAssignments: initialAssignments,
  ccpData,
  availableHazards,
}: Props) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [isCcp, setIsCcp] = useState(output.isCcp ?? false);
  const [ccpNumber, setCcpNumber] = useState<string | null>(output.ccpNumber ?? null);

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
              href={`/plans/${planId}/steps/${stepId}`}
              className="text-neutral-400 hover:text-neutral-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{output.name}</h1>
                {isCcp && (
                  <Badge variant="destructive" className="text-xs">
                    {ccpNumber || "CCP"}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {OUTPUT_TYPE_LABELS[output.outputType] || output.outputType}
                </Badge>
              </div>
              <p className="text-sm text-neutral-500 mt-0.5">
                Output of{" "}
                <Link
                  href={`/plans/${planId}/steps/${stepId}`}
                  className="underline hover:text-neutral-700"
                >
                  {stepName}
                </Link>
              </p>
              {output.description && (
                <p className="text-sm text-neutral-600 mt-1">{output.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Section 1: Hazard Identification */}
      <section>
        <h2 className="text-lg font-semibold mb-4">1. Hazard Identification &amp; Risk Assessment</h2>
        <OutputHazardIdentificationSection
          planId={planId}
          outputId={output.id}
          outputName={output.name}
          assignments={assignments}
          availableHazards={availableHazards}
          onUpdate={setAssignments}
        />
      </section>

      <Separator />

      {/* Section 2: Risk Matrix */}
      {hasAssessedHazards && (
        <>
          <section>
            <h2 className="text-lg font-semibold mb-4">2. Risk Matrix</h2>
            <OutputRiskMatrix assignments={assignments} />
          </section>
          <Separator />
        </>
      )}

      {/* Section 3: Decision Tree */}
      <section>
        <h2 className="text-lg font-semibold mb-1">3. CCP Decision Tree</h2>
        <p className="text-sm text-neutral-500 mb-4">
          For each significant hazard, answer the Codex Alimentarius decision tree questions to determine if this output is a Critical Control Point.
        </p>
        {significantHazards.length === 0 ? (
          <p className="text-sm text-neutral-400 italic">
            No significant hazards. Identify significant hazards in Section 1 first.
          </p>
        ) : (
          <OutputDecisionTreeSection
            planId={planId}
            outputId={output.id}
            isCcp={isCcp}
            significantHazards={significantHazards}
            onUpdate={(updated) => {
              setAssignments((prev) =>
                prev.map((a) => (a.id === updated.id ? updated : a)),
              );
            }}
            onCcpStatusChanged={(newIsCcp, newCcpNumber) => {
              setIsCcp(newIsCcp);
              setCcpNumber(newCcpNumber);
            }}
          />
        )}
      </section>

      <Separator />

      {/* Section 4: Control Measures */}
      <section>
        <h2 className="text-lg font-semibold mb-4">4. Control Measures</h2>
        <OutputControlMeasuresSection
          planId={planId}
          assignments={assignments}
          onUpdate={setAssignments}
        />
      </section>

      {/* Section 5: CCP Details (only if CCP) */}
      {isCcp && (
        <>
          <Separator />
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold">5. CCP Details</h2>
              <Badge variant="destructive" className="text-xs">{ccpNumber || "CCP"}</Badge>
            </div>
            <OutputCcpDetailsSection
              planId={planId}
              outputId={output.id}
              ccpData={ccpData}
            />
          </section>
        </>
      )}
    </div>
  );
}
