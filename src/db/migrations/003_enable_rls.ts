import { Kysely, sql } from "kysely";
import type { Database } from "@/db/db";

/**
 * Enables Row Level Security (RLS) on all public tables to satisfy Supabase
 * linter and lock down API access. The app connects with the database owner
 * (POSTGRES_URL), which bypasses RLS, so behavior is unchanged. With RLS
 * enabled and no permissive policies, anon/authenticated API access is denied.
 */
export async function up(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE public.kysely_migration ENABLE ROW LEVEL SECURITY`.execute(
    db
  );
  await sql`ALTER TABLE public.kysely_migration_lock ENABLE ROW LEVEL SECURITY`.execute(
    db
  );
  await sql`ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY`.execute(
    db
  );
}
