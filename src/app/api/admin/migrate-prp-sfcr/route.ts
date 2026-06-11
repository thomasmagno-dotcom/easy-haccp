import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function POST() {
  try {
    await db.run(sql`ALTER TABLE prp_master ADD COLUMN sfcr_section TEXT`);
    return NextResponse.json({ success: true, message: "Column sfcr_section added to prp_master." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("duplicate column")) {
      return NextResponse.json({ success: true, message: "Column already exists." });
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
