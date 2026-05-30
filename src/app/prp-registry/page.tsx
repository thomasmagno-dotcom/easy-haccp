import { db } from "@/lib/db";
import { prpMaster, hazardPrp } from "@/lib/db/schema";
import { asc, sql } from "drizzle-orm";
import { AppShell } from "@/components/layout/AppShell";
import { PrpRegistryClient } from "@/components/prp-registry/PrpRegistryClient";

export const dynamic = "force-dynamic";

export default async function PrpRegistryPage() {
  const records = await db
    .select()
    .from(prpMaster)
    .orderBy(asc(prpMaster.prpType), asc(prpMaster.programName))
    .all();

  // Hazard link counts per PRP
  const linkCounts = await db
    .select({
      prpMasterId: hazardPrp.prpMasterId,
      count: sql<number>`count(*)`,
    })
    .from(hazardPrp)
    .groupBy(hazardPrp.prpMasterId)
    .all();

  const linkCountMap: Record<string, number> = {};
  for (const lc of linkCounts) linkCountMap[lc.prpMasterId] = lc.count;

  return (
    <AppShell>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">PRP Registry</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage Prerequisite Programs (PRPs) that control hazards across all HACCP plans.
            PRPs exist independently of any specific plan and can be linked to hazards in the hazard analysis.
          </p>
        </div>
        <PrpRegistryClient initialRecords={records as any} linkCounts={linkCountMap} />
      </div>
    </AppShell>
  );
}
