import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ingredients,
  ingredientHazards,
  ingredientControlMeasures,
  hazards,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

// GET: All ingredients for a plan with hazard assignments + control measures
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;

  const rows = db
    .select()
    .from(ingredients)
    .where(eq(ingredients.planId, planId))
    .orderBy(asc(ingredients.createdAt))
    .all();

  const result = rows.map((ing) => {
    const ihList = db
      .select({ ih: ingredientHazards, hazard: hazards })
      .from(ingredientHazards)
      .innerJoin(hazards, eq(ingredientHazards.hazardId, hazards.id))
      .where(eq(ingredientHazards.ingredientId, ing.id))
      .all();

    return {
      ...ing,
      hazards: ihList.map((r) => {
        const cms = db
          .select()
          .from(ingredientControlMeasures)
          .where(eq(ingredientControlMeasures.ingredientHazardId, r.ih.id))
          .all();
        return { ...r.ih, hazard: r.hazard, controlMeasures: cms };
      }),
    };
  });

  return NextResponse.json(result);
}

// POST: Create a new ingredient
export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { name, category, description, supplier } = body;

  const id = generateId();
  db.insert(ingredients)
    .values({
      id,
      planId,
      name,
      category: category || null,
      description: description || null,
      supplier: supplier || null,
    })
    .run();

  logAudit({ planId, entityType: "ingredient", entityId: id, action: "create", newValue: { id, name, category } });

  return NextResponse.json({ id }, { status: 201 });
}

// PUT: Update ingredient fields OR replace hazard assignments (with control measures)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const body = await req.json();
  const { id, hazardUpdates, ...updates } = body;

  // Update ingredient fields if any provided
  if (Object.keys(updates).length > 0) {
    db.update(ingredients).set(updates).where(eq(ingredients.id, id)).run();
  }

  // Replace hazard assignments (including control measures) if provided
  if (hazardUpdates && Array.isArray(hazardUpdates)) {
    // Delete all existing hazard assignments (cascades to their control measures)
    db.delete(ingredientHazards).where(eq(ingredientHazards.ingredientId, id)).run();

    for (const h of hazardUpdates) {
      const ihId = generateId();
      db.insert(ingredientHazards)
        .values({
          id: ihId,
          ingredientId: id,
          hazardId: h.hazardId,
          isSignificant: h.isSignificant ?? false,
          justification: h.justification ?? null,
          severityOverride: h.severityOverride ?? null,
          likelihoodOverride: h.likelihoodOverride ?? null,
        })
        .run();

      // Recreate control measures for this hazard assignment
      if (Array.isArray(h.controlMeasures)) {
        for (const cm of h.controlMeasures) {
          db.insert(ingredientControlMeasures)
            .values({
              id: generateId(),
              ingredientHazardId: ihId,
              description: cm.description,
              type: cm.type || "preventive",
            })
            .run();
        }
      }
    }
  }

  logAudit({ planId, entityType: "ingredient", entityId: id, action: "update", newValue: body });

  return NextResponse.json({ success: true });
}

// DELETE: Remove an ingredient (cascades to ingredient_hazards → ingredient_control_measures)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  db.delete(ingredients).where(eq(ingredients.id, id)).run();

  logAudit({ planId, entityType: "ingredient", entityId: id, action: "delete" });

  return NextResponse.json({ success: true });
}
