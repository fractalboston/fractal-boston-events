#!/usr/bin/env tsx

/**
 * One-time script to fetch events from Luma for the upcoming week
 * and send them to the Discord events webhook.
 *
 * Usage:
 *   pnpm tsx scripts/send-weekly-events-to-discord.ts
 */
import { config } from "dotenv";

config({ path: ".env" });

async function main(): Promise<void> {
  try {
    const { sendDiscordWeeklySummary } = await import("../src/lib/discord");
    const { env } = await import("../src/lib/env");
    const { getEventStartAt, getReportableEvents } =
      await import("../src/lib/luma");

    console.log("Fetching events from Luma...");
    const events = await getReportableEvents(env.LUMA_CALENDAR_ID);

    console.log(
      `Found ${String(events.length)} event(s) for the upcoming week`
    );

    if (events.length > 0) {
      console.log("Events:");
      events.forEach((event) => {
        console.log(
          `  - ${event.event.name} (${new Date(getEventStartAt(event)).toLocaleString()})`
        );
      });
    }

    console.log("\nSending to Discord...");
    await sendDiscordWeeklySummary(
      env.DISCORD_EVENTS_WEBHOOK_URL,
      events,
      env.DISCORD_MOD_ROLE_ID
    );

    console.log("✅ Successfully sent events to Discord!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

void main();
