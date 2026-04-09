import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { haccpPlans, processSteps } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { BABY_CARROT_STEPS } from "@/lib/db/seed";
import { desc } from "drizzle-orm";

export async function GET() {
  const plans = db
    .select()
    .from(haccpPlans)
    .orderBy(desc(haccpPlans.updatedAt))
    .all();
  return NextResponse.json(plans);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, facilityName, template } = body;

  const planId = generateId();

  const plan = {
    id: planId,
    name: name || "New HACCP Plan",
    facilityName: facilityName || "My Facility",
    status: "draft" as const,
    currentVersion: 0,
    productDescription: JSON.stringify({}),
    teamMembers: JSON.stringify([]),
  };

  db.insert(haccpPlans).values(plan).run();

  logAudit({
    planId,
    entityType: "plan",
    entityId: planId,
    action: "create",
    newValue: plan,
  });

  // If using baby carrot template, create process steps
  if (template === "baby-carrots") {
    for (const step of BABY_CARROT_STEPS) {
      const stepId = generateId();
      const stepData = {
        id: stepId,
        planId,
        stepNumber: step.stepNumber,
        name: step.name,
        description: step.description,
        category: step.category,
        isCcp: step.isCcp,
        ccpNumber: step.ccpNumber,
      };
      db.insert(processSteps).values(stepData).run();
      logAudit({
        planId,
        entityType: "process_step",
        entityId: stepId,
        action: "create",
        newValue: stepData,
      });
    }
  }

  return NextResponse.json({ id: planId }, { status: 201 });
}
