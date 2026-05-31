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

// ── FlowChartStep auto-populate ───────────────────────────────────────────────

/**
 * Populates flow_chart_steps for `flowChartId` from the plan's processSteps
 * if the junction table is currently empty for that chart.  Idempotent.
 */
export async function ensureJunction(
  flowChartId: string,
  planId: string,
): Promise<void> {
  const existing = await db
    .select({ id: flowChartSteps.id })
    .from(flowChartSteps)
    .where(eq(flowChartSteps.flowChartId, flowChartId))
    .all();

  if (existing.length > 0) return;

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

// ── DAG cycle detection ────────────────────────────────────────────────────────

/**
 * Returns true if adding an edge (sourceStepId → targetStepId) would create
 * a cycle in the step connection graph.  Connections are step-level directed
 * edges; outputId is not considered for cycle detection.
 *
 * Algorithm: DFS from targetStepId — if we reach sourceStepId, a cycle exists.
 */
export async function wouldCreateCycle(
  sourceStepId: string,
  targetStepId: string,
): Promise<boolean> {
  // Immediate self-loop
  if (sourceStepId === targetStepId) return true;

  // Fetch all existing connections in the system
  const allConns = await db
    .select({
      src: stepConnections.sourceStepId,
      tgt: stepConnections.targetStepId,
    })
    .from(stepConnections)
    .all();

  // Build adjacency list
  const adj = new Map<string, string[]>();
  for (const { src, tgt } of allConns) {
    if (!adj.has(src)) adj.set(src, []);
    adj.get(src)!.push(tgt);
  }

  // DFS from targetStepId — can we reach sourceStepId?
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
