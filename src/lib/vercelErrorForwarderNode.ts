import {
  reportRuntimeErrorToDiscord,
  toError,
} from "@/lib/vercelErrorForwarder";

const PROCESS_HANDLERS_FLAG = Symbol.for(
  "fbEvents.vercelProcessHandlersPatched"
);

export function registerProcessErrorHandlers(): void {
  if (Reflect.get(globalThis, PROCESS_HANDLERS_FLAG) === true) {
    return;
  }

  Reflect.set(globalThis, PROCESS_HANDLERS_FLAG, true);

  process.on("uncaughtException", (error: Error) => {
    reportRuntimeErrorToDiscord({
      error,
      context: "Vercel uncaughtException",
    });
  });

  process.on("unhandledRejection", (reason: unknown) => {
    reportRuntimeErrorToDiscord({
      error: toError(reason, "Unhandled promise rejection"),
      context: "Vercel unhandledRejection",
    });
  });

  process.on("warning", (warning: Error) => {
    reportRuntimeErrorToDiscord({
      error: warning,
      context: "Vercel process warning",
    });
  });

  // Do not listen for `multipleResolves`: Node deprecated/removed it (DEP0160)
  // because Promise.all / Promise.race and framework internals trigger it as
  // false positives. Forwarding it flooded Discord with noise.
}
