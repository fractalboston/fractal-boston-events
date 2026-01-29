import { Resend } from "resend";
import { z } from "zod";
import {
  sendBadRequest,
  sendInternalError,
  sendSuccess,
} from "@/lib/api-response";
import { env } from "@/lib/env";

const requestSchema = z.object({
  email: z.email(),
});

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

    const { email } = parsed.data;

    try {
      const resend = new Resend(env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Fractal Events <events@fractal.boston>",
        to: email,
        subject: "Test Email from Fractal Events",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
              <h1 style="font-size: 24px; margin-bottom: 16px;">Test Email</h1>
              <p>This is a test email from the Fractal Events notification system.</p>
              <p style="margin-top: 24px; font-size: 14px; color: #666;">
                If you received this email, the email system is working correctly!
              </p>
            </body>
          </html>
        `,
      });

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
