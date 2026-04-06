import { db } from "@/lib/db";
import {
  processSteps,
  ccps,
  criticalLimits,
  monitoringProcedures,
  correctiveActions,
  verificationProcedures,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CcpSummaryPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;

  const steps = db
    .select()
    .from(processSteps)
    .where(eq(processSteps.planId, planId))
    .orderBy(asc(processSteps.stepNumber))
    .all()
    .filter((s) => s.isCcp);

  const ccpRows = steps.map((step) => {
    const ccp = db.select().from(ccps).where(eq(ccps.stepId, step.id)).get();
    if (!ccp) return { step, ccp: null, limits: [], monitoring: [], corrective: [], verification: [] };

    return {
      step,
      ccp,
      limits: db.select().from(criticalLimits).where(eq(criticalLimits.ccpId, ccp.id)).all(),
      monitoring: db.select().from(monitoringProcedures).where(eq(monitoringProcedures.ccpId, ccp.id)).all(),
      corrective: db.select().from(correctiveActions).where(eq(correctiveActions.ccpId, ccp.id)).all(),
      verification: db.select().from(verificationProcedures).where(eq(verificationProcedures.ccpId, ccp.id)).all(),
    };
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">CCP Summary (Form 10)</h2>
        <p className="text-sm text-neutral-500">
          Auto-generated from CCP data entered on each step&apos;s analysis page.
        </p>
      </div>

      {ccpRows.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-200 rounded-lg">
          <p className="text-neutral-500">
            No CCPs have been designated yet. Go to the{" "}
            <Link href={`/plans/${planId}/process-flow`} className="underline">
              Process Flow
            </Link>{" "}
            and analyze steps to designate CCPs.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {ccpRows.map(({ step, ccp, limits, monitoring, corrective, verification }) => (
            <div key={step.id} className="border rounded-lg overflow-hidden">
              <div className="bg-red-50 px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="destructive">{step.ccpNumber}</Badge>
                  <span className="font-semibold text-sm">
                    Step {step.stepNumber}: {step.name}
                  </span>
                </div>
                <Link
                  href={`/plans/${planId}/steps/${step.id}`}
                  className="text-xs text-neutral-500 hover:text-neutral-700 underline"
                >
                  Edit
                </Link>
              </div>

              {!ccp ? (
                <div className="p-4 text-sm text-neutral-500 italic">
                  CCP details not yet entered.{" "}
                  <Link
                    href={`/plans/${planId}/steps/${step.id}`}
                    className="underline"
                  >
                    Add details
                  </Link>
                </div>
              ) : (
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium w-48 bg-neutral-50 text-xs">Hazard(s)</TableCell>
                      <TableCell className="text-sm">{ccp.hazardDescription}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium bg-neutral-50 text-xs">Control Measure</TableCell>
                      <TableCell className="text-sm">{ccp.controlMeasureDescription}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium bg-neutral-50 text-xs">Critical Limits</TableCell>
                      <TableCell className="text-sm">
                        {limits.length === 0 ? (
                          <span className="text-neutral-400 italic">Not defined</span>
                        ) : (
                          <ul className="list-disc list-inside space-y-0.5">
                            {limits.map((l) => (
                              <li key={l.id}>
                                {l.parameter}: {l.minimum && `min ${l.minimum}`}
                                {l.maximum && ` max ${l.maximum}`}
                                {l.target && ` (target: ${l.target})`}
                                {l.unit && ` ${l.unit}`}
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium bg-neutral-50 text-xs">Monitoring</TableCell>
                      <TableCell className="text-sm">
                        {monitoring.length === 0 ? (
                          <span className="text-neutral-400 italic">Not defined</span>
                        ) : (
                          <div className="space-y-1">
                            {monitoring.map((m) => (
                              <div key={m.id}>
                                <strong>What:</strong> {m.what} | <strong>How:</strong> {m.how} | <strong>Freq:</strong> {m.frequency} | <strong>Who:</strong> {m.who}
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium bg-neutral-50 text-xs">Corrective Action</TableCell>
                      <TableCell className="text-sm">
                        {corrective.length === 0 ? (
                          <span className="text-neutral-400 italic">Not defined</span>
                        ) : (
                          <div className="space-y-2">
                            {corrective.map((c) => (
                              <div key={c.id}>
                                <p><strong>If:</strong> {c.deviation}</p>
                                <p><strong>Action:</strong> {c.immediateAction}</p>
                                <p><strong>Product:</strong> {c.productDisposition}</p>
                                <p className="text-xs text-neutral-500">Responsible: {c.responsiblePerson}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium bg-neutral-50 text-xs">Verification</TableCell>
                      <TableCell className="text-sm">
                        {verification.length === 0 ? (
                          <span className="text-neutral-400 italic">Not defined</span>
                        ) : (
                          <ul className="list-disc list-inside space-y-0.5">
                            {verification.map((v) => (
                              <li key={v.id}>
                                {v.activity} — {v.frequency} ({v.responsiblePerson})
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
