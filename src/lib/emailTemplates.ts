import {
  BRAND_COLOR,
  CALENDAR_URL,
  DISCORD_URL,
  EMAIL_FONT_STACK,
  HOMEPAGE_URL,
} from "@/lib/constants";
import { type LumaEvent, getEventStartAt } from "@/lib/luma";
import { getLumaEventUrl } from "@/lib/urls";

const TIME_ZONE = "America/New_York";
const EVENT_PLACEHOLDER_IMAGE_URL =
  "https://fractal.boston/img/event-placeholder.jpg";

export function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}

export function formatEventsSimpleHtml(events: LumaEvent[]): string {
  if (events.length === 0) {
    return "<p>No events scheduled for this week.</p>";
  }

  const eventItems = events
    .map(
      (event) =>
        `<p><a href="${getLumaEventUrl(event.event.url)}">${event.event.name}</a><br>${formatEventDate(getEventStartAt(event))}</p>`
    )
    .join("");

  return eventItems;
}

export function generateEventsHtml(events: LumaEvent[]): string {
  if (events.length === 0) {
    return "<p>No events scheduled for this week.</p>";
  }

  const eventItems = events
    .map((event) => {
      const eventUrl = getLumaEventUrl(event.event.url);
      const imageUrl = event.event.cover_url || EVENT_PLACEHOLDER_IMAGE_URL;
      const imageCell = `<td style="width: 64px; padding-right: 16px; vertical-align: top;"><div style="width: 64px; height: 64px; border-radius: 4px; overflow: hidden; position: relative;"><img src="${imageUrl}" alt="${event.event.name}" width="64" height="64" style="width: 64px; height: 64px; object-fit: cover; border-radius: 4px; display: block; max-width: 100%;" /></div></td>`;
      return `
      <a href="${eventUrl}" style="display: block; text-decoration: none; color: inherit;">
        <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e5e5e5; border-radius: 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              ${imageCell}
              <td style="vertical-align: top;">
                <h3 style="margin: 0 0 8px 0; color: #1a1a1a;">
                  <span style="color: ${BRAND_COLOR};">${event.event.name}</span>
                </h3>
                <p style="margin: 0; color: #666; font-size: 14px;">
                  📅 ${formatEventDate(getEventStartAt(event))}
                </p>
              </td>
            </tr>
          </table>
        </div>
      </a>
    `;
    })
    .join("");

  return `
    <div style="margin-top: 16px;">
      ${eventItems}
    </div>
  `;
}

export function buildEmailBody(
  content: string,
  unsubscribeUrl?: string
): string {
  const footer = `
  <p style="font-size: 15px;">
    ---<br/>
    <a href="${HOMEPAGE_URL}" style="color: ${BRAND_COLOR};">fractal.boston</a> | <a href="${CALENDAR_URL}" style="color: ${BRAND_COLOR};">/calendar</a> | <a href="${DISCORD_URL}" style="color: ${BRAND_COLOR};">/discord</a>
  </p>
  `.trim();
  const unsubscribeLine =
    unsubscribeUrl !== undefined && unsubscribeUrl !== ""
      ? `<p style="font-size: 12px;"><a href="${unsubscribeUrl}" style="font-size: 12px; color: ${BRAND_COLOR};">Unsubscribe</a> from these emails.</p>`
      : "";
  return `
    ${content}
    ${footer}
    ${unsubscribeLine}
  `;
}

