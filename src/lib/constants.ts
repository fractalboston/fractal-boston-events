export const HOMEPAGE_URL = "https://fractal.boston";
export const CALENDAR_URL = "https://fractal.boston/calendar";
export const DISCORD_URL = "https://fractal.boston/discord";
export const EMAIL_FROM = "Fractal Events <events@fractal.boston>";
export const SENDER_EMAIL_DOMAIN = "fractal.boston";
// Matches the fractal.boston body font stack (all system fonts, email-safe).
// The site's display webfont (Fractul) can't be relied on in email clients.
export const EMAIL_FONT_STACK =
  "Optima, Candara, 'Noto Sans', source-sans-pro, sans-serif";
// Mirrors the reclaim interval in claimBroadcastForSending. Client-side this
// is only a display hint - the claim query arbitrates actual staleness.
export const SENDING_RECLAIM_MS = 10 * 60 * 1000;
export const BRAND_COLOR = "#059669";
