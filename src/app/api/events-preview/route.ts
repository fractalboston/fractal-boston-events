import { env } from "@/lib/env";
import { getReportableEvents } from "@/lib/luma";
import type { LumaEvent } from "@/lib/luma";

function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

function generateHtml(events: LumaEvent[]): string {
  const eventItems = events
    .map(
      (event) => `
      <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <h3 style="margin: 0 0 8px 0; color: #1a1a1a;">
          <a href="https://luma.com/${event.event.url}" style="color: #2563eb; text-decoration: none;">${event.event.name}</a>
        </h3>
        <p style="margin: 0; color: #666; font-size: 14px;">
          📅 ${formatEventDate(event.start_at)}
        </p>
        ${event.event.geo_address_info.city !== undefined && event.event.geo_address_info.city !== "" ? `<p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">📍 ${event.event.geo_address_info.city}</p>` : ""}
      </div>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Events Preview - Fractal Boston</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
        <h1 style="font-size: 28px; margin-bottom: 8px;">Events Preview</h1>
        <p style="color: #666; margin-bottom: 24px;">Events that would be sent via email or Discord notifications</p>
        ${events.length === 0 ? "<p>No events scheduled for the next 7 days.</p>" : `<div style="margin-top: 16px;">${eventItems}</div>`}
        <hr style="margin-top: 32px; border: none; border-top: 1px solid #e5e5e5;">
        <p style="font-size: 12px; color: #999; margin-top: 16px;">
          Total: ${events.length} event${events.length === 1 ? "" : "s"}
        </p>
      </body>
    </html>
  `;
}

export async function GET(): Promise<Response> {
  try {
    const events = await getReportableEvents(env.LUMA_CALENDAR_ID);

    const html = generateHtml(events);

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Events preview error:", error);

    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Events Preview - Error</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
          <h1 style="font-size: 28px; margin-bottom: 8px;">Error</h1>
          <p style="color: #ef4444;">Failed to fetch events: ${error instanceof Error ? error.message : String(error)}</p>
        </body>
      </html>
    `;

    return new Response(errorHtml, {
      status: 500,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }
}
