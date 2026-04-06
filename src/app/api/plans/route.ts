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
    productDescription: JSON.stringify({
      name: "Baby Carrots (Fresh-Cut, Peeled)",
      characteristics:
        "Peeled, cut, and washed fresh carrots. Packed in modified atmosphere. No preservatives. pH 5.8-6.5, Aw > 0.98",
      intendedUse: "Ready-to-eat snack or ingredient. No further cooking required.",
      targetConsumer:
        "General public including children, elderly, immunocompromised",
      shelfLife: "21 days from packaging date at 0-4°C",
      packaging: "340g and 907g polyethylene bags, modified atmosphere (MAP)",
      storageDistribution: "Refrigerated at 0-4°C throughout supply chain",
      labellingInstructions:
        '"Keep Refrigerated", "Best Before" date, lot code, facility ID',
      regulatoryClassification:
        "Fresh-cut vegetable, ready-to-eat. Subject to SFCR, CFIA inspection.",
    }),
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
