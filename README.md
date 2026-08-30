# VELOX - Esports Tournament Platform (Telegram Mini App)

VELOX is a premium, scalable, and production-ready esports tournament platform built specifically for Telegram. Users can discover tournaments, register using Telegram Stars (XTR), track their transaction wallets, manage teams, and climb the global leaderboards.

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
   Copy `.env.example` to `.env` and fill in the values:
   ```bash
   DATABASE_URL="your-postgresql-url"
   DIRECT_URL="your-direct-postgresql-url"
   TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
   ```

3. **Database Initialization**
   Apply the Prisma schema to your local or remote PostgreSQL database:
   ```bash
   npx prisma db push
   # or
   npx prisma migrate dev
   ```

4. **Seed the Database**
   Populate the database with games and sample tournaments:
   ```bash
   npx tsx prisma/seed.ts
   ```

5. **Run the Development Server**
   ```bash
   npm run dev
   ```

## Testing Telegram Payments Locally
To test the Telegram Webhook logic locally, you must expose your local server to the internet using a tool like [ngrok](https://ngrok.com/):
1. Run `ngrok http 3000`
2. Copy the HTTPS URL provided by ngrok.
3. Configure your Telegram Bot's webhook using the API:
   `https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=<NGROK_URL>/api/telegram/webhook`

## Production Deployment (Vercel & Supabase)

### 1. Database (Supabase)
- Create a new project in [Supabase](https://supabase.com/).
- Copy the `Transaction` (Pooler) connection string to `DATABASE_URL`.
- Copy the `Session` (Direct) connection string to `DIRECT_URL`.
- Run `npx prisma db push` to initialize the production schema.

### 2. Hosting (Vercel)
- Push the repository to GitHub.
- Import the project into [Vercel](https://vercel.com/).
- Add the Environment Variables:
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `TELEGRAM_BOT_TOKEN`
- Vercel will automatically run `npm run build` which triggers `prisma generate`.

### 3. Telegram Webhook Configuration
- Once deployed, register the production Vercel URL with your Telegram Bot via the `setWebhook` API.

## Project Structure
- `src/features/*`: Domain-driven logic (auth, tournaments, wallet, matches). Contains UI components and `actions.ts` for Server Actions.
- `src/app/*`: Next.js App Router pages.
- `src/lib/database/*`: Prisma client and Supabase helpers.
- `src/components/ui/*`: Reusable `shadcn/ui` components.
- `prisma/schema.prisma`: The central truth for the database architecture.

## Security Considerations
- **Financial Immutability**: All wallet and payment operations utilize Prisma `$transaction` blocks.
- **Idempotency**: The webhook API stores an `idempotencyKey` inside `payment_events` to ensure duplicate Telegram payloads are ignored.
- **RBAC**: Next.js Middleware in `src/middleware.ts` restricts access to `/admin` routes.
