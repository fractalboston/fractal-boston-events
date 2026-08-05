import { handleGetInvite } from "@/lib/passkey/inviteHandlers";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext
): Promise<Response> {
  const { token } = await context.params;
  return handleGetInvite(request, token);
}
