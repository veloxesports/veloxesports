-- Make team events explicit and retain the selected roster through paid checkout.
CREATE TYPE "TournamentParticipantType" AS ENUM ('INDIVIDUAL', 'TEAM');

ALTER TABLE "Tournament"
  ADD COLUMN "participantType" "TournamentParticipantType" NOT NULL DEFAULT 'INDIVIDUAL',
  ADD COLUMN "teamSize" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "TelegramPayment"
  ADD COLUMN "teamId" TEXT;

CREATE INDEX "TelegramPayment_teamId_idx" ON "TelegramPayment"("teamId");

ALTER TABLE "TelegramPayment"
  ADD CONSTRAINT "TelegramPayment_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
