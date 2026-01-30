import "dotenv/config";
import { sendDiscordInfo } from "@/lib/discord";
import { env } from "@/lib/env";
import { createSubscriber, getSubscriberByEmail } from "@/lib/subscribers";

/**
 * Script to import subscribers from Substack.
 *
 * NOTE: Substack does not appear to have a public API endpoint for subscriber lists.
 * Options:
 * 1. Use Substack's CSV export feature and parse the file
 * 2. Contact Substack support for API access
 * 3. Use a third-party integration if available
 *
 * This script currently expects SUBSTACK_API_KEY, but may need to be updated
 * to use CSV file parsing instead.
 *
 * Usage: yarn tsx scripts/pull-substack-subscribers.ts
 */
async function main(): Promise<void> {
  console.log("🔍 Starting Substack subscriber import...");

  try {
    // Option 1: If Substack API is available (may require special access)
    // const substackApiKey = env.SUBSTACK_API_KEY;
    // const publicationId = env.SUBSTACK_PUBLICATION_ID; // May need to add this
    //
    // const response = await fetch(
    //   `https://api.substack.com/v1/publications/${publicationId}/subscribers`,
    //   {
    //     headers: {
    //       Authorization: `Bearer ${substackApiKey}`,
    //       Accept: "application/json",
    //     },
    //   }
    // );
    //
    // if (!response.ok) {
    //   throw new Error(`Substack API error: ${String(response.status)}`);
    // }
    //
    // const data = await response.json();
    // const subscribers = data.subscribers; // Adjust based on actual API response

    // Option 2: CSV file parsing (if using Substack export)
    // const csvPath = process.argv[2];
    // if (!csvPath) {
    //   console.error("Usage: yarn tsx scripts/pull-substack-subscribers.ts <path-to-substack-export.csv>");
    //   process.exit(1);
    // }
    //
    // const csvContent = await fs.readFile(csvPath, "utf-8");
    // const lines = csvContent.split("\n");
    // const headers = lines[0].split(",");
    // const emailIndex = headers.indexOf("email"); // Adjust based on CSV structure
    //
    // const subscribers = lines.slice(1)
    //   .map((line) => {
    //     const values = line.split(",");
    //     return values[emailIndex];
    //   })
    //   .filter((email) => email && email.includes("@"));

    // For now, return early with a message
    console.log("⚠️  Substack subscriber import not yet implemented.");
    console.log(
      "    Substack does not appear to have a public API for subscriber lists."
    );
    console.log("    Options:");
    console.log("    1. Export subscribers CSV from Substack dashboard");
    console.log("    2. Update this script to parse CSV file");
    console.log("    3. Contact Substack support for API access");
    process.exit(0);

    // Uncomment and implement once import method is determined:
    /*
    let newCount = 0;
    let duplicateCount = 0;

    for (const email of subscribers) {
      const existing = await getSubscriberByEmail(email);
      if (existing !== undefined) {
        duplicateCount++;
        continue;
      }

      await createSubscriber({
        email,
        source: "substack",
        status: "verified", // Substack subscribers are already verified
      });
      newCount++;
    }

    await sendDiscordInfo({
      webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
      message: `Substack import complete: ${String(newCount)} new subscribers, ${String(duplicateCount)} duplicates skipped`,
      title: "Substack Subscriber Import",
    });

    console.log(`✅ Import complete: ${String(newCount)} new, ${String(duplicateCount)} duplicates`);
    */
  } catch (error) {
    console.error("❌ Failed to import Substack subscribers");
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
