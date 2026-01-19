import { sendSuccess } from "@/lib/api-response";

type HealthResponse = {
  status: string;
  timestamp: string;
};

export function GET(): Response {
  return sendSuccess<HealthResponse>({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
