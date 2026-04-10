import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { planVersions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { diffSnapshots } from "@/lib/diff-snapshots";
import { buildCurrentSnapshot } from "@/lib/queries/build-snapshot";

// GET: Returns a preview of changes since the last published version
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;

  // Build current state snapshot using shared module
  const snapshot = await buildCurrentSnapshot(db, planId);
  if (!snapshot) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  const { plan, processSteps: stepsWithInputs, ingredients: ingredientsWithHazards } = snapshot;

  const currentSnapshot = { plan, processSteps: stepsWithInputs, ingredients: ingredientsWithHazards };

  // Get the last published snapshot to diff against
  const lastVersion = await db
    .select()
    .from(planVersions)
    .where(eq(planVersions.planId, planId))
    .orderBy(desc(planVersions.versionNumber))
    .get();

  let previousSnapshot = null;
  if (lastVersion?.snapshot) {
    try { previousSnapshot = JSON.parse(lastVersion.snapshot); } catch { /* ignore */ }
  }

  const changes = diffSnapshots(previousSnapshot, currentSnapshot);

  return NextResponse.json({
    changes,
    previousVersion: lastVersion ? lastVersion.versionNumber : null,
    nextVersion: plan.currentVersion + 1,
  });
}
