# Fractal Boston Events

Event notification system for Fractal Boston. Sends weekly email digests and Discord notifications for Luma calendar events.

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your values

# Run database migrations
pnpm migrate

# Start development server
pnpm dev
```

## Setup

See [AGENTS.md](./AGENTS.md) and [CLAUDE.md](./CLAUDE.md) for detailed setup instructions including:

- Supabase database setup
- AWS SES domain verification
- Luma webhook configuration
- Discord webhook setup
- Vercel deployment

## Development

```bash
pnpm dev       # Start dev server
pnpm test      # Run tests
pnpm lint      # Lint code
pnpm format    # Format code
```
