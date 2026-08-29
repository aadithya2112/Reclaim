import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { getDatabaseEnv } from "@/lib/env";
import * as schema from "./schema";

let client: Sql | undefined;
let database: PostgresJsDatabase<typeof schema> | undefined;

export function getDb() {
  if (!database) {
    client = postgres(getDatabaseEnv().DATABASE_URL, { prepare: false });
    database = drizzle(client, { schema });
  }

  return database;
}

export async function closeDb() {
  await client?.end();
  client = undefined;
  database = undefined;
}
