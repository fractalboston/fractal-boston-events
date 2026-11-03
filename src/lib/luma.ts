import { z } from "zod";
import { env } from "@/lib/env";

/** Minimal event shape used by emails, Discord, and previews. */
export type LumaEvent = {
  api_id: string;
  start_at: string;
  event: {
    name: string;
    url: string;
    cover_url: string;
    start_at: string;
  };
};

const publicEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  start_at: z.string(),
  cover_url: z.string().optional(),
});

const eventListSchema = z.object({
  entries: z.array(z.unknown()),
  has_more: z.boolean(),
  next_cursor: z.string().optional(),
});

function toLumaEvent(entry: z.infer<typeof publicEventSchema>): LumaEvent {
  return {
    api_id: entry.id,
    start_at: entry.start_at,
    event: {
      name: entry.name,
      url: entry.url,
      cover_url: entry.cover_url ?? "",
      start_at: entry.start_at,
    },
  };
}

async function fetchEventsPage({
  after,
  before,
  cursor,
  limit,
}: {
  after: string;
  before: string;
  cursor: string | null;
  limit: number;
}): Promise<{ events: LumaEvent[]; nextCursor: string | null }> {
  const params = new URLSearchParams({
    after,
    before,
    pagination_limit: String(limit),
    sort_column: "start_at",
    sort_direction: "asc",
  });

  // Include managed, listed (view), and external calendar events.
  params.append("access", "manage");
  params.append("access", "view");
  params.append("platforms", "luma");
  params.append("platforms", "external");

  if (cursor !== null) {
    params.set("pagination_cursor", cursor);
  }

  const response = await fetch(
    `https://public-api.luma.com/v1/calendars/events/list?${params}`,
    {
      headers: {
        accept: "application/json",
        "x-luma-api-key": env.LUMA_API_KEY,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Luma API error: ${String(response.status)} - ${text}`);
  }

  const parsed = eventListSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error(`Response validation failed: ${parsed.error.message}`);
  }

  const events: LumaEvent[] = [];
  for (const entry of parsed.data.entries) {
    const eventParsed = publicEventSchema.safeParse(entry);
    if (eventParsed.success) {
      events.push(toLumaEvent(eventParsed.data));
    } else {
      console.warn(
        "Skipping Luma calendar entry that failed validation:",
        eventParsed.error.message
      );
    }
  }

  const nextCursor =
    parsed.data.has_more && parsed.data.next_cursor !== undefined
      ? parsed.data.next_cursor
      : null;

  return { events, nextCursor };
}

/**
 * Gets the set of events that should be reported via email or Discord.
 * Returns events within the next 7 days from the given date (or from now if omitted).
 *
 * Uses the official Luma public API (calendar-scoped API key).
 */
export async function getReportableEvents(
  asOfDate?: Date
): Promise<LumaEvent[]> {
  const windowStart = asOfDate ?? new Date();
  const windowEnd = new Date(windowStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const after = windowStart.toISOString();
  const before = windowEnd.toISOString();

  const allEvents: LumaEvent[] = [];
  const seenEventIds = new Set<string>();

  const paginationLimit = 50;
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchEventsPage({
      after,
      before,
      cursor,
      limit: paginationLimit,
    });

    for (const event of result.events) {
      if (!seenEventIds.has(event.api_id)) {
        seenEventIds.add(event.api_id);
        allEvents.push(event);
      }
    }

    cursor = result.nextCursor;
    hasMore = cursor !== null;
  }

  return allEvents;
}

export function parseLumaSubscriberWebhook(
  payload: unknown
): LumaWebhookSubscriber {
  const parsed = lumaWebhookSubscriberSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Webhook validation failed: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function parseLumaEventCreatedWebhook(
  payload: unknown
): LumaWebhookEventCreated {
  const parsed = lumaWebhookEventCreatedSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Webhook validation failed: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function isEventWithinNextWeek(event: { start_at: string }): boolean {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const eventStart = new Date(event.start_at);

  return eventStart >= now && eventStart <= nextWeek;
}

/** Prefer top-level start_at; fall back to nested event.start_at. */
export function getEventStartAt(event: LumaEvent): string {
  return event.start_at !== "" ? event.start_at : event.event.start_at;
}

const webhookEventSchema = z.object({
  api_id: z.string(),
  name: z.string(),
  start_at: z.string(),
  end_at: z.string(),
  url: z.string(),
  cover_url: z.string().nullable(),
  description: z.string().nullable(),
  geo_address_json: z
    .object({
      city: z.string().optional(),
      address: z.string().optional(),
    })
    .nullable(),
});

const lumaWebhookSubscriberSchema = z.object({
  action: z.literal("calendar_person_subscribed"),
  data: z.object({
    api_id: z.string(),
    calendar_api_id: z.string(),
    user: z.object({
      api_id: z.string(),
      email: z.email(),
      name: z.string().nullable(),
    }),
  }),
});

const lumaWebhookEventCreatedSchema = z.object({
  action: z.literal("event.created"),
  data: z.object({
    event: webhookEventSchema,
  }),
});

export type LumaWebhookSubscriber = z.infer<typeof lumaWebhookSubscriberSchema>;
export type LumaWebhookEventCreated = z.infer<
  typeof lumaWebhookEventCreatedSchema
>;
export type LumaWebhookEvent = z.infer<typeof webhookEventSchema>;

export function convertWebhookEventToLumaEvent(
  webhookEvent: LumaWebhookEvent
): LumaEvent {
  return {
    api_id: webhookEvent.api_id,
    start_at: webhookEvent.start_at,
    event: {
      name: webhookEvent.name,
      url: webhookEvent.url,
      cover_url: webhookEvent.cover_url ?? "",
      start_at: webhookEvent.start_at,
    },
  };
}
