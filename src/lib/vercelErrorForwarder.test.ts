import { describe, expect, it } from "vitest";
import { isIgnorableNodeWarning } from "@/lib/vercelErrorForwarder";

describe("isIgnorableNodeWarning", () => {
  it("ignores ExperimentalWarning by name", () => {
    const warning = new Error(
      "vm.USE_MAIN_CONTEXT_DEFAULT_LOADER is an experimental feature and might change at any time"
    );
    warning.name = "ExperimentalWarning";

    expect(isIgnorableNodeWarning(warning)).toBe(true);
  });

  it("ignores console.error strings emitted for Node warnings", () => {
    const warning = new Error(
      "(node:4) ExperimentalWarning: vm.USE_MAIN_CONTEXT_DEFAULT_LOADER is an experimental feature and might change at any time"
    );

    expect(isIgnorableNodeWarning(warning)).toBe(true);
  });

  it("forwards real application errors", () => {
    const error = new Error("Database connection failed");

    expect(isIgnorableNodeWarning(error)).toBe(false);
  });
});
