/**
 * Test-only helper: creates a fresh in-memory SQLite database with the full
 * application schema applied via Drizzle migrations.
 *
 * Uses bun:sqlite (Bun's native SQLite driver) instead of better-sqlite3,
 * since better-sqlite3 requires Node.js native bindings not available in Bun.
 * The drizzle-orm/bun-sqlite adapter is API-compatible with the rest of the app.
 *
 * Usage:
 *   import { createTestDb } from "@/lib/db/test-db";
 *   const db = createTestDb();
 */

import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";
import path from "path";

export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

export type TestDB = ReturnType<typeof createTestDb>;
