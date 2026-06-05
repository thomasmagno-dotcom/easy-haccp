import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { haccpPlans, planVersions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

// POST: Clone a superseded version as a new draft version
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ planId: string; versionId: string }> },
) {
  const { planId, versionId } = await params;

  // Fetch the source version
  const source = await db
    .select()
    .from(planVersions)
    .where(and(eq(planVersions.id, versionId), eq(planVersions.planId, planId)))
    .get();

  if (!source) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Determine the next version number
  const latest = await db
    .select()
    .from(planVersions)
    .where(eq(planVersions.planId, planId))
    .orderBy(desc(planVersions.versionNumber))
    .get();

  const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;
  const newId = generateId();

  // Parse and re-stamp the snapshot
  let snapshot: Record<string, unknown>;
  try {
    snapshot = JSON.parse(source.snapshot);
  } catch {
    return NextResponse.json({ error: "Source snapshot corrupt" }, { status: 500 });
  }

  const clonedSnapshot = {
    ...snapshot,
    versionNumber: nextVersionNumber,
    snapshotAt: new Date().toISOString(),
    clonedFromVersionId: versionId,
  };

  const changeDescription = `Cloned from Version ${source.versionNumber}`;

  await db.insert(planVersions).values({
    id: newId,
    planId,
    versionNumber: nextVersionNumber,
    snapshot: JSON.stringify(clonedSnapshot),
    changeDescription,
    status: "draft",
    clonedFromVersionId: versionId,
    isRestorable: true,
  }).run();

  // Update plan's currentVersion counter so the next publish increments correctly
  await db.update(haccpPlans)
    .set({ currentVersion: nextVersionNumber })
    .where(eq(haccpPlans.id, planId))
    .run();

  await logAudit({
    planId,
    entityType: "plan",
    entityId: planId,
    action: "create",
    newValue: {
      action: "clone_version",
      newVersionId: newId,
      newVersionNumber: nextVersionNumber,
      sourceVersionId: versionId,
      sourceVersionNumber: source.versionNumber,
    },
  });

  const saved = await db
    .select()
    .from(planVersions)
    .where(eq(planVersions.id, newId))
    .get();

  return NextResponse.json(
    {
      id: newId,
      versionNumber: nextVersionNumber,
      publishedAt: saved?.publishedAt ?? new Date().toISOString(),
      status: "draft",
      changeDescription,
      clonedFromVersionId: versionId,
    },
    { status: 201 },
  );
}
