import "dotenv/config";

async function main(): Promise<void> {
  const email = process.argv[2];

  if (email === undefined) {
    console.error("Usage: yarn tsx scripts/send-test-email.ts <email>");
    process.exit(1);
  }

  if (email === "" || email.trim().length === 0) {
    console.error("Usage: yarn tsx scripts/send-test-email.ts <email>");
    process.exit(1);
  }

  try {
    const { sendTestEmail } = await import("@/lib/email");
    await sendTestEmail(email);
    console.log(`✅ Test email sent successfully to ${email}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to send test email");
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
