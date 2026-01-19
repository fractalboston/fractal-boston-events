import { z } from "zod";

const lumaEventSchema = z.object({
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

const lumaEventsResponseSchema = z.object({
  entries: z.array(
    z.object({
      event: lumaEventSchema,
    })
  ),
  has_more: z.boolean(),
  next_cursor: z.string().nullable(),
});

export type LumaEvent = z.infer<typeof lumaEventSchema>;

export async function fetchUpcomingEvents(
  apiKey: string,
  calendarId: string
): Promise<LumaEvent[]> {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    calendar_api_id: calendarId,
    after: now.toISOString(),
    before: nextWeek.toISOString(),
  });

  const response = await fetch(
    `https://api.lu.ma/public/v1/calendar/list-events?${params}`,
    {
      headers: {
        accept: "application/json",
        "x-luma-api-key": apiKey,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Luma API error: ${String(response.status)} - ${text}`);
  }

  const json: unknown = await response.json();
  const parsed = lumaEventsResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(`Response validation failed: ${parsed.error.message}`);
  }

  return parsed.data.entries.map((entry) => entry.event);
}

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
    event: lumaEventSchema,
  }),
});

export type LumaWebhookSubscriber = z.infer<typeof lumaWebhookSubscriberSchema>;
export type LumaWebhookEventCreated = z.infer<
  typeof lumaWebhookEventCreatedSchema
>;

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

export function isEventWithinNextWeek(event: LumaEvent): boolean {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const eventStart = new Date(event.start_at);

  return eventStart >= now && eventStart <= nextWeek;
}
