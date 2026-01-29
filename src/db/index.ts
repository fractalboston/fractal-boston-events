import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { env } from "@/lib/env";

export type SubscriberStatus = "pending" | "verified" | "unsubscribed";

export type SubscribersTable = {
  id: string;
  email: string;
  token: string;
  status: SubscriberStatus;
  source: "form" | "luma";
  created_at: Date;
  updated_at: Date;
};

export type Database = {
  subscribers: SubscribersTable;
};

// Connection pooler configured for Supabase Transaction Mode (port 6543)
// Transaction mode is required for serverless/Vercel deployments
// Transaction mode does not support prepared statements, which Kysely handles automatically
const pool = new Pool({
  connectionString: env.POSTGRES_URL,
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
