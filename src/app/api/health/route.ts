import { notAllowed, sendSuccess, withHandler } from "@/lib/api-response";

type HealthResponse = {
  status: string;
  timestamp: string;
};

export const GET = withHandler((): Response => {
  return sendSuccess<HealthResponse>({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
