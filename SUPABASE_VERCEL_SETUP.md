# Supabase + Vercel Connection Configuration Guide

## Overview

This document summarizes the official Vercel and Supabase documentation for connecting Supabase Postgres to Vercel serverless functions using Kysely.

## Key Findings

### 1. Vercel Supabase Integration Environment Variables

When you use the **Vercel Supabase Integration**, it automatically sets these environment variables:

- `POSTGRES_URL` - **Transaction Mode Pooler** (port 6543) - ✅ Use for runtime queries
- `POSTGRES_PRISMA_URL` - Same as POSTGRES_URL (for Prisma compatibility)
- `POSTGRES_URL_NON_POOLING` - **Direct Connection** (port 5432) - ✅ Use for migrations
- `POSTGRES_USER` - Database username
- `POSTGRES_HOST` - Database hostname
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_DATABASE` - Database name
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only)
- `SUPABASE_ANON_KEY` - Anonymous key
- `SUPABASE_URL` - Supabase API URL
- `SUPABASE_JWT_SECRET` - JWT secret
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anonymous key
- `NEXT_PUBLIC_SUPABASE_URL` - Public Supabase URL

### 2. Connection String Types

#### Transaction Mode Pooler (Port 6543) - For Runtime Queries
- **Use for**: All API routes, webhooks, cron jobs (serverless functions)
- **Why**: Optimized for serverless with many transient connections
- **Limitation**: Does NOT support prepared statements (Kysely handles this automatically)
- **Format**: `postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:6543/postgres`
- **IPv4/IPv6**: Supports both ✅

#### Direct Connection (Port 5432) - For Migrations
- **Use for**: Database migrations only
- **Why**: Migrations need direct connection features not available in transaction mode
- **IPv4/IPv6**: IPv6 by default, IPv4 available as add-on
- **Format**: `postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres`

#### Session Mode Pooler (Port 5432) - Alternative for Migrations
- **Use for**: Migrations when IPv4 is required and direct connection isn't available
- **Why**: Alternative to direct connection when IPv6 isn't supported
- **Format**: `postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`

### 3. IPv4 Migration (January 2024)

**Important**: Vercel does NOT support IPv6, so Supabase updated their integration to use Supavisor (transaction mode) which supports IPv4.

If you deployed before January 27, 2024, you need to redeploy for the new environment variables to take effect.

### 4. Current Code Configuration

#### ✅ Runtime Connection (`src/db/index.ts`)
- Uses `POSTGRES_URL` ✅ Correct
- Configured for Transaction Mode (port 6543) ✅ Correct
- Pool settings optimized for serverless ✅ Correct
- SSL configured ✅ Correct

#### ⚠️ Migration Connection (`src/db/migrate.ts`)
- Currently uses `POSTGRES_DIRECT_URL`
- **Issue**: Vercel integration provides `POSTGRES_URL_NON_POOLING` instead
- **Recommendation**: Update to use `POSTGRES_URL_NON_POOLING` when available, fall back to `POSTGRES_DIRECT_URL` for manual setup

### 5. Kysely Configuration

Your current Kysely setup is correct:
- Uses `pg` Pool with `PostgresDialect` ✅
- Configured for transaction mode ✅
- Pool settings optimized for serverless (max: 15, min: 0, idleTimeout: 30s) ✅
- Handles prepared statement limitations automatically ✅

## Recommendations

### 1. Update Migration Script

Update `src/db/migrate.ts` to prefer `POSTGRES_URL_NON_POOLING` (from Vercel integration) over `POSTGRES_DIRECT_URL`:

```typescript
// Prefer POSTGRES_URL_NON_POOLING from Vercel integration, fall back to POSTGRES_DIRECT_URL
const postgresUrl = env.get("POSTGRES_URL_NON_POOLING").asString() 
  ?? env.get("POSTGRES_DIRECT_URL").required().asString();
```

### 2. Update Environment Variable Documentation

Update `.env.example` to document both:
- `POSTGRES_URL_NON_POOLING` - Set automatically by Vercel integration
- `POSTGRES_DIRECT_URL` - For manual setup (when not using Vercel integration)

### 3. Verify Connection Strings

Ensure your connection strings are correct:
- **Runtime**: Port 6543 (Transaction Mode)
- **Migrations**: Port 5432 (Direct Connection or Session Mode)

### 4. Connection Pool Configuration

Your current pool configuration is optimal for serverless:
- `max: 15` - Reasonable for serverless functions
- `min: 0` - Allows pool to shrink to zero (important for serverless)
- `idleTimeoutMillis: 30000` - Closes idle connections quickly
- `allowExitOnIdle: true` - Allows process to exit when idle (serverless-friendly)

## References

- [Vercel Supabase Integration](https://vercel.com/integrations/supabase)
- [Supabase Vercel Guide](https://supabase.com/docs/guides/integrations/vercel)
- [Supabase Postgres Connection Guide](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Kysely Supabase Integration](https://kysely.dev/docs/integrations/supabase)
