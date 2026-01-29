import * as path from "path";
import { promises as fs } from "fs";
import { FileMigrationProvider, Migrator } from "kysely";
import { fileURLToPath } from "url";
import { db } from "./index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
