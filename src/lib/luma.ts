import { z } from "zod";

async function fetchEventsPage(
  calendarId: string,
  limit: number,
  cursor: string | null = null
): Promise<{ events: LumaEvent[]; nextCursor: string | null }> {
  const params = new URLSearchParams({
    calendar_api_id: calendarId,
    pagination_limit: String(limit),
    period: "future",
  });

  if (cursor !== null) {
    params.append("pagination_cursor", cursor);
  }

  const response = await fetch(
    `https://api2.luma.com/calendar/get-items?${params}`,
    {
      headers: {
        accept: "application/json",
        // "x-luma-api-key": apiKey,
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

  // Map entry.event (eventDetailSchema) to LumaEvent format
  const events = parsed.data.entries;

  // Determine next cursor: use pagination_cursor if available, otherwise use last entry's api_id if has_more
  let nextCursor: string | null = null;
  if (parsed.data.has_more) {
    nextCursor =
      parsed.data.pagination_cursor ??
      (events.length > 0 ? (events[events.length - 1]?.api_id ?? null) : null);
  }

  return {
    events,
    nextCursor,
  };
}

export async function fetchUpcomingEvents(
  calendarId: string
): Promise<LumaEvent[]> {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const allEvents: LumaEvent[] = [];
  const seenEventIds = new Set<string>();

  // Helper to add events and track duplicates, filtering to next week
  const addEvents = (events: LumaEvent[]): void => {
    for (const event of events) {
      if (!seenEventIds.has(event.api_id)) {
        const eventStart = new Date(event.start_at);
        // Only include events within the next week
        if (eventStart >= now && eventStart <= nextWeek) {
          seenEventIds.add(event.api_id);
          allEvents.push(event);
        }
      }
    }
  };

  // Fetch all pages of events using the new api2.luma.com endpoint
  // This endpoint returns both managed events and events listed on the calendar
  const paginationLimit = 50;
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchEventsPage(calendarId, paginationLimit, cursor);
    addEvents(result.events);
    cursor = result.nextCursor;
    hasMore = cursor !== null;
  }

  return allEvents;
}

/**
 * Gets the set of events that should be reported via email or Discord.
 * This is the single source of truth for determining which events to notify about.
 * Returns events within the next 7 days.
 */
export async function getReportableEvents(
  calendarId: string
): Promise<LumaEvent[]> {
  return fetchUpcomingEvents(calendarId);
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
// Zod schemas for the api2.luma.com/calendar/get-items response
const coordinateSchema = z.object({
  longitude: z.number(),
  latitude: z.number(),
});

const coordinate2Schema = z.object({
  longitude: z.number(),
  latitude: z.number(),
});

const virtualInfoSchema = z.object({
  has_access: z.boolean(),
});

const geoAddressInfoSchema = z.object({
  city: z.string(),
  type: z.string().optional(),
  region: z.string().optional(),
  address: z.string().optional(),
  country: z.string().optional(),
  place_id: z.string().optional(),
  localized: z.unknown(),
  city_state: z.string(),
  description: z.string().optional(),
  sublocality: z.string().optional(),
  country_code: z.string().optional(),
  full_address: z.string().optional(),
  short_address: z.string().optional(),
  apple_maps_place_id: z.string().nullish(),
  mode: z.string(),
});

const neutralSchema = z.object({
  color: z.string(),
  percentage: z.number(),
});

const vibrantSchema = z.object({
  color: z.string(),
  percentage: z.number(),
});

const paletteSchema = z.object({
  neutral: z.array(neutralSchema),
  vibrant: z.array(vibrantSchema),
});

const coverImageSchema = z.object({
  vibrant_color: z.unknown(),
  colors: z.array(z.string()),
  palette: paletteSchema.nullable(),
});

const personalUserSchema = z.object({
  api_id: z.string(),
  avatar_url: z.string(),
  bio_short: z.string().nullable(),
  instagram_handle: z.unknown(),
  is_verified: z.boolean(),
  last_online_at: z.string(),
  linkedin_handle: z.string().nullable(),
  name: z.string(),
  tiktok_handle: z.unknown(),
  timezone: z.string(),
  twitter_handle: z.string().nullable(),
  username: z.string().nullable(),
  website: z.unknown(),
  youtube_handle: z.string().nullable(),
});

const calendarSchema = z.object({
  access_level: z.string(),
  api_id: z.string(),
  avatar_url: z.string(),
  coordinate: coordinate2Schema.nullable(),
  cover_image_url: z.string(),
  description_short: z.string().nullable(),
  event_submission_restriction: z.string(),
  geo_city: z.string().nullable(),
  geo_country: z.string().nullable(),
  geo_region: z.string().nullable(),
  google_measurement_id: z.unknown(),
  instagram_handle: z.unknown(),
  is_blocked: z.boolean(),
  launch_status: z.string(),
  linkedin_handle: z.unknown(),
  luma_plus_active: z.boolean(),
  meta_pixel_id: z.unknown(),
  name: z.string(),
  personal_user_api_id: z.string().nullable(),
  refund_policy: z.unknown(),
  slug: z.string().nullable(),
  social_image_url: z.unknown(),
  stripe_account_id: z.unknown(),
  tax_config: z.unknown(),
  tiktok_handle: z.unknown(),
  timezone: z.string().nullable(),
  tint_color: z.string(),
  track_meta_ads_from_luma: z.boolean(),
  twitter_handle: z.unknown(),
  verified_at: z.string().nullable(),
  website: z.string().nullable(),
  youtube_handle: z.unknown(),
  is_personal: z.boolean(),
  personal_user: personalUserSchema.nullable(),
});

const hostSchema = z.object({
  name: z.string(),
  api_id: z.string(),
  website: z.unknown(),
  timezone: z.string(),
  username: z.string().nullable(),
  bio_short: z.string().nullable(),
  avatar_url: z.string(),
  is_verified: z.boolean(),
  tiktok_handle: z.unknown(),
  last_online_at: z.string(),
  twitter_handle: z.string().nullable(),
  youtube_handle: z.string().nullable(),
  linkedin_handle: z.string().nullable(),
  instagram_handle: z.unknown(),
});

const featuredGuestSchema = z.object({
  api_id: z.string(),
  avatar_url: z.string(),
  bio_short: z.string().nullable(),
  instagram_handle: z.string().nullable(),
  is_verified: z.boolean(),
  last_online_at: z.string(),
  linkedin_handle: z.string().nullable(),
  name: z.string(),
  tiktok_handle: z.unknown(),
  timezone: z.string(),
  twitter_handle: z.unknown(),
  username: z.string().nullable(),
  website: z.unknown(),
  youtube_handle: z.string().nullable(),
});

const ticketInfoSchema = z.object({
  price: z.unknown(),
  is_free: z.boolean(),
  max_price: z.unknown(),
  is_sold_out: z.boolean(),
  spots_remaining: z.number().nullable(),
  is_near_capacity: z.boolean(),
  require_approval: z.boolean(),
  currency_info: z.unknown(),
});

const eventDetailSchema = z.object({
  api_id: z.string(),
  calendar_api_id: z.string(),
  cover_url: z.string(),
  end_at: z.string(),
  event_type: z.string(),
  hide_rsvp: z.boolean(),
  location_type: z.string(),
  name: z.string(),
  one_to_one: z.boolean(),
  recurrence_id: z.unknown(),
  show_guest_list: z.boolean(),
  start_at: z.string(),
  timezone: z.string(),
  url: z.string(),
  user_api_id: z.string(),
  visibility: z.string(),
  virtual_info: virtualInfoSchema,
  geo_address_info: geoAddressInfoSchema,
  geo_address_visibility: z.string(),
  coordinate: coordinateSchema,
  waitlist_enabled: z.boolean(),
  waitlist_status: z.string(),
});

const eventSchema = z.object({
  api_id: z.string(),
  event: eventDetailSchema,
  cover_image: coverImageSchema,
  calendar: calendarSchema,
  start_at: z.string(),
  hosts: z.array(hostSchema),
  guest_count: z.number(),
  ticket_count: z.number(),
  ticket_info: ticketInfoSchema,
  featured_guests: z.array(featuredGuestSchema),
  role: z.unknown(),
  waitlist_active: z.boolean(),
  featured_city: z.unknown(),
  calendar_api_id: z.string(),
  is_manager: z.boolean(),
  platform: z.string(),
  status: z.string(),
  submitted_by_user_api_id: z.string(),
  tags: z.array(z.unknown()),
});

const eventListSchema = z.object({
  entries: z.array(eventSchema),
  has_more: z.boolean(),
  pagination_cursor: z.string().nullable().optional(),
});

export type LumaEvent = z.infer<typeof eventSchema>;

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
    event: {
      api_id: webhookEvent.api_id,
      calendar_api_id: "",
      cover_url: webhookEvent.cover_url ?? "",
      end_at: webhookEvent.end_at,
      event_type: "event",
      hide_rsvp: false,
      location_type:
        webhookEvent.geo_address_json !== null ? "physical" : "virtual",
      name: webhookEvent.name,
      one_to_one: false,
      recurrence_id: null,
      show_guest_list: true,
      start_at: webhookEvent.start_at,
      timezone: "America/New_York",
      url: webhookEvent.url,
      user_api_id: "",
      visibility: "public",
      virtual_info: {
        has_access: false,
      },
      geo_address_info: webhookEvent.geo_address_json
        ? {
            city: webhookEvent.geo_address_json.city ?? "",
            type: "point_of_interest",
            mode: "manual",
            city_state: webhookEvent.geo_address_json.city ?? "",
            localized: null,
          }
        : {
            city: "",
            type: "point_of_interest",
            mode: "manual",
            city_state: "",
            localized: null,
          },
      geo_address_visibility: "public",
      coordinate: {
        longitude: 0,
        latitude: 0,
      },
      waitlist_enabled: false,
      waitlist_status: "none",
    },
    cover_image: {
      vibrant_color: null,
      colors: [],
      palette: null,
    },
    calendar: {
      access_level: "public",
      api_id: "",
      avatar_url: "",
      coordinate: null,
      cover_image_url: "",
      description_short: null,
      event_submission_restriction: "anyone",
      geo_city: null,
      geo_country: null,
      geo_region: null,
      google_measurement_id: null,
      instagram_handle: null,
      is_blocked: false,
      launch_status: "launched",
      linkedin_handle: null,
      luma_plus_active: false,
      meta_pixel_id: null,
      name: "Fractal Boston",
      personal_user_api_id: null,
      refund_policy: null,
      slug: null,
      social_image_url: null,
      stripe_account_id: null,
      tax_config: null,
      tiktok_handle: null,
      timezone: null,
      tint_color: "#000000",
      track_meta_ads_from_luma: false,
      twitter_handle: null,
      verified_at: null,
      website: null,
      youtube_handle: null,
      is_personal: false,
      personal_user: null,
    },
    start_at: webhookEvent.start_at,
    hosts: [],
    guest_count: 0,
    ticket_count: 0,
    ticket_info: {
      price: null,
      is_free: true,
      max_price: null,
      is_sold_out: false,
      spots_remaining: null,
      is_near_capacity: false,
      require_approval: false,
      currency_info: null,
    },
    featured_guests: [],
    role: null,
    waitlist_active: false,
    featured_city: null,
    calendar_api_id: "",
    is_manager: false,
    platform: "web",
    status: "published",
    submitted_by_user_api_id: "",
    tags: [],
  };
}
