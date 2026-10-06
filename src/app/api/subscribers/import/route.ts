import { z } from "zod";
import {
  sendBadRequest,
  sendInternalError,
  sendSuccess,
} from "@/lib/api-response";
import { sendDiscordInfo } from "@/lib/discord";
import { env } from "@/lib/env";
import { isSessionUser, requireSession } from "@/lib/passkey/requireSession";
import { importSubscribers, subscriberTagSchema } from "@/lib/subscribers";

const bodySchema = z.object({
  emails: z.array(z.string()).min(1).max(1000),
  tag: subscriberTagSchema,
});

const emailSchema = z.email();

export async function POST(request: Request): Promise<Response> {
  const auth = await requireSession(request);
  if (!isSessionUser(auth)) {
    return auth;
  }
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return sendBadRequest("Invalid JSON body");
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return sendBadRequest(parsed.error.message);
    }

    // Invalid lines are reported back, not fatal - a pasted list with one
    // typo should import the rest. The 254-char cap is the practical email
    // maximum and keeps every address inside the column width.
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const raw of parsed.data.emails) {
      const email = raw.trim().toLowerCase();
      if (email === "") {
        continue;
      }
      if (email.length <= 254 && emailSchema.safeParse(email).success) {
        valid.push(email);
      } else {
        invalid.push(raw.trim().slice(0, 100));
      }
    }

    const result =
      valid.length > 0
        ? await importSubscribers({ emails: valid, tag: parsed.data.tag })
        : { added: [], alreadySubscribed: [], suppressed: [] };

    if (result.added.length > 0 || result.alreadySubscribed.length > 0) {
      await sendDiscordInfo({
        webhookUrl: env.DISCORD_LOGGING_WEBHOOK_URL,
        message: `Imported tag **${parsed.data.tag}**: ${String(result.added.length)} added as unconfirmed, ${String(result.alreadySubscribed.length)} already subscribed (tagged), ${String(result.suppressed.length)} suppressed skipped, ${String(invalid.length)} invalid lines`,
        title: "Subscriber Import",
      });
    }

    return sendSuccess({
      tag: parsed.data.tag,
      added: result.added,
      alreadySubscribed: result.alreadySubscribed,
      suppressed: result.suppressed,
      invalid,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Subscriber import error:", err);
    return sendInternalError(`Import failed: ${err.message}`);
  }
}
