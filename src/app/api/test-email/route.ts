import { z } from "zod";
import {
  sendBadRequest,
  sendInternalError,
  sendSuccess,
} from "@/lib/api-response";
import { sendTestEmail } from "@/lib/email";

const requestSchema = z.object({
  email: z.email(),
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

export async function POST(request: Request): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return sendBadRequest("Invalid JSON body");
    }

    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return sendBadRequest("Invalid email address");
    }

    const { email, asOfDate: asOfDateStr }: RequestBody = parsed.data;

    const asOfDate =
      asOfDateStr !== undefined ? parseAsOfDate(asOfDateStr) : undefined;

    try {
      await sendTestEmail(email, asOfDate);

      return sendSuccess({ message: "Test email sent successfully" });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Failed to send test email:", err);
      return sendInternalError(`Failed to send test email: ${err.message}`);
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Test email route error:", err);
    return sendInternalError(`Failed to process request: ${err.message}`);
  }
}
