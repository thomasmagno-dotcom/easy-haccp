import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hazards } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { asc } from "drizzle-orm";

export async function GET() {
  const allHazards = db
    .select()
    .from(hazards)
    .orderBy(asc(hazards.type), asc(hazards.name))
    .all();
  return NextResponse.json(allHazards);
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = generateId();

  db.insert(hazards)
    .values({
      id,
      name: body.name,
      type: body.type,
      description: body.description || null,
      severity: body.severity || null,
      likelihood: body.likelihood || null,
      sourceCategory: body.sourceCategory || null,
      isSystemDefault: false,
      applicableStepCategories: body.applicableStepCategories
        ? JSON.stringify(body.applicableStepCategories)
        : null,
    })
    .run();

  return NextResponse.json({ id }, { status: 201 });
}
