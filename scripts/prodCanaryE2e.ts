import "dotenv/config";
import env from "env-var";
import { Client } from "pg";
import { z } from "zod";

const neynarMailboxSchema = z.object({
  id: z.string(),
  address: z.email(),
  apiKey: z.string(),
});

const apiSuccessSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string(),
  }),
});

const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

const apiResponseSchema = z.union([apiSuccessSchema, apiErrorSchema]);

type SubscriberRecord = {
  email: string;
  token: string;
  status: "pending" | "verified" | "unsubscribed";
};

async function postJson({
  url,
  body,
  timeoutMs = 15000,
}: {
  url: string;
  body: unknown;
  timeoutMs?: number;
}): Promise<{
  status: number;
  body: unknown;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let parsedBody: unknown = null;
    try {
      parsedBody = await response.json();
    } catch {
      parsedBody = null;
    }

    return {
      status: response.status,
      body: parsedBody,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function createMailbox({
  neynarBaseUrl,
  usernamePrefix,
}: {
  neynarBaseUrl: string;
  usernamePrefix: string;
}): Promise<z.infer<typeof neynarMailboxSchema>> {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).slice(2, 8);
  const username = `${usernamePrefix}${datePart}${randomPart}`;

  const response = await postJson({
    url: `${neynarBaseUrl}/v1/mailboxes`,
    body: {
      displayName: "Fractal Canary",
      username,
    },
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `Neynar mailbox create failed with ${String(response.status)}`
    );
  }

  const parsed = neynarMailboxSchema.safeParse(response.body);
  if (!parsed.success) {
    throw new Error(
      `Neynar mailbox response validation failed: ${parsed.error.message}`
    );
  }

  return parsed.data;
}

async function waitForSubscriber({
  dbClient,
  email,
  timeoutMs,
}: {
  dbClient: Client;
  email: string;
  timeoutMs: number;
}): Promise<SubscriberRecord> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const query = await dbClient.query<SubscriberRecord>(
      `select email, token, status
       from subscribers
       where email = $1
       limit 1`,
      [email.toLowerCase()]
    );

    const row = query.rows[0];
    if (row !== undefined) {
      return row;
    }

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 2000);
    });
  }

  throw new Error(
    `Timed out waiting for subscriber row for email: ${email.toLowerCase()}`
  );
}

async function waitForVerified({
  dbClient,
  email,
  timeoutMs,
}: {
  dbClient: Client;
  email: string;
  timeoutMs: number;
}): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const query = await dbClient.query<{ status: string }>(
      `select status
       from subscribers
       where email = $1
       limit 1`,
      [email.toLowerCase()]
    );

    const row = query.rows[0];
    if (row?.status === "verified") {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 2000);
    });
  }

  throw new Error(`Timed out waiting for verified status for ${email}`);
}

async function deleteSubscriber({
  dbClient,
  email,
}: {
  dbClient: Client;
  email: string;
}): Promise<void> {
  await dbClient.query("delete from subscribers where email = $1", [
    email.toLowerCase(),
  ]);
}

async function run(): Promise<void> {
  const prodBaseUrl = env.get("PROD_BASE_URL").required().asUrlString();
  const neynarBaseUrl = env
    .get("NEYNAR_BASE_URL")
    .default("https://email.neynar.ai")
    .asUrlString();
  const postgresUrl = env.get("POSTGRES_URL").required().asString();
  const usernamePrefix = env
    .get("NEYNAR_USERNAME_PREFIX")
    .default("fbcanary")
    .asString();
  const dbWaitTimeoutMs = env
    .get("CANARY_DB_WAIT_TIMEOUT_MS")
    .default("45000")
    .asIntPositive();

  const dbClient = new Client({
    connectionString: postgresUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  let mailboxAddress: string | undefined;

  await dbClient.connect();

  try {
    console.log("Creating Neynar mailbox...");
    const mailbox = await createMailbox({
      neynarBaseUrl,
      usernamePrefix,
    });
    mailboxAddress = mailbox.address.toLowerCase();
    console.log(`Created mailbox: ${mailboxAddress}`);

    console.log("Calling production subscribe endpoint...");
    const subscribeResponse = await postJson({
      url: `${prodBaseUrl}/api/subscribe`,
      body: { email: mailboxAddress },
    });
    if (subscribeResponse.status < 200 || subscribeResponse.status >= 300) {
      throw new Error(
        `Subscribe failed with status ${String(subscribeResponse.status)}`
      );
    }
    const parsedSubscribe = apiResponseSchema.safeParse(subscribeResponse.body);
    if (!parsedSubscribe.success) {
      throw new Error(
        `Subscribe response validation failed: ${parsedSubscribe.error.message}`
      );
    }
    if (!parsedSubscribe.data.success) {
      throw new Error(
        `Subscribe API returned error: ${parsedSubscribe.data.error}`
      );
    }

    console.log("Waiting for subscriber record in production DB...");
    const subscriber = await waitForSubscriber({
      dbClient,
      email: mailboxAddress,
      timeoutMs: dbWaitTimeoutMs,
    });

    if (subscriber.status !== "pending") {
      throw new Error(
        `Expected pending status after subscribe, got: ${subscriber.status}`
      );
    }

    console.log("Calling production verify endpoint...");
    const verifyResponse = await postJson({
      url: `${prodBaseUrl}/api/verify`,
      body: { token: subscriber.token },
    });
    if (verifyResponse.status < 200 || verifyResponse.status >= 300) {
      throw new Error(
        `Verify failed with status ${String(verifyResponse.status)}`
      );
    }
    const parsedVerify = apiResponseSchema.safeParse(verifyResponse.body);
    if (!parsedVerify.success) {
      throw new Error(
        `Verify response validation failed: ${parsedVerify.error.message}`
      );
    }
    if (!parsedVerify.data.success) {
      throw new Error(`Verify API returned error: ${parsedVerify.data.error}`);
    }

    console.log("Waiting for verified status in production DB...");
    await waitForVerified({
      dbClient,
      email: mailboxAddress,
      timeoutMs: dbWaitTimeoutMs,
    });

    console.log("Cleaning up canary subscriber row...");
    await deleteSubscriber({
      dbClient,
      email: mailboxAddress,
    });

    console.log("✅ Production canary E2E completed successfully.");
  } catch (error) {
    if (mailboxAddress !== undefined) {
      try {
        await deleteSubscriber({
          dbClient,
          email: mailboxAddress,
        });
        console.log("Cleanup attempt completed.");
      } catch (cleanupError) {
        console.error("Cleanup attempt failed:", cleanupError);
      }
    }

    throw error;
  } finally {
    await dbClient.end();
  }
}

void run().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`❌ Canary E2E failed: ${error.message}`);
    if (error.stack !== undefined && error.stack.length > 0) {
      console.error(error.stack);
    }
  } else {
    console.error("❌ Canary E2E failed with non-error value:", error);
  }

  process.exit(1);
});
