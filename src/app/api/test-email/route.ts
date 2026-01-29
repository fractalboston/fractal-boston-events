import { z } from "zod";
import {
  sendBadRequest,
  sendInternalError,
  sendSuccess,
} from "@/lib/api-response";
import { sendTestEmail } from "@/lib/email";

const requestSchema = z.object({
  email: z.email(),
});

type RequestBody = z.infer<typeof requestSchema>;

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

    const { email }: RequestBody = parsed.data;

    try {
      await sendTestEmail(email);

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
