import { sendNotFound, withHandler } from "@/lib/api-response";

const handler = withHandler((): Response => {
  return sendNotFound("API route not found");
});

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
