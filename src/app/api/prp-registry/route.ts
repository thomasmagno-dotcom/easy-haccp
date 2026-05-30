import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prpMaster } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET() {
  const records = await db
    .select()
    .from(prpMaster)
    .orderBy(asc(prpMaster.prpType), asc(prpMaster.programName))
    .all();
  return NextResponse.json(records);
}

export async function POST(req: Request) {
  const body = await req.json();
  const {
    programName,
    prpType,
    description,
    documentReference,
    documentUrl,
    documentSource,
    owner,
    reviewFrequency,
    lastReviewDate,
    nextReviewDate,
  } = body;

  if (!programName || !prpType) {
    return NextResponse.json(
      { error: "programName and prpType are required" },
      { status: 400 },
    );
  }

  const id = generateId();
  const data = {
    id,
    programName,
    prpType,
    description: description ?? null,
    documentReference: documentReference ?? null,
    documentUrl: documentUrl ?? null,
    documentSource: documentSource ?? null,
    owner: owner ?? null,
    reviewFrequency: reviewFrequency ?? null,
    lastReviewDate: lastReviewDate ?? null,
    nextReviewDate: nextReviewDate ?? null,
  };

  await db.insert(prpMaster).values(data).run();

  const created = await db
    .select()
    .from(prpMaster)
    .where(eq(prpMaster.id, id))
    .get();

  return NextResponse.json(created, { status: 201 });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await db.update(prpMaster).set(updates).where(eq(prpMaster.id, id)).run();

  const updated = await db
    .select()
    .from(prpMaster)
    .where(eq(prpMaster.id, id))
    .get();

  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await db.delete(prpMaster).where(eq(prpMaster.id, id)).run();
  return NextResponse.json({ success: true });
}
