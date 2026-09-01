#!/bin/sh
set -eu

# Only the production deployment owns database migrations. Preview builds use
# the normal build so they never mutate the shared production database.
if [ "${VERCEL_ENV:-}" = "production" ]; then
  npx prisma migrate deploy
fi

npm run build
