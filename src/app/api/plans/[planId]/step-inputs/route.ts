import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stepInputs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  await params;
  const body = await req.json();
  const { stepId, name, type, notes } = body;

  if (!stepId || !name?.trim()) {
    return NextResponse.json({ error: "stepId and name required" }, { status: 400 });
  }

  const id = generateId();
  db.insert(stepInputs)
    .values({ id, stepId, name: name.trim(), type: type || null, notes: notes || null })
    .run();

  const created = db.select().from(stepInputs).where(eq(stepInputs.id, id)).get();
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  await params;
  const url = new URL(req.url);
  const inputId = url.searchParams.get("inputId");
  if (!inputId) {
    return NextResponse.json({ error: "inputId required" }, { status: 400 });
  }

  db.delete(stepInputs).where(eq(stepInputs.id, inputId)).run();
  return NextResponse.json({ ok: true });
}
