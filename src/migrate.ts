/**
 * Applies pending database migrations (drizzle/*.sql) and exits. Runs in the
 * production image without drizzle-kit: `node dist/migrate.js`.
 */
import { fileURLToPath } from "url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db/index.js";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

try {
  await migrate(db, { migrationsFolder });
  console.log("migrations applied");
} catch (err) {
  console.error("migration failed", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
