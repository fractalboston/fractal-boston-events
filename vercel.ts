import type { VercelConfig } from "@vercel/config/v1";

/**
 * Cron jobs are handled by GitHub Actions workflows (.github/workflows/cron.yml)
 * because Vercel cron was not working correctly
 */
export const config: VercelConfig = {
  functions: {
    "src/app/api/cron/email-weekly/route.ts": {
      maxDuration: 300,
    },
    "src/app/api/cron/discord-weekly/route.ts": {
      maxDuration: 60,
    },
    "src/app/api/webhooks/luma/event/route.ts": {
      maxDuration: 300,
    },
  },
};
