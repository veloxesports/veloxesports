-- Store private Supabase object keys rather than public evidence URLs.
ALTER TABLE "MatchEvidence" RENAME COLUMN "fileUrl" TO "storagePath";
ALTER TABLE "MatchEvidence" ADD COLUMN "fileSize" INTEGER NOT NULL DEFAULT 0;

-- A stable bracket position lets a confirmed winner advance into the next round.
ALTER TABLE "Match" ADD COLUMN "bracketPosition" INTEGER;
CREATE UNIQUE INDEX "Match_tournamentId_round_bracketPosition_key"
  ON "Match"("tournamentId", "round", "bracketPosition");

-- Team invitations are one-time (by default), scoped to a team, and expire.
CREATE TABLE "TeamInvite" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamInvite_code_key" ON "TeamInvite"("code");
CREATE INDEX "TeamInvite_teamId_expiresAt_idx" ON "TeamInvite"("teamId", "expiresAt");
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