export function wrapInEmailTemplate(body: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a; font-size: 18px; line-height: 1.5;">
        ${body}
      </body>
    </html>
  `;
}

const EMAIL_TEXT_COLOR = "#444444";
const EMAIL_CARD_BG = "#f0fdf4";
// Brand emerald lightened for readable contrast on dark backgrounds only;
// light mode keeps BRAND_COLOR everywhere.
const DARK_MODE_ACCENT = "#34d399";

/**
 * Broadcast layout matching fractal.boston: brand wordmark header, pale green
 * content card with the site's organic border radii, centered footer with a
 * per-subscriber unsubscribe link.
 *
 * Email-client strategy:
 * - Table-based with a fixed width attribute for Outlook's Word engine and a
 *   fluid max-width style everywhere else, so it is mobile-responsive even in
 *   clients that ignore media queries.
 * - The head <style> block sets content defaults (brand-green bold underlined
 *   links, green headings, a .button class mirroring the site's buttons).
 *   Inline styles in the composed content always win over these defaults.
 *   Clients that strip <style> (a shrinking minority) fall back to their own
 *   link styling; layout does not depend on it.
 * - Gradient, border-radius, and box-shadow are progressive enhancements over
 *   bgcolor/solid fallbacks; Outlook renders a square pale-green card.
 */
export function wrapInBroadcastTemplate({
  content,
  unsubscribeUrl,
}: {
  content: string;
  unsubscribeUrl: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <style>
          a {
            color: ${BRAND_COLOR};
            font-weight: bold;
            text-decoration: underline;
          }
          h1, h2, h3 {
            color: ${BRAND_COLOR};
            font-family: ${EMAIL_FONT_STACK};
            font-weight: bold;
            line-height: 1.3;
          }
          .button {
            display: inline-block;
            background-color: ${BRAND_COLOR};
            color: #ffffff !important;
            font-weight: bold;
            text-decoration: none;
            padding: 12px 28px;
            border: 3px solid ${BRAND_COLOR};
            border-radius: 50px 15px / 15px 50px;
            box-shadow: 4px 4px 0 rgba(5, 150, 105, 0.3);
          }
          @media only screen and (max-width: 480px) {
            .card {
              padding: 26px 20px !important;
            }
          }
          @media (prefers-color-scheme: dark) {
            body.email-bg, table.email-bg { background-color: #111111 !important; }
            .card {
              background-color: #14241c !important;
              background-image: linear-gradient(145deg, #1b2f24 0%, #14241c 100%) !important;
              color: #e8e8e8 !important;
            }
            h1, h2, h3 { color: ${DARK_MODE_ACCENT} !important; }
            a { color: ${DARK_MODE_ACCENT} !important; }
            .button {
              background-color: ${BRAND_COLOR} !important;
              color: #ffffff !important;
              border-color: ${DARK_MODE_ACCENT} !important;
              box-shadow: 4px 4px 0 rgba(52, 211, 153, 0.25) !important;
            }
            .wordmark { color: ${DARK_MODE_ACCENT} !important; }
            .footer, .footer a { color: #9ca3af !important; }
          }
        </style>
      </head>
      <body class="email-bg" style="margin: 0; padding: 0; background-color: #ffffff;" bgcolor="#ffffff">
        <table role="presentation" class="email-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff;" bgcolor="#ffffff">
          <tr>
            <td align="center" style="padding: 28px 12px;">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px;">
                <tr>
                  <td align="center" style="padding: 0 4px 18px 4px;">
                    <a href="${HOMEPAGE_URL}" class="wordmark" style="font-family: ${EMAIL_FONT_STACK}; font-size: 26px; font-weight: bold; color: ${BRAND_COLOR}; text-decoration: none;">Fractal Boston</a>
                  </td>
                </tr>
                <tr>
                  <td class="card" style="background-color: ${EMAIL_CARD_BG}; background-image: linear-gradient(145deg, #fefefe 0%, ${EMAIL_CARD_BG} 100%); border-radius: 35px 25px 40px 30px; padding: 36px 32px; font-family: ${EMAIL_FONT_STACK}; font-size: 16px; line-height: 1.6; color: ${EMAIL_TEXT_COLOR};" bgcolor="${EMAIL_CARD_BG}">
                    ${content}
                  </td>
                </tr>
                <tr>
                  <td align="center" class="footer" style="padding: 22px 8px; font-family: ${EMAIL_FONT_STACK}; font-size: 13px; line-height: 1.8; color: #6b7280; text-align: center;">
                    <a href="${HOMEPAGE_URL}" style="color: ${BRAND_COLOR}; font-weight: 600; text-decoration: none;">fractal.boston</a>
                    &nbsp;·&nbsp;
                    <a href="${CALENDAR_URL}" style="color: ${BRAND_COLOR}; font-weight: 600; text-decoration: none;">Calendar</a>
                    &nbsp;·&nbsp;
                    <a href="${DISCORD_URL}" style="color: ${BRAND_COLOR}; font-weight: 600; text-decoration: none;">Discord</a>
                    <br>
                    <a href="${unsubscribeUrl}" style="color: #6b7280; font-weight: normal; text-decoration: underline;">Unsubscribe</a> from these emails.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
