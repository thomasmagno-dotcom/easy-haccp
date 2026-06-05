import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { planVersions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET a single version's full snapshot + metadata
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string; versionId: string }> },
) {
  const { planId, versionId } = await params;

  const version = await db
    .select()
    .from(planVersions)
    .where(and(eq(planVersions.id, versionId), eq(planVersions.planId, planId)))
    .get();

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  let snapshot = null;
  try {
    snapshot = JSON.parse(version.snapshot);
  } catch {
    return NextResponse.json({ error: "Snapshot corrupt" }, { status: 500 });
  }

  return NextResponse.json({
    id: version.id,
    versionNumber: version.versionNumber,
    publishedAt: version.publishedAt,
    publishedBy: version.publishedBy,
    changeDescription: version.changeDescription,
    changeLog: version.changeLog ? JSON.parse(version.changeLog) : null,
    status: version.status ?? "active",
    effectiveDate: version.effectiveDate ?? null,
    clonedFromVersionId: version.clonedFromVersionId ?? null,
    isRestorable: version.isRestorable ?? true,
    snapshot,
  });
}
