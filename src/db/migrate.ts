import * as path from "path";
import "dotenv/config";
import env from "env-var";
import { promises as fs } from "fs";
import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  PostgresDialect,
} from "kysely";
import { Pool } from "pg";
import { fileURLToPath } from "url";
import type { Database } from "./db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a database connection for migrations using direct connection (port 5432)
// Migrations require direct connection, not transaction pooler
const postgresUrl = env.get("POSTGRES_DIRECT_URL").required().asString();
const pool = new Pool({
  connectionString: postgresUrl,
  ssl: { rejectUnauthorized: false },
});

const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

function getMigrator(): Migrator {
  return new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, "migrations"),
    }),
  });
}

async function migrateToLatest(): Promise<void> {
  const migrator = getMigrator();
  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      console.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error instanceof Error) {
    console.error("failed to migrate");
    console.error(error);
    process.exit(1);
  }

  await db.destroy();
}

async function migrateDown(): Promise<void> {
  const migrator = getMigrator();
  const { error, results } = await migrator.migrateDown();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(
        `migration "${it.migrationName}" was rolled back successfully`
      );
    } else if (it.status === "Error") {
      console.error(`failed to roll back migration "${it.migrationName}"`);
    }
  });

  if (error instanceof Error) {
    console.error("failed to migrate down");
    console.error(error);
    process.exit(1);
  }

  await db.destroy();
}

const shouldMigrateDown = process.argv.includes("--down");

if (shouldMigrateDown) {
  migrateDown().catch((error: unknown) => {
    console.error("Migration down failed:", error);
    process.exit(1);
  });
} else {
  migrateToLatest().catch((error: unknown) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
}
