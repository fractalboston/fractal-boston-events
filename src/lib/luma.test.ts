import { describe, expect, it } from "vitest";
import { isEventWithinNextWeek } from "@/lib/luma";

function createMockEvent(startAt: Date): { start_at: string } {
  return {
    start_at: startAt.toISOString(),
  };
}

describe("isEventWithinNextWeek", () => {
  it("returns true for event tomorrow", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const event = createMockEvent(tomorrow);
    expect(isEventWithinNextWeek(event)).toBe(true);
  });

  it("returns true for event in 6 days", () => {
    const sixDays = new Date();
    sixDays.setDate(sixDays.getDate() + 6);
    const event = createMockEvent(sixDays);
    expect(isEventWithinNextWeek(event)).toBe(true);
  });

  it("returns false for event in 8 days", () => {
    const eightDays = new Date();
    eightDays.setDate(eightDays.getDate() + 8);
    const event = createMockEvent(eightDays);
    expect(isEventWithinNextWeek(event)).toBe(false);
  });

  it("returns false for past event", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const event = createMockEvent(yesterday);
    expect(isEventWithinNextWeek(event)).toBe(false);
  });
});
