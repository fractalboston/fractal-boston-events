import "dotenv/config";
import env from "env-var";
import { db } from "@/db";

async function testConnection(): Promise<void> {
  try {
    const postgresUrl = env.get("POSTGRES_URL").required().asString();

    // Show connection info (masked password)
    const urlObj = new URL(postgresUrl);
    const maskedUrl = `${urlObj.protocol}//${urlObj.username}:***@${urlObj.hostname}:${urlObj.port}${urlObj.pathname}`;
    console.log("Testing database connection...");
    console.log(`   Connection: ${maskedUrl}`);
    console.log(
      `   Port: ${urlObj.port} (should be 6543 for Transaction Mode)`
    );

    if (urlObj.port !== "6543") {
      console.warn(
        "⚠️  Warning: Port is not 6543. For serverless/Vercel, use Transaction Mode (port 6543)"
      );
    }

    // Test 1: Simple query to verify connection
    const result = await db
      .selectFrom("subscribers")
      .select(db.fn.countAll().as("count"))
      .executeTakeFirst();

    console.log("✅ Database connection successful!");
    const count = result?.count ?? 0;
    console.log(`   Found ${String(count)} subscribers in database`);

    // Test 2: Verify we can query the table structure
    await db
      .selectFrom("subscribers")
      .select(["id", "email", "status"])
      .limit(1)
      .executeTakeFirst();

    console.log("✅ Database query test passed!");
    console.log(
      "   Connection pooler is working correctly with Transaction Mode"
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ Database connection failed!");
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);

      // Check if it's a connection issue
      if (
        error.message.includes("EHOSTUNREACH") ||
        error.message.includes("ECONNREFUSED")
      ) {
        console.error("\n   Troubleshooting:");
        console.error(
          "   1. Verify your POSTGRES_URL uses port 6543 (Transaction Mode)"
        );
        console.error("   2. Get the correct connection string from:");
        console.error(
          "      Supabase Dashboard → Settings → Database → Connect → Transaction mode"
        );
        console.error(
          "   3. Format should be: postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:6543/postgres"
        );
        console.error(
          "   4. Make sure you're using your DATABASE password, not your API keys"
        );
      }

      if (error.stack !== undefined && error.stack.length > 0) {
        console.error(`\n   Stack: ${error.stack}`);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

void testConnection();
