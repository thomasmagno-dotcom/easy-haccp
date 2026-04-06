import { AppShell } from "@/components/layout/AppShell";
import { PlanList } from "@/components/plans/PlanList";
import { db } from "@/lib/db";
import { haccpPlans } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const plans = db
    .select()
    .from(haccpPlans)
    .orderBy(desc(haccpPlans.updatedAt))
    .all();

  return (
    <AppShell>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">HACCP Plans</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Create and manage food safety plans for your facility.
            </p>
          </div>
        </div>
        <PlanList plans={plans} />
      </div>
    </AppShell>
  );
}
