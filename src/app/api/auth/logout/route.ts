import { handleLogout } from "@/lib/passkey/handlers";

export async function POST(request: Request): Promise<Response> {
  return handleLogout(request);
}
