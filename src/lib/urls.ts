/**
 * Joins the app base URL and an absolute path without producing double
 * slashes. env-var's asUrlString() appends a trailing slash to APP_URL, so
 * naive `${appUrl}/path` interpolation yields `//path` links that only work
 * via the host's redirect normalization.
 */
export function joinAppUrl(appUrl: string, path: string): string {
  return `${appUrl.replace(/\/+$/, "")}${path}`;
}

export function getLumaEventUrl(eventUrl: string): string {
  if (eventUrl.startsWith("http://") || eventUrl.startsWith("https://")) {
    return eventUrl;
  }

  return `https://luma.com/${eventUrl.replace(/^\/+/, "")}`;
}
