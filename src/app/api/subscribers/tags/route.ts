import { sendInternalError, sendSuccess } from "@/lib/api-response";
import { isSessionUser, requireSession } from "@/lib/passkey/requireSession";
import { listSubscriberTags } from "@/lib/subscribers";

export async function GET(request: Request): Promise<Response> {
  const auth = await requireSession(request);
  if (!isSessionUser(auth)) {
    return auth;
  }
  try {
    const tags = await listSubscriberTags();
    return sendSuccess({ tags });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Tag list error:", err);
    return sendInternalError(`Tag list failed: ${err.message}`);
  }
}
