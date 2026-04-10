import { db } from "./index";
import { hazards } from "./schema";
import { eq } from "drizzle-orm";

const sevMap: Record<string, string> = { low: "1", medium: "2", high: "4" };
const likMap: Record<string, string> = { low: "1", medium: "2", high: "4" };

async function main() {
  const all = await db.select().from(hazards).all();
  let updated = 0;
  for (const h of all) {
    const newSev = sevMap[h.severity || ""] || h.severity;
    const newLik = likMap[h.likelihood || ""] || h.likelihood;
    if (newSev !== h.severity || newLik !== h.likelihood) {
      await db.update(hazards)
        .set({ severity: newSev, likelihood: newLik })
        .where(eq(hazards.id, h.id))
        .run();
      updated++;
    }
  }
  console.log(`Updated ${updated} hazards to 4-level system`);

  const sample = (await db.select().from(hazards).all()).slice(0, 5);
  sample.forEach((h) =>
    console.log(`  ${h.name}: S=${h.severity} L=${h.likelihood}`),
  );
}

main().catch(console.error);
