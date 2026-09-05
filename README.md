# Khemora Esports - Esports Tournament Platform (Telegram Mini App)

Khemora Esports is a premium, scalable, and production-ready esports tournament platform built specifically for Telegram. Users can discover tournaments, register using Telegram Stars (XTR), track their transaction wallets, manage teams, and climb the global leaderboards.

## Tech Stack
- **Frontend**: Next.js (App Router), React, Tailwind CSS, shadcn/ui
- **Backend**: Next.js Server Actions, Prisma ORM
- **Database**: PostgreSQL (Designed for Supabase)
- **Payments**: Telegram Stars (XTR) Webhook API
- **State Management**: TanStack Query
- **Styling**: Tailwind V4

## Local Development Setup

1. **Clone and Install**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Copy `.env.example` to `.env.local` and fill in every required value. `DATABASE_URL`
   and `DIRECT_URL` must point to the same PostgreSQL database in local development.
   ```bash
   DATABASE_URL="your-postgresql-url"
   DIRECT_URL="your-direct-postgresql-url"
   SUPABASE_URL="https://your-project.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="your-server-only-service-role-key"
   TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
   TELEGRAM_BOT_USERNAME="your_bot_username"
   SESSION_SECRET="at-least-32-random-characters"
   TELEGRAM_WEBHOOK_SECRET="a-random-url-safe-webhook-secret"
   ```

   Create a **private** Supabase Storage bucket called `match-evidence`. It is used
   for match proof uploads; the app stores only paths and generates short-lived
   signed URLs for authorised players and moderators.

3. **Database Initialization**
   Apply the checked-in Prisma migration to your local or remote PostgreSQL database:
   ```bash
   npx prisma migrate deploy
   ```

4. **Seed the Database**
   Populate the database with games and sample tournaments:
   ```bash
   npm run db:seed
   ```

5. **Run the Development Server**
   ```bash
   npm run dev
   ```

## Testing Telegram Payments Locally
To test the Telegram Webhook logic locally, you must expose your local server to the internet using a tool like [ngrok](https://ngrok.com/):
1. Run `ngrok http 3000`
2. Copy the HTTPS URL provided by ngrok.
3. Register `<NGROK_URL>/api/telegram/webhook` with Telegram's `setWebhook` API. Set its `secret_token` to `TELEGRAM_WEBHOOK_SECRET` and limit `allowed_updates` to `message` and `pre_checkout_query`.

## Production Deployment (Vercel & Supabase)

### 1. Database (Supabase)
- Create a new project in [Supabase](https://supabase.com/).
- Copy the `Transaction` (Pooler) connection string to `DATABASE_URL`.
- Copy the `Session` (Direct) connection string to `DIRECT_URL`.
- Run `npx prisma migrate deploy` to initialize the production schema.

### 2. Hosting (Vercel)
- Push the repository to GitHub.
- Import the project into [Vercel](https://vercel.com/).
- Add the Environment Variables:
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_BOT_USERNAME`
  - `TELEGRAM_WEBHOOK_SECRET`
  - `SESSION_SECRET`
- Vercel will automatically run `npm run build` which triggers `prisma generate`.

### 3. Telegram Webhook Configuration
- Set `NEXT_PUBLIC_APP_URL` to the production HTTPS URL, then run the following from a machine that can reach `api.telegram.org`:
  ```bash
  npm run telegram:configure
  ```
  The script registers the protected `/api/telegram/webhook` endpoint and the bot's **Open Khemora** menu button without printing any credentials.

### 4. Optional Discord connection
- Create a Discord OAuth2 application with the `identify` scope.
- Add `https://your-app-domain/api/discord/callback` as its redirect URL.
- Set `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`; Khemora exchanges the
  authorization code server-side and never exposes the client secret to users.

## Project Structure
- `src/features/*`: Domain-driven logic (auth, tournaments, wallet, matches). Contains UI components and `actions.ts` for Server Actions.
- `src/app/*`: Next.js App Router pages.
- `src/lib/database/*`: Prisma client and Supabase helpers.
- `src/components/ui/*`: Reusable `shadcn/ui` components.
- `prisma/schema.prisma`: The central truth for the database architecture.

## Security Considerations
- **Telegram authentication**: Mini App `initData` is checked server-side with Telegram's HMAC flow and an `auth_date` expiry before Khemora creates a signed, HTTP-only session.
- **Payments**: A Stars invoice is created through Telegram's `createInvoiceLink` API. A client-side invoice result never confirms a registration; only a signed Telegram webhook can do that.
- **Webhook integrity and idempotency**: Webhook requests require `X-Telegram-Bot-Api-Secret-Token`. `telegram_payment_charge_id` is unique in `payment_events`, so duplicate deliveries do not duplicate registrations or ledger records.
- **Financial immutability**: Ledger records are appended in the same database transaction as payment/refund state. Corrections are refunds or reversals, never an edit to completed history.
- **Authorization**: Server Actions derive the current user from the signed session. Admin pages and financial actions enforce role checks server-side.
- **Evidence uploads**: Match proof is allowlisted to JPG, PNG, and WebP files up to 5 MB, is stored in a private bucket, and is exposed only through signed URLs.
