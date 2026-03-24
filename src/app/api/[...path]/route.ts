import { sendNotFound } from "@/lib/api-response";

function handler(): ReturnType<typeof sendNotFound> {
  return sendNotFound("API route not found");
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
