import type { LumaEvent } from './luma'

type DiscordEmbed = {
  title: string
  description?: string
  url?: string
  color?: number
  fields?: {
    name: string
    value: string
    inline?: boolean
  }[]
  timestamp?: string
}

type DiscordWebhookPayload = {
  content?: string
  embeds?: DiscordEmbed[]
}

function formatEventDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })
}

export async function sendDiscordWeeklySummary(
  webhookUrl: string,
  events: LumaEvent[],
  modRoleId?: string
): Promise<void> {
  let payload: DiscordWebhookPayload

  if (events.length === 0) {
    // No events - ping mods
    const modPing =
      modRoleId !== undefined
        ? `<@&${modRoleId}> ⚠️ No events scheduled for this week! Time to add some events.`
        : '⚠️ No events scheduled for this week!'
    payload = { content: modPing }
  } else {
    // Build embeds for events
    const eventCount = String(events.length)
    const embeds: DiscordEmbed[] = [
      {
        title: '📅 This Week at Fractal',
        description: `${eventCount} event${events.length === 1 ? '' : 's'} coming up`,
        color: 0x2563eb, // Blue color
      },
      ...events.slice(0, 10).map((event) => ({
        title: event.name,
        url: event.url,
        description: `📆 ${formatEventDate(event.start_at)}`,
        color: 0x10b981, // Green color
      })),
    ]

    payload = { embeds }
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Discord webhook error: ${String(response.status)} - ${text}`)
  }
}

export async function sendDiscordNewEventAlert(
  webhookUrl: string,
  event: LumaEvent
): Promise<void> {
  const payload: DiscordWebhookPayload = {
    content: '🚀 New event just added!',
    embeds: [
      {
        title: event.name,
        url: event.url,
        description: `📆 ${formatEventDate(event.start_at)}`,
        color: 0xf59e0b, // Amber color
      },
    ],
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Discord webhook error: ${String(response.status)} - ${text}`)
  }
}
