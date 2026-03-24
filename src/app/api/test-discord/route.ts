import { z } from "zod";
import {
  notAllowed,
  sendBadRequest,
  sendInternalError,
  sendNotFound,
  sendSuccess,
  withHandler,
} from "@/lib/api-response";
import { sendDiscordWeeklySummary } from "@/lib/discord";
import { env, isDevelopment } from "@/lib/env";
import { getReportableEvents } from "@/lib/luma";

const requestSchema = z.object({
  asOfDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

type RequestBody = z.infer<typeof requestSchema>;

function parseAsOfDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = (parts[1] ?? 1) - 1;
  const d = parts[2] ?? 1;
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
}

export const GET = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;

export const POST = withHandler(async (request: Request): Promise<Response> => {
  if (!isDevelopment()) {
    return sendNotFound("Not found");
  }
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return sendBadRequest("Invalid JSON body");
    }

    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return sendBadRequest("Invalid request body");
    }

    const { asOfDate: asOfDateStr }: RequestBody = parsed.data;

    const asOfDate =
      asOfDateStr !== undefined ? parseAsOfDate(asOfDateStr) : undefined;

    const events = await getReportableEvents(env.LUMA_CALENDAR_ID, asOfDate);

    await sendDiscordWeeklySummary(
      env.DISCORD_LOGGING_WEBHOOK_URL,
      events,
      env.DISCORD_MOD_ROLE_ID,
      asOfDate
    );

    return sendSuccess({
      message:
        "Test weekly summary sent to Discord logging channel successfully",
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Failed to send test Discord message:", err);
    return sendInternalError(
      `Failed to send test Discord message: ${err.message}`
    );
  }
});
