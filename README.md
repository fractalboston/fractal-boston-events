# fb-events

Event notification system for Fractal Boston. Sends weekly email digests and Discord notifications for Luma calendar events.

## Quick Start

```bash
# Install dependencies
yarn

# Copy environment variables
cp .env.example .env
# Edit .env with your values

# Run database migrations
yarn db:migrate

# Start development server
yarn dev
```

## API Endpoints

| Endpoint                        | Method | Auth             | Description                        |
| ------------------------------- | ------ | ---------------- | ---------------------------------- |
| `/api/subscribe`                | POST   | X-Api-Key        | Subscribe email to notifications   |
| `/api/verify`                   | POST   | token in body    | Verify email address               |
| `/api/unsubscribe`              | POST   | token in body    | Unsubscribe from notifications     |
| `/api/webhooks/luma/subscriber` | POST   | X-Luma-Signature | Luma calendar subscription webhook |
| `/api/webhooks/luma/event`      | POST   | X-Luma-Signature | Luma new event webhook             |
| `/api/cron/weekly`              | GET    | Vercel Cron      | Weekly digest (Sat 8am EST)        |
| `/api/health`                   | GET    | None             | Health check                       |

## Setup

See [claude.md](./claude.md) for detailed setup instructions including:

- Supabase database setup
- Resend domain verification
- Luma webhook configuration
- Discord webhook setup
- Vercel deployment

## Development

```bash
yarn dev       # Start dev server
yarn test      # Run tests
yarn lint      # Lint code
yarn format    # Format code
```

## License

Private - Fractal Boston
