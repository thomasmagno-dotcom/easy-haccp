import { db } from "@/lib/db";
import {
  ingredients,
  ingredientHazards,
  ingredientControlMeasures,
  hazards,
  prpMaster,
  hazardPrp,
} from "@/lib/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { IngredientsEditor } from "@/components/ingredients/IngredientsEditor";
import type { Ingredient, Hazard, PrpMaster, HazardPrp } from "@/lib/types";

export default async function IngredientsPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;

  // Fetch all ingredients with their hazard assignments
  const rows = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.planId, planId))
    .orderBy(asc(ingredients.createdAt))
    .all();

  const ingredientList: Ingredient[] = await Promise.all(rows.map(async (ing) => {
    const ihList = await db
      .select({ ih: ingredientHazards, hazard: hazards })
      .from(ingredientHazards)
      .innerJoin(hazards, eq(ingredientHazards.hazardId, hazards.id))
      .where(eq(ingredientHazards.ingredientId, ing.id))
      .all();

    return {
      ...ing,
      hazards: await Promise.all(ihList.map(async (r) => {
        const cms = await db
          .select()
          .from(ingredientControlMeasures)
          .where(eq(ingredientControlMeasures.ingredientHazardId, r.ih.id))
          .all();
        return { ...r.ih, hazard: r.hazard, controlMeasures: cms };
      })),
    };
  }));

  // Fetch all hazards for the picker
  const allHazards: Hazard[] = await db
    .select()
    .from(hazards)
    .orderBy(asc(hazards.type), asc(hazards.name))
    .all();

  // Fetch full PRP registry
  const allPrps: PrpMaster[] = await db
    .select()
    .from(prpMaster)
    .orderBy(asc(prpMaster.fsepCode), asc(prpMaster.programName))
    .all() as PrpMaster[];

  // Collect all distinct hazardIds referenced by ingredient hazards
  const allIngHazardIds = Array.from(
    new Set(ingredientList.flatMap((ing) => ing.hazards.map((h) => h.hazardId))),
  );

  // Fetch existing PRP links for those hazards
  const prpLinks = allIngHazardIds.length > 0
    ? await db
        .select({ link: hazardPrp, prp: prpMaster })
        .from(hazardPrp)
        .innerJoin(prpMaster, eq(hazardPrp.prpMasterId, prpMaster.id))
        .where(inArray(hazardPrp.hazardId, allIngHazardIds))
        .all()
    : [];

  // Build map: hazardId → HazardPrp[]
  const prpLinksByHazardId: Record<string, HazardPrp[]> = {};
  for (const { link, prp } of prpLinks) {
    if (!prpLinksByHazardId[link.hazardId]) prpLinksByHazardId[link.hazardId] = [];
    prpLinksByHazardId[link.hazardId].push({ ...link, prp: prp as PrpMaster });
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Form 2: Ingredients &amp; Incoming Materials</h2>
        <p className="text-sm text-neutral-500 mt-1">
          List all raw materials, packaging, water, additives, and other incoming materials used in
          production. Conduct a hazard analysis for each to identify and assess associated risks.
        </p>
      </div>
      <IngredientsEditor
        planId={planId}
        initialIngredients={ingredientList}
        allHazards={allHazards}
        allPrps={allPrps}
        initialPrpLinksByHazardId={prpLinksByHazardId}
      />
    </div>
  );
}
