import "dotenv/config";
import { env } from "@/lib/env";
import { sendDiscordInfo } from "@/lib/discord";
import { createSubscriber, getSubscriberByEmail } from "@/lib/subscribers";

/**
 * Script to import subscribers from Luma calendar.
 *
 * NOTE: Luma API documentation for calendar subscribers is not publicly available.
 * This script may need to be updated once the actual API endpoint is determined.
 * Alternatively, the Luma webhook may already handle new subscribers automatically.
 *
 * Usage: yarn tsx scripts/pull-luma-subscribers.ts
 */
async function main(): Promise<void> {
  console.log("🔍 Starting Luma subscriber import...");

  try {
    // TODO: Replace with actual Luma API endpoint for calendar subscribers
    // Example endpoint might be: GET /api/v1/calendars/{calendar_id}/subscribers
    // You may need a Luma API key: env.get("LUMA_API_KEY")
    const calendarId = env.LUMA_CALENDAR_ID;

    // Placeholder: This would fetch subscribers from Luma API
    // const response = await fetch(
    //   `https://api.luma.com/v1/calendars/${calendarId}/subscribers`,
    //   {
    //     headers: {
    //       Authorization: `Bearer ${lumaApiKey}`,
    //       Accept: "application/json",
    //     },
    //   }
    // );
    //
    // if (!response.ok) {
    //   throw new Error(`Luma API error: ${String(response.status)}`);
    // }
    //
    // const data = await response.json();
    // const subscribers = data.subscribers; // Adjust based on actual API response

    // For now, return early with a message
    console.log(
      "⚠️  Luma subscriber import not yet implemented."
    );
    console.log(
      "    The Luma webhook (/api/webhooks/luma/subscriber) may already handle new subscribers."
    );
    console.log(
      "    If manual import is needed, update this script with the actual Luma API endpoint."
    );
    process.exit(0);

    // Uncomment and implement once API endpoint is known:
    /*
    let newCount = 0;
    let duplicateCount = 0;

    for (const subscriber of subscribers) {
      const email = subscriber.email; // Adjust based on actual API response structure
      
      const existing = await getSubscriberByEmail(email);
      if (existing !== undefined) {
        duplicateCount++;
        continue;
      }

      await createSubscriber({
        email,
        source: "luma",
        status: "verified", // Luma subscribers are already verified
      });
      newCount++;
    }

    await sendDiscordInfo(
      env.DISCORD_LOGGING_WEBHOOK_URL,
      `Luma import complete: ${String(newCount)} new subscribers, ${String(duplicateCount)} duplicates skipped`,
      "Luma Subscriber Import"
    );

    console.log(`✅ Import complete: ${String(newCount)} new, ${String(duplicateCount)} duplicates`);
    */
  } catch (error) {
    console.error("❌ Failed to import Luma subscribers");
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      if (error.stack !== undefined && error.stack.length > 0) {
        console.error(`\n   Stack: ${error.stack}`);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

void main();
