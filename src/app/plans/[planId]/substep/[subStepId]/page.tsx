import { db } from "@/lib/db";
import {
  inputSubgraphSteps,
  stepInputs,
  processSteps,
  hazards,
  inputSubgraphStepHazards,
  inputSubgraphStepControlMeasures,
  prpMaster,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SubgraphStepAnalysis } from "@/components/input-subgraph/SubgraphStepAnalysis";

export const dynamic = "force-dynamic";

export default async function SubgraphStepPage({
  params,
}: {
  params: Promise<{ planId: string; subStepId: string }>;
}) {
  const { planId, subStepId } = await params;

  const subStep = await db
    .select()
    .from(inputSubgraphSteps)
    .where(eq(inputSubgraphSteps.id, subStepId))
    .get();

  if (!subStep) notFound();

  const input = await db
    .select()
    .from(stepInputs)
    .where(eq(stepInputs.id, subStep.inputId))
    .get();

  if (!input) notFound();

  const parentStep = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.id, input.stepId))
    .get();

  if (!parentStep) notFound();

  const allHazards = await db.select().from(hazards).all();

  const assignments = await db
    .select({ assignment: inputSubgraphStepHazards, hazard: hazards })
    .from(inputSubgraphStepHazards)
    .innerJoin(hazards, eq(inputSubgraphStepHazards.hazardId, hazards.id))
    .where(eq(inputSubgraphStepHazards.subgraphStepId, subStepId))
    .all();

  const initialAssignments = await Promise.all(
    assignments.map(async (a) => {
      const measureRows = await db
        .select({ measure: inputSubgraphStepControlMeasures, prp: prpMaster })
        .from(inputSubgraphStepControlMeasures)
        .leftJoin(prpMaster, eq(inputSubgraphStepControlMeasures.prpMasterId, prpMaster.id))
        .where(eq(inputSubgraphStepControlMeasures.subgraphHazardId, a.assignment.id))
        .all();
      const measures = measureRows.map(({ measure, prp }) => ({
        ...measure,
        prpName:     prp?.programName ?? null,
        prpFsepCode: prp?.fsepCode    ?? null,
      }));
      return { ...a.assignment, hazard: a.hazard, controlMeasures: measures };
    }),
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link
          href={`/plans/${planId}/steps/${parentStep.id}`}
          className="text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
        >
          ← {parentStep.name}
        </Link>
      </div>

      <div className="mb-6">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
          Input: {input.name}
        </p>
        <h1 className="text-2xl font-bold text-neutral-900">{subStep.name}</h1>
      </div>

      <SubgraphStepAnalysis
        planId={planId}
        subgraphStepId={subStepId}
        subgraphStepName={subStep.name}
        availableHazards={allHazards.map((h) => ({
          id: h.id,
          name: h.name,
          type: h.type,
          severity: h.severity,
          likelihood: h.likelihood,
        }))}
        initialAssignments={initialAssignments}
      />
    </div>
  );
}
