import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { haccpPlans, planVersions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { diffSnapshots } from "@/lib/diff-snapshots";
import { buildCurrentSnapshot } from "@/lib/queries/build-snapshot";

// GET all versions for a plan — metadata only (no snapshot body)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const versions = await db
    .select()
    .from(planVersions)
    .where(eq(planVersions.planId, planId))
    .orderBy(desc(planVersions.versionNumber))
    .all();

  return NextResponse.json(
    versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      publishedAt: v.publishedAt,
      publishedBy: v.publishedBy,
      changeDescription: v.changeDescription,
      changeLog: v.changeLog ? JSON.parse(v.changeLog) : null,
      status: v.status ?? "active",
      effectiveDate: v.effectiveDate ?? null,
      clonedFromVersionId: v.clonedFromVersionId ?? null,
      isRestorable: v.isRestorable ?? true,
    })),
  );
}

// POST: Publish a new version (create snapshot)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { changeDescription, publishedBy } = body;

  // Build full snapshot using shared module
  const snapshot = await buildCurrentSnapshot(db, planId);
  if (!snapshot) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  const { plan, processSteps: stepsWithInputs, ingredients: ingredientsWithHazards } = snapshot;

  // Fetch the previous snapshot for diffing
  const previousVersion = await db
    .select()
    .from(planVersions)
    .where(eq(planVersions.planId, planId))
    .orderBy(desc(planVersions.versionNumber))
    .get();

  let previousSnapshot = null;
  if (previousVersion?.snapshot) {
    try { previousSnapshot = JSON.parse(previousVersion.snapshot); } catch { /* ignore */ }
  }

  const currentSnapshot = { plan, processSteps: stepsWithInputs, ingredients: ingredientsWithHazards };
  const changeEntries = diffSnapshots(previousSnapshot, currentSnapshot);
  const changeLogJson = JSON.stringify(changeEntries);

  const versionNumber = plan.currentVersion + 1;
  const versionId = generateId();

  const versionSnapshot = {
    plan: { ...plan },
    processSteps: stepsWithInputs,
    ingredients: ingredientsWithHazards,
    snapshotAt: new Date().toISOString(),
    publishedBy: publishedBy || null,
    changeDescription: changeDescription || null,
    versionNumber,
  };

  const now = new Date().toISOString();

  // Mark the current active version as superseded before inserting the new one
  await db.update(planVersions)
    .set({ status: "superseded" })
    .where(eq(planVersions.planId, planId))
    .run();

  await db.insert(planVersions)
    .values({
      id: versionId,
      planId,
      versionNumber,
      snapshot: JSON.stringify(versionSnapshot),
      publishedBy: publishedBy || null,
      changeDescription: changeDescription || null,
      changeLog: changeLogJson,
      status: "active",
      effectiveDate: now,
    })
    .run();

  await db.update(haccpPlans)
    .set({ currentVersion: versionNumber, status: "published" })
    .where(eq(haccpPlans.id, planId))
    .run();

  await logAudit({
    planId,
    entityType: "plan",
    entityId: planId,
    action: "update",
    newValue: { action: "publish", versionNumber, changeDescription },
  });

  const savedVersion = await db
    .select()
    .from(planVersions)
    .where(eq(planVersions.id, versionId))
    .get();

  return NextResponse.json(
    {
      id: versionId,
      versionNumber,
      publishedAt: savedVersion?.publishedAt ?? now,
      changeLog: changeEntries,
      status: "active",
      effectiveDate: now,
    },
    { status: 201 },
  );
}
