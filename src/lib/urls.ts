export function getLumaEventUrl(eventUrl: string): string {
  if (eventUrl.startsWith("http://") || eventUrl.startsWith("https://")) {
    return eventUrl;
  }

  return `https://luma.com/${eventUrl.replace(/^\/+/, "")}`;
}
