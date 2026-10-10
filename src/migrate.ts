/**
 * Database migrations (drizzle/*.sql) without drizzle-kit.
 *   CLI:      node dist/migrate.js
 *   On boot:  RUN_MIGRATIONS_ON_START=true (hosts without a pre-deploy step, e.g. Render free)
 */
import { fileURLToPath } from "url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db/index.js";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

/** Applies pending migrations. Safe to run on every boot and from several instances (Postgres locks). */
export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder });
}

// Run as a script: apply and exit.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await runMigrations();
    console.log("migrations applied");
  } catch (err) {
    console.error("migration failed", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
