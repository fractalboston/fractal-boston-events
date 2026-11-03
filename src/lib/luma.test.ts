import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getReportableEvents,
  isEventWithinNextWeek,
  isPubliclyReportableEvent,
  parseEventListPage,
  parseReportableCalendarEntry,
} from "@/lib/luma";

function createMockEvent(startAt: Date): { start_at: string } {
  return {
    start_at: startAt.toISOString(),
  };
}

/** Shape observed live for a managed Luma event (trimmed to fields we parse). */
const managedLumaEvent = {
  id: "evt-LTk5GuDELSX9ybH",
  platform: "luma",
  access: "manage",
  visibility: "public",
  name: "Coworking @ Phinista",
  url: "https://luma.com/16hjhu4k",
  start_at: "2026-11-04T15:00:00.000Z",
  cover_url: "https://images.lumacdn.com/example.jpg",
  calendar_id: "cal-example",
  user_id: "usr-example",
};

/** Shape observed live for a listed (view) Luma event on this calendar. */
const listedLumaEvent = {
  id: "evt-nI2XfNhgAGRdY0t",
  platform: "luma",
  access: "view",
  visibility: "public",
  name: "Chocolate factory tour in Somerville (Taza)",
  url: "https://luma.com/dlj7u11r",
  start_at: "2026-11-07T18:15:00.000Z",
  cover_url: "https://images.lumacdn.com/example2.jpg",
  calendar_id: "cal-other",
  user_id: "usr-other",
};

/**
 * OpenAPI ExternalEvent required fields (no visibility / cover_url).
 * This calendar currently has zero external listings, so this is contract-based.
 */
const externalEvent = {
  id: "ext-abc123",
  platform: "external",
  calendar_id: "cal-example",
  start_at: "2026-11-08T18:00:00.000Z",
  duration_interval: "PT2H",
  end_at: "2026-11-08T20:00:00.000Z",
  created_at: "2026-10-01T12:00:00.000Z",
  timezone: "America/New_York",
  name: "Community Meetup (Meetup.com)",
  geo_address_json: { city: "Boston" },
  coordinate: { latitude: 42.36, longitude: -71.06 },
  url: "https://www.meetup.com/example/events/123",
  host: "Example Organizer",
};

describe("isPubliclyReportableEvent", () => {
  const base = {
    id: "evt_1",
    name: "Test",
    url: "https://luma.com/test",
    start_at: "2026-11-04T15:00:00.000Z",
  };

  it("allows public events", () => {
    expect(isPubliclyReportableEvent({ ...base, visibility: "public" })).toBe(
      true
    );
  });

  it("allows external listings without visibility", () => {
    expect(isPubliclyReportableEvent(base)).toBe(true);
  });

  it("excludes private and members-only events", () => {
    expect(isPubliclyReportableEvent({ ...base, visibility: "private" })).toBe(
      false
    );
    expect(
      isPubliclyReportableEvent({ ...base, visibility: "members-only" })
    ).toBe(false);
  });
});

describe("parseReportableCalendarEntry", () => {
  it("maps managed Luma events", () => {
    expect(parseReportableCalendarEntry(managedLumaEvent)).toEqual({
      api_id: managedLumaEvent.id,
      start_at: managedLumaEvent.start_at,
      event: {
        name: managedLumaEvent.name,
        url: managedLumaEvent.url,
        cover_url: managedLumaEvent.cover_url,
        start_at: managedLumaEvent.start_at,
      },
    });
  });

  it("maps listed (access=view) Luma events", () => {
    const parsed = parseReportableCalendarEntry(listedLumaEvent);
    expect(parsed?.api_id).toBe(listedLumaEvent.id);
    expect(parsed?.event.name).toBe(listedLumaEvent.name);
  });

  it("maps OpenAPI external events without cover_url or visibility", () => {
    const parsed = parseReportableCalendarEntry(externalEvent);
    expect(parsed).toEqual({
      api_id: externalEvent.id,
      start_at: externalEvent.start_at,
      event: {
        name: externalEvent.name,
        url: externalEvent.url,
        cover_url: "",
        start_at: externalEvent.start_at,
      },
    });
  });

  it("rejects private managed events", () => {
    expect(
      parseReportableCalendarEntry({
        ...managedLumaEvent,
        visibility: "private",
      })
    ).toBeNull();
  });

  it("rejects entries missing required fields", () => {
    expect(parseReportableCalendarEntry({ id: "evt-x" })).toBeNull();
  });
});

describe("parseEventListPage pagination contract", () => {
  it("returns nextCursor when has_more and next_cursor are present", () => {
    const page = parseEventListPage({
      entries: [managedLumaEvent],
      has_more: true,
      next_cursor: "cursor-page-2",
    });
    expect(page.events).toHaveLength(1);
    expect(page.nextCursor).toBe("cursor-page-2");
  });

  it("returns null nextCursor when has_more is false", () => {
    const page = parseEventListPage({
      entries: [managedLumaEvent],
      has_more: false,
      next_cursor: "should-be-ignored",
    });
    expect(page.nextCursor).toBeNull();
  });

  it("returns null nextCursor when has_more is true but next_cursor is missing", () => {
    const page = parseEventListPage({
      entries: [managedLumaEvent],
      has_more: true,
    });
    expect(page.nextCursor).toBeNull();
  });

  it("filters non-public entries while preserving pagination cursor", () => {
    const page = parseEventListPage({
      entries: [
        managedLumaEvent,
        { ...managedLumaEvent, id: "evt-private", visibility: "private" },
        externalEvent,
      ],
      has_more: true,
      next_cursor: "cursor-next",
    });
    expect(page.events.map((event) => event.api_id)).toEqual([
      managedLumaEvent.id,
      externalEvent.id,
    ]);
    expect(page.nextCursor).toBe("cursor-next");
  });

  it("throws on invalid list envelopes", () => {
    expect(() => parseEventListPage({ entries: [] })).toThrow(
      /Response validation failed/
    );
  });
});

describe("getReportableEvents pagination", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("follows next_cursor across pages and dedupes ids", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: (): Promise<unknown> =>
          Promise.resolve({
            entries: [managedLumaEvent],
            has_more: true,
            next_cursor: "cursor-2",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: (): Promise<unknown> =>
          Promise.resolve({
            entries: [listedLumaEvent, managedLumaEvent],
            has_more: false,
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const events = await getReportableEvents(
      new Date("2026-11-03T00:00:00.000Z")
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = String(fetchMock.mock.calls[0]?.[0]);
    const secondUrl = String(fetchMock.mock.calls[1]?.[0]);
    expect(firstUrl).toContain("pagination_limit=50");
    expect(firstUrl).not.toContain("pagination_cursor=");
    expect(secondUrl).toContain("pagination_cursor=cursor-2");
    expect(secondUrl).toContain("platforms=luma");
    expect(secondUrl).toContain("platforms=external");
    expect(secondUrl).toContain("access=manage");
    expect(secondUrl).toContain("access=view");

    expect(events.map((event) => event.api_id)).toEqual([
      managedLumaEvent.id,
      listedLumaEvent.id,
    ]);
  });
});

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
