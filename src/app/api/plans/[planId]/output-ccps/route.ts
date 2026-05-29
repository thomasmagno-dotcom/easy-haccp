import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  outputCcps,
  outputCriticalLimits,
  outputMonitoringProcedures,
  outputCorrectiveActions,
  outputVerificationProcedures,
  stepOutputs,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

async function fetchFullOutputCcp(ccpId: string) {
  const ccp = await db
    .select()
    .from(outputCcps)
    .where(eq(outputCcps.id, ccpId))
    .get();
  if (!ccp) return null;

  const [limits, monitoring, corrective, verification] = await Promise.all([
    db.select().from(outputCriticalLimits).where(eq(outputCriticalLimits.outputCcpId, ccpId)).all(),
    db.select().from(outputMonitoringProcedures).where(eq(outputMonitoringProcedures.outputCcpId, ccpId)).all(),
    db.select().from(outputCorrectiveActions).where(eq(outputCorrectiveActions.outputCcpId, ccpId)).all(),
    db.select().from(outputVerificationProcedures).where(eq(outputVerificationProcedures.outputCcpId, ccpId)).all(),
  ]);

  return {
    ...ccp,
    criticalLimits: limits,
    monitoringProcedures: monitoring,
    correctiveActions: corrective,
    verificationProcedures: verification,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  await params;
  const { searchParams } = new URL(req.url);
  const outputId = searchParams.get("outputId");

  if (!outputId) {
    return NextResponse.json({ error: "outputId required" }, { status: 400 });
  }

  const ccp = await db
    .select()
    .from(outputCcps)
    .where(eq(outputCcps.outputId, outputId))
    .get();

  if (!ccp) return NextResponse.json(null);

  return NextResponse.json(await fetchFullOutputCcp(ccp.id));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { outputId, hazardDescription, controlMeasureDescription } = body;

  const id = generateId();
  const data = { id, outputId, hazardDescription, controlMeasureDescription };

  await db.insert(outputCcps).values(data).run();

  await logAudit({
    planId,
    entityType: "output_ccp",
    entityId: id,
    action: "create",
    newValue: data,
  });

  return NextResponse.json(await fetchFullOutputCcp(id), { status: 201 });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const {
    id,
    criticalLimits,
    monitoringProcedures,
    correctiveActions,
    verificationProcedures,
    ...ccpUpdates
  } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  if (Object.keys(ccpUpdates).length > 0) {
    await db.update(outputCcps).set(ccpUpdates).where(eq(outputCcps.id, id)).run();
  }

  if (criticalLimits !== undefined) {
    await db.delete(outputCriticalLimits).where(eq(outputCriticalLimits.outputCcpId, id)).run();
    for (const l of criticalLimits) {
      await db.insert(outputCriticalLimits).values({ id: generateId(), outputCcpId: id, ...l }).run();
    }
  }
  if (monitoringProcedures !== undefined) {
    await db.delete(outputMonitoringProcedures).where(eq(outputMonitoringProcedures.outputCcpId, id)).run();
    for (const m of monitoringProcedures) {
      await db.insert(outputMonitoringProcedures).values({ id: generateId(), outputCcpId: id, ...m }).run();
    }
  }
  if (correctiveActions !== undefined) {
    await db.delete(outputCorrectiveActions).where(eq(outputCorrectiveActions.outputCcpId, id)).run();
    for (const a of correctiveActions) {
      await db.insert(outputCorrectiveActions).values({ id: generateId(), outputCcpId: id, ...a }).run();
    }
  }
  if (verificationProcedures !== undefined) {
    await db.delete(outputVerificationProcedures).where(eq(outputVerificationProcedures.outputCcpId, id)).run();
    for (const v of verificationProcedures) {
      await db.insert(outputVerificationProcedures).values({ id: generateId(), outputCcpId: id, ...v }).run();
    }
  }

  await logAudit({
    planId,
    entityType: "output_ccp",
    entityId: id,
    action: "update",
    newValue: { id },
  });

  return NextResponse.json(await fetchFullOutputCcp(id));
}
