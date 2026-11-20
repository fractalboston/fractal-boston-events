import { describe, expect, it } from "vitest";
import { listUnsubscribeHeaders } from "@/lib/email";

describe("listUnsubscribeHeaders", () => {
  it("returns a List-Unsubscribe header for a page URL", () => {
    const url =
      "https://fractal.boston/unsubscribe?token=aa5e9dc5-fafc-7164-1cbc-1afb1b5d115c";
    expect(listUnsubscribeHeaders(url)).toEqual([
      {
        Name: "List-Unsubscribe",
        Value: `<${url}>`,
      },
    ]);
  });

  it("omits List-Unsubscribe-Post so the confirm-click page is not advertised as one-click", () => {
    const headers = listUnsubscribeHeaders(
      "https://fractal.boston/unsubscribe?token=test"
    );
    expect(headers?.map((header) => header.Name)).toEqual(["List-Unsubscribe"]);
  });

  it("returns undefined when no unsubscribe URL is provided", () => {
    expect(listUnsubscribeHeaders(undefined)).toBeUndefined();
    expect(listUnsubscribeHeaders("")).toBeUndefined();
  });
});
