/**
 * Sets dummy env vars so tests can load modules that import @/lib/env
 * without requiring a real .env file.
 */
const dummyUrl = "https://test.example.com";
process.env.LUMA_CALENDAR_ID = process.env.LUMA_CALENDAR_ID ?? "test-calendar";
process.env.LUMA_WEBHOOK_SECRET =
  process.env.LUMA_WEBHOOK_SECRET ?? "test-webhook-secret";
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID ?? "test-aws-key";
process.env.AWS_SECRET_ACCESS_KEY =
  process.env.AWS_SECRET_ACCESS_KEY ?? "test-aws-secret";
process.env.AWS_REGION = process.env.AWS_REGION ?? "us-east-1";
process.env.DISCORD_EVENTS_WEBHOOK_URL =
  process.env.DISCORD_EVENTS_WEBHOOK_URL ?? dummyUrl;
process.env.DISCORD_LOGGING_WEBHOOK_URL =
  process.env.DISCORD_LOGGING_WEBHOOK_URL ?? dummyUrl;
process.env.DISCORD_MOD_ROLE_ID =
  process.env.DISCORD_MOD_ROLE_ID ?? "test-role-id";
process.env.POSTGRES_URL =
  process.env.POSTGRES_URL ?? "postgresql://localhost:5432/test";
process.env.APP_URL = process.env.APP_URL ?? dummyUrl;
