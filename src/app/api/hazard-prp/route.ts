import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hazardPrp, prpMaster } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { generateId } from "@/lib/utils";

// GET /api/hazard-prp?hazardId=xxx   — PRPs linked to a specific hazard
// GET /api/hazard-prp?prpId=xxx      — hazards linked to a specific PRP
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hazardId = searchParams.get("hazardId");
  const prpId = searchParams.get("prpId");

  if (hazardId) {
    const links = await db
      .select({ link: hazardPrp, prp: prpMaster })
      .from(hazardPrp)
      .innerJoin(prpMaster, eq(hazardPrp.prpMasterId, prpMaster.id))
      .where(eq(hazardPrp.hazardId, hazardId))
      .all();

    return NextResponse.json(
      links.map((l) => ({ ...l.link, prp: l.prp })),
    );
  }

  if (prpId) {
    const links = await db
      .select()
      .from(hazardPrp)
      .where(eq(hazardPrp.prpMasterId, prpId))
      .all();
    return NextResponse.json(links);
  }

  return NextResponse.json({ error: "hazardId or prpId required" }, { status: 400 });
}

// POST — link a PRP to a hazard
export async function POST(req: Request) {
  const body = await req.json();
  const { hazardId, prpMasterId } = body;

  if (!hazardId || !prpMasterId) {
    return NextResponse.json(
      { error: "hazardId and prpMasterId required" },
      { status: 400 },
    );
  }

  // Check for existing link to avoid duplicates
  const existing = await db
    .select()
    .from(hazardPrp)
    .where(eq(hazardPrp.hazardId, hazardId))
    .all();

  if (existing.some((l) => l.prpMasterId === prpMasterId)) {
    return NextResponse.json({ error: "Link already exists" }, { status: 409 });
  }

  const id = generateId();
  await db.insert(hazardPrp).values({ id, hazardId, prpMasterId }).run();

  const prp = await db
    .select()
    .from(prpMaster)
    .where(eq(prpMaster.id, prpMasterId))
    .get();

  return NextResponse.json({ id, hazardId, prpMasterId, prp }, { status: 201 });
}

// DELETE /api/hazard-prp?id=xxx
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await db.delete(hazardPrp).where(eq(hazardPrp.id, id)).run();
  return NextResponse.json({ success: true });
}
