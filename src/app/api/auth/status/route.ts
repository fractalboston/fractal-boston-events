import { handleAuthStatus } from "@/lib/passkey/handlers";

export async function GET(request: Request): Promise<Response> {
  return handleAuthStatus(request);
}
