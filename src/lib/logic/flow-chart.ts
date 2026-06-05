/**
 * Shared helpers for FlowChart entity management.
 * Used by process-steps, flow-charts, and step-connections API routes.
 */

import { db } from "@/lib/db";
import { flowCharts, flowChartSteps, processSteps, stepConnections } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { generateId } from "@/lib/utils";

// ── FlowChart auto-provision ──────────────────────────────────────────────────

/**
 * Returns the default (main_process) FlowChart for a plan, creating it if it
 * doesn't exist yet.  All legacy plans get a "Main Process" chart on first call.
 */
export async function ensureDefaultFlowChart(
  planId: string,
): Promise<{ id: string; name: string; flowChartType: string }> {
  const existing = await db
    .select()
    .from(flowCharts)
    .where(eq(flowCharts.haccpPlanId, planId))
    .orderBy(asc(flowCharts.createdAt))
    .all();

  if (existing.length > 0) return existing[0];

  const id = generateId();
  await db
    .insert(flowCharts)
    .values({ id, haccpPlanId: planId, name: "Main Process", flowChartType: "main_process" })
    .run();

  return { id, name: "Main Process", flowChartType: "main_process" };
}

// ── FlowChartStep migration ───────────────────────────────────────────────────

/**
 * Migrates legacy processSteps (planId-keyed) into the flow_chart_steps
 * junction for the DEFAULT chart only.  Never called for user-created charts.
 *
 * Rule: a newly created flow chart is EMPTY.  Users explicitly add or link steps.
 * Only the first "Main Process" chart may inherit existing steps for backward compat.
 */
export async function migrateStepsToDefaultChart(
  flowChartId: string,
  planId: string,
): Promise<void> {
  const existing = await db
    .select({ id: flowChartSteps.id })
    .from(flowChartSteps)
    .where(eq(flowChartSteps.flowChartId, flowChartId))
    .all();

  if (existing.length > 0) return; // already migrated or has steps

  const steps = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .orderBy(asc(processSteps.stepNumber))
    .all();

  for (const step of steps) {
    await db
      .insert(flowChartSteps)
      .values({
        id: generateId(),
        flowChartId,
        stepId: step.id,
        sequence: step.stepNumber,
        isShared: false,
        localOverrides: null,
      })
      .run();
  }
}

/**
 * Verifies a chart exists in the junction — does NOT auto-populate.
 * Use migrateStepsToDefaultChart() for the default chart only.
 */
export async function ensureJunction(
  flowChartId: string,
  planId: string,
): Promise<void> {
  // No-op: this function is a no-op intentionally.
  // New charts start empty. Existing charts already have their junction rows.
  // Only the default chart migration populates from processSteps.
  void flowChartId;
  void planId;
}

// ── DAG cycle detection ────────────────────────────────────────────────────────

/**
 * Returns true if adding an edge (sourceStepId → targetStepId) would create
 * a cycle in the step connection graph.
 *
 * Algorithm: DFS from targetStepId — if we reach sourceStepId, a cycle exists.
 */
export async function wouldCreateCycle(
  sourceStepId: string,
  targetStepId: string,
): Promise<boolean> {
  if (sourceStepId === targetStepId) return true;

  const allConns = await db
    .select({ src: stepConnections.sourceStepId, tgt: stepConnections.targetStepId })
    .from(stepConnections)
    .all();

  const adj = new Map<string, string[]>();
  for (const { src, tgt } of allConns) {
    if (!adj.has(src)) adj.set(src, []);
    adj.get(src)!.push(tgt);
  }

  const visited = new Set<string>();
  function dfs(node: string): boolean {
    if (node === sourceStepId) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    for (const neighbor of adj.get(node) ?? []) {
      if (dfs(neighbor)) return true;
    }
    return false;
  }

  return dfs(targetStepId);
}
