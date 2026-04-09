import { NextResponse } from "next/server";
import { seedHazards } from "@/lib/db/seed";

export async function POST() {
  try {
    await seedHazards();
    return NextResponse.json({ ok: true, message: "Hazard database seeded successfully." });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
