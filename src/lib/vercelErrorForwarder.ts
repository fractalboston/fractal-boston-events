import { sendDiscordError } from "@/lib/discord";
import { env } from "@/lib/env";

type ConsoleErrorFn = (...data: unknown[]) => void;

const PATCH_FLAG = Symbol.for("fbEvents.vercelErrorForwarderPatched");
const ORIGINAL_ERROR = Symbol.for("fbEvents.originalConsoleError");
const REPORT_ERROR_PATCH_FLAG = Symbol.for("fbEvents.vercelReportErrorPatched");
const FORWARDING_COUNT_FLAG = Symbol.for("fbEvents.discordForwardingCount");
const MAX_ERROR_TEXT_LENGTH = 1500;

function stringifyErrorArg(arg: unknown): string {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}`;
  }

  if (typeof arg === "string") {
    return arg;
  }

  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function formatErrorArgs(args: unknown[]): string {
  const message = args.map((arg) => stringifyErrorArg(arg)).join(" | ");
  return message.slice(0, MAX_ERROR_TEXT_LENGTH);
}

function getOriginalConsoleError(): ConsoleErrorFn {
  const original = Reflect.get(console, ORIGINAL_ERROR) as
    | ConsoleErrorFn
    | undefined;
  return original ?? console.error.bind(console);
}

export function toError(reason: unknown, fallback: string): Error {
  if (reason instanceof Error) {
    return reason;
  }

  return new Error(stringifyErrorArg(reason) || fallback);
}

function getForwardingCount(): number {
  const count: unknown = Reflect.get(globalThis, FORWARDING_COUNT_FLAG);
  return typeof count === "number" ? count : 0;
}

function incrementForwardingCount(): void {
  Reflect.set(globalThis, FORWARDING_COUNT_FLAG, getForwardingCount() + 1);
}

function decrementForwardingCount(): void {
  const nextCount = Math.max(0, getForwardingCount() - 1);
  Reflect.set(globalThis, FORWARDING_COUNT_FLAG, nextCount);
}

export function reportRuntimeErrorToDiscord({
  error,
  context,
}: {
  error: Error;
  context: string;
}): void {
  // Prevent infinite loops if Discord forwarding itself logs errors.
  if (getForwardingCount() > 0) {
    return;
  }

  incrementForwardingCount();

  void sendDiscordError(env.DISCORD_LOGGING_WEBHOOK_URL, error, context)
    .catch((discordError: unknown) => {
      getOriginalConsoleError()(
        "Failed to forward Vercel log error to Discord:",
        discordError
      );
    })
    .finally(() => {
      decrementForwardingCount();
    });
}

function registerGlobalReportErrorHandler(): void {
  if (Reflect.get(globalThis, REPORT_ERROR_PATCH_FLAG) === true) {
    return;
  }

  const maybeReportError = Reflect.get(globalThis, "reportError");
  if (typeof maybeReportError !== "function") {
    return;
  }

  Reflect.set(globalThis, REPORT_ERROR_PATCH_FLAG, true);
  const originalReportError = maybeReportError as (error: unknown) => void;

  Reflect.set(globalThis, "reportError", (error: unknown): void => {
    originalReportError(error);
    reportRuntimeErrorToDiscord({
      error: toError(error, "Global reportError invocation"),
      context: "Vercel global reportError",
    });
  });
}

export function initializeVercelErrorForwarder(): void {
  if (env.VERCEL === undefined) {
    return;
  }

  registerGlobalReportErrorHandler();

  if (Reflect.get(console, PATCH_FLAG) === true) {
    return;
  }

  const originalError = console.error.bind(console);
  Reflect.set(console, ORIGINAL_ERROR, originalError);
  Reflect.set(console, PATCH_FLAG, true);

  console.error = (...args: unknown[]): void => {
    originalError(...args);

    const errorCandidate = args.find((arg) => arg instanceof Error);
    const error =
      errorCandidate instanceof Error
        ? errorCandidate
        : new Error(formatErrorArgs(args) || "Unknown console.error call");

    reportRuntimeErrorToDiscord({
      error,
      context: "Vercel runtime console.error",
    });
  };
}
