# Fractal Boston Events Notification System

## Overview

A serverless API for managing email subscriptions and notifications for Fractal Boston events hosted on Luma.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        fractal.boston                           │
│  • Subscribe form → POST /api/subscribe                        │
│  • /verify?token=xxx → POST /api/verify                        │
│  • /unsubscribe?token=xxx → POST /api/unsubscribe             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        fb-events API                            │
│                    (Vercel + Supabase)                         │
│                                                                 │
│  Public Endpoints:                                              │
│  • POST /api/subscribe      - requires X-Api-Key header        │
│  • POST /api/verify         - token in body                    │
│  • POST /api/unsubscribe    - token in body                    │
│                                                                 │
│  Webhook Endpoints:                                             │
│  • POST /api/webhooks/luma/subscriber - Luma calendar sub      │
│  • POST /api/webhooks/luma/event      - new event created      │
│                                                                 │
│  Cron:                                                          │
│  • GET /api/cron/email-weekly   - Daily 8am EST (email only)      │
│  • GET /api/cron/discord-weekly - Mondays 8am EST (Discord only)  │
└─────────────────────────────────────────────────────────────────┘
```

## Design Decisions

### Tech Stack

| Choice                        | Reason                                              |
| ----------------------------- | --------------------------------------------------- |
| **Next.js 14 (Pages Router)** | Explicit requirement: no React Server Components    |
| **TypeScript**                | Type safety, better DX                              |
| **Turbopack**                 | Faster builds during development                    |
| **Kysely**                    | Type-safe SQL query builder, no ORM magic           |
| **Zod v4**                    | Runtime validation with TypeScript inference        |
| **env-var**                   | Type-safe environment variable validation           |
| **Resend**                    | Simple email API, good free tier, easy domain setup |
| **Vercel**                    | Free hosting, native cron support, maxDuration=300s |
| **Supabase**                  | Free Postgres, easy setup                           |

### Code Style Rules

1. **Strict TypeScript** - No `any`, no `unknown` casts
2. **Types over interfaces** - Consistent `type` keyword everywhere
3. **Explicit return types** - All functions have declared return types
4. **Zod v4 for validation** - Runtime type checking at API boundaries (all external data: API inputs, fetch responses)
5. **env-var for environment variables** - NEVER use `process.env` directly, ALWAYS use `env` from `src/lib/env.ts`
6. **Absolute imports only** - Use `@/` imports, NEVER use relative imports (`./` or `../`)
7. **No React Server Components** - Classic Pages Router only
8. **Yarn only** - No npm commands
9. **Prettier with import sorting** - Imports are automatically sorted using `@trivago/prettier-plugin-sort-imports`

### Security

| Mechanism             | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| `SUBSCRIBE_API_KEY`   | Protects subscribe endpoint from spam             |
| `LUMA_WEBHOOK_SECRET` | Validates incoming Luma webhooks                  |
| `CRON_SECRET`         | Vercel-managed secret for cron authentication     |
| UUID tokens           | Subscriber-specific tokens for verify/unsubscribe |

### Email Strategy

- **Double opt-in** for form subscribers (pending → verified)
- **No opt-in** for Luma subscribers (already verified by Luma)
- **Welcome email** sent on verification with upcoming events
- **Weekly digest** every Saturday 8am EST
- **New event alerts** when event added <7 days out
- **Email footer** includes links to:
  - [fractal.boston](https://fractal.boston)
  - [Calendar](https://lu.ma/fractalboston)
  - [Discord](https://discord.gg/fractalboston)
  - Unsubscribe link

### Database Schema

See `src/db/index.ts` for the schema.

### API Response Format

All endpoints return consistent JSON:

```typescript
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "message" }
```

### Cron Jobs

Configured in `vercel.json`.

## Environment Variables

See `.env.example` for detailed documentation on all environment variables, including:

## Luma Webhook Setup

Configure these webhooks in Luma dashboard:

1. **Calendar Person Subscribed**
   - URL: `https://your-domain.vercel.app/api/webhooks/luma/subscriber`
   - Event: `calendar_person_subscribed`

2. **Event Created**
   - URL: `https://your-domain.vercel.app/api/webhooks/luma/event`
   - Event: `event.created`

Both webhooks need the `X-Luma-Signature` header set to your `LUMA_WEBHOOK_SECRET`.

## Resend Domain Setup

1. Add domain `fractal.boston` in Resend dashboard
2. Add DNS records (DKIM, SPF, DMARC)
3. Verify domain
4. Emails will be sent from `events@fractal.boston`

## Discord Webhook Setup

1. Go to Discord channel settings → Integrations → Webhooks
2. Create webhooks for events and logging (can be same or different channels):
   - **Events webhook**: Set as `DISCORD_EVENTS_WEBHOOK_URL`
   - **Logging webhook**: Set as `DISCORD_LOGGING_WEBHOOK_URL`
3. Get mod role ID (enable Developer Mode, right-click role)
4. Set as `DISCORD_MOD_ROLE_ID`

### Discord Integration Features

**Events Channel** (`DISCORD_EVENTS_WEBHOOK_URL`):
- Weekly event summaries every Saturday
- New event alerts when events are added <7 days out
- Mod role pings when no events are scheduled

**Logging Channel** (`DISCORD_LOGGING_WEBHOOK_URL`):
- Error logging from all API endpoints with stack traces
- Email job statistics after daily digest:
  - Emails sent/failed count
  - Events included
  - Total subscriber count
  - Resend monthly usage estimate
  - **Warning** alerts when approaching 75% of Resend monthly limit
- Individual email failure notifications

## Development

```bash
# Install dependencies
yarn

# Run migrations
yarn migrate

# Start dev server (with Turbopack)
yarn dev

# Run all checks (tests + lint + typecheck)
yarn check

# Run tests
yarn test

# Lint
yarn lint

# Format (with import sorting)
yarn format
```

## Deployment

1. Push to GitHub
2. Connect to Vercel
3. Add all environment variables
4. Deploy
5. Configure Luma webhooks with deployed URL

## fractal.boston Integration

The main site needs to:

1. **Subscribe form** - POST to `/api/subscribe` with `X-Api-Key` header
2. **Verify page** (`/verify`) - Reads `token` from URL, calls POST `/api/verify`
3. **Unsubscribe page** (`/unsubscribe`) - Reads `token` from URL, calls POST `/api/unsubscribe`

Example form submission:

```typescript
const response = await fetch('https://fb-events.vercel.app/api/subscribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': process.env.NEXT_PUBLIC_EVENTS_API_KEY,
  },
  body: JSON.stringify({ email }),
})
```

## Scaling Notes

- **Free tier limits**: Resend 3k emails/month (~750 weekly subscribers)
- **Batch sending**: 50ms delay between emails to avoid rate limits
- **Database**: Supabase free tier supports thousands of subscribers
- **Monitoring**: System warns in Discord when approaching 75% of Resend monthly limit
- **If scaling beyond free tier**: Consider Amazon SES ($0.10/1k emails)
