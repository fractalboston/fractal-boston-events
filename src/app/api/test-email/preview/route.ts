import { sendInternalError, sendSuccess } from "@/lib/api-response";
import { type EmailContent, getEmailContent } from "@/lib/email";
import { env, isDevelopment } from "@/lib/env";
import { getReportableEvents } from "@/lib/luma";

function parseAsOfDate(dateStr: string | null): Date | null {
  if (!dateStr || dateStr.trim() === "") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number.parseInt(y ?? "0", 10);
  const month = Number.parseInt(m ?? "0", 10) - 1;
  const day = Number.parseInt(d ?? "0", 10);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function GET(request: Request): Promise<Response> {
  if (!isDevelopment()) {
    return new Response(null, { status: 404 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const asOfDate = parseAsOfDate(dateParam) ?? new Date();

    const events = await getReportableEvents(env.LUMA_CALENDAR_ID, asOfDate);
    const content: EmailContent = getEmailContent(events, true);

    return sendSuccess(content);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Test email preview error:", err);
    return sendInternalError(`Failed to generate preview: ${err.message}`);
  }
}
