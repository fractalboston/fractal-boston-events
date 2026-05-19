import {
  initializeVercelErrorForwarder,
  reportRuntimeErrorToDiscord,
} from "@/lib/vercelErrorForwarder";

export async function register(): Promise<void> {
  initializeVercelErrorForwarder();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerProcessErrorHandlers } =
      await import("@/lib/vercelErrorForwarderNode");
    registerProcessErrorHandlers();
  }
}

export function onRequestError(
  error: Error & { digest?: string },
  request: { method?: string; url?: string },
  context: { routerKind?: string; routePath?: string; routeType?: string }
): void {
  const method = request.method ?? "UNKNOWN";
  const requestUrl = request.url ?? "UNKNOWN_URL";
  const routePath = context.routePath ?? "unknown";
  const routeType = context.routeType ?? "unknown";
  const routerKind = context.routerKind ?? "unknown";
  const digestSuffix =
    error.digest !== undefined ? ` [digest=${error.digest}]` : "";

  reportRuntimeErrorToDiscord({
    error,
    context: `Vercel onRequestError ${method} ${requestUrl} (path=${routePath}, type=${routeType}, router=${routerKind})${digestSuffix}`,
  });
}
