# Fractal Boston Events

Event notification system for Fractal Boston. Sends weekly email digests and Discord notifications for Luma calendar events.

## Quick Start

```bash
# Install dependencies
yarn

# Copy environment variables
cp .env.example .env
# Edit .env with your values

# Run database migrations
yarn migrate

# Start development server
yarn dev
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
yarn dev       # Start dev server
yarn test      # Run tests
yarn lint      # Lint code
yarn format    # Format code
```
