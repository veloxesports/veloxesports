ALTER TABLE "UserProfile"
  ADD COLUMN "discordId" TEXT,
  ADD COLUMN "discordUsername" TEXT,
  ADD COLUMN "discordAvatarUrl" TEXT;

CREATE UNIQUE INDEX "UserProfile_discordId_key" ON "UserProfile"("discordId");
