import { handleSetupOptions } from "@/lib/passkey/handlers";

export async function POST(request: Request): Promise<Response> {
  return handleSetupOptions(request);
}
