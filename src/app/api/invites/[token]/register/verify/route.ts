import { handleInviteRegisterVerify } from "@/lib/passkey/inviteHandlers";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext
): Promise<Response> {
  const { token } = await context.params;
  return handleInviteRegisterVerify({ request, token });
}
