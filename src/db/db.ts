import { Generated, Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { env } from "@/lib/env";

// Utility type to convert all Generated<T> to T
type Degenerate<T> = {
  [K in keyof T]: T[K] extends Generated<infer U> ? U : T[K];
};

export type SubscriberStatus = "pending" | "verified" | "unsubscribed";

export type SubscribersTable = {
  id: Generated<string>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  email: string;
  token: Generated<string>;
  status: SubscriberStatus;
  source: "form" | "luma" | "substack" | "manual";
  last_emailed_at: Date | null;
};
export type Subscriber = Degenerate<SubscribersTable>;

export type Database = {
  subscribers: SubscribersTable;
};

// Strip sslmode from URL so Pool's ssl config (rejectUnauthorized: false) is used.
// Otherwise pg may apply strict verification from sslmode=require/verify-full and reject Supabase's cert chain.
function connectionStringWithoutSslMode(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  parsed.searchParams.delete("sslrootcert");
  return parsed.toString();
}

// Connection pooler configured for Supabase Transaction Mode (port 6543)
// Transaction mode is required for serverless/Vercel deployments
// Transaction mode does not support prepared statements, which Kysely handles automatically
const pool = new Pool({
  connectionString: connectionStringWithoutSslMode(env.POSTGRES_URL),
  ssl: { rejectUnauthorized: false },
  // Serverless-optimized pool settings for Supabase Transaction Mode
  max: 15, // Maximum number of clients in the pool
  min: 0, // Minimum number of clients (0 for serverless)
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection cannot be established
  // Allow pool to close idle connections immediately in serverless environments
  allowExitOnIdle: true,
});

// Handle pool errors gracefully
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});
