import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { DEMO_RECOVERY_CASES } from "./demo-fixtures";
import { recoveryCases } from "./schema";

const migrationUrl = process.env.DATABASE_MIGRATION_URL;

if (!migrationUrl) {
  throw new Error("DATABASE_MIGRATION_URL is required for the migration task");
}

const client = postgres(migrationUrl, {
  max: 1,
  prepare: false,
});

try {
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "/app/drizzle" });
  await db
    .insert(recoveryCases)
    .values(DEMO_RECOVERY_CASES)
    .onConflictDoNothing({ target: recoveryCases.id });
  console.info("Database migrations and bounded demo seed completed successfully.");
} finally {
  await client.end();
}
