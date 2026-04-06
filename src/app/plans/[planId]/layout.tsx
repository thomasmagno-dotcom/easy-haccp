import { AppShell } from "@/components/layout/AppShell";
import { PlanSubNav } from "@/components/plans/PlanSubNav";
import { db } from "@/lib/db";
import { haccpPlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export default async function PlanLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const plan = db
    .select()
    .from(haccpPlans)
    .where(eq(haccpPlans.id, planId))
    .get();

  if (!plan) {
    notFound();
  }

  return (
    <AppShell>
      <div className="border-b border-neutral-200 bg-white">
        <div className="px-8 pt-6 pb-0 max-w-6xl mx-auto">
          <h1 className="text-xl font-bold tracking-tight">{plan.name}</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {plan.facilityName}
          </p>
          <PlanSubNav planId={planId} />
        </div>
      </div>
      <div className="p-8 max-w-6xl mx-auto">{children}</div>
    </AppShell>
  );
}
