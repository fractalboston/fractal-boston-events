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

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});
