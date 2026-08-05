import {
  handleCreateInvite,
  handleListInvites,
} from "@/lib/passkey/inviteHandlers";

export async function GET(request: Request): Promise<Response> {
  return handleListInvites(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleCreateInvite(request);
}
