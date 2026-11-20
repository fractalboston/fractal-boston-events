import { describe, expect, it } from "vitest";
import { parseSesEventMessage } from "@/lib/sesEvents";

describe("parseSesEventMessage", () => {
  it("marks permanent bounces as bounced and lowercases addresses", () => {
    const result = parseSesEventMessage(
      JSON.stringify({
        notificationType: "Bounce",
        bounce: {
          bounceType: "Permanent",
          bouncedRecipients: [
            { emailAddress: "Pat@Example.COM" },
            { emailAddress: "other@example.com" },
          ],
        },
      })
    );
    expect(result?.actions).toEqual([
      { email: "pat@example.com", status: "bounced" },
      { email: "other@example.com", status: "bounced" },
    ]);
    expect(result?.ignored).toEqual([]);
  });

  it("ignores transient bounces", () => {
    const result = parseSesEventMessage(
      JSON.stringify({
        eventType: "Bounce",
        bounce: {
          bounceType: "Transient",
          bouncedRecipients: [{ emailAddress: "full@example.com" }],
        },
      })
    );
    expect(result?.actions).toEqual([]);
    expect(result?.ignored).toEqual([
      { email: "full@example.com", reason: "Ignored Transient bounce" },
    ]);
  });

  it("marks complaints as complained", () => {
    const result = parseSesEventMessage(
      JSON.stringify({
        eventType: "Complaint",
        complaint: {
          complainedRecipients: [{ emailAddress: "User@Hotmail.com" }],
        },
      })
    );
    expect(result?.actions).toEqual([
      { email: "user@hotmail.com", status: "complained" },
    ]);
  });

  it("ignores delivery and other event types", () => {
    const result = parseSesEventMessage(
      JSON.stringify({ eventType: "Delivery", mail: {} })
    );
    expect(result?.actions).toEqual([]);
    expect(result?.ignored[0]?.reason).toMatch(/delivery/i);
  });

  it("returns undefined for non-JSON messages", () => {
    expect(parseSesEventMessage("not json")).toBeUndefined();
  });
});
