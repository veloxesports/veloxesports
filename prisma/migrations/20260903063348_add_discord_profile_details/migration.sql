-- AlterTable
ALTER TABLE "MatchEvidence" ALTER COLUMN "fileSize" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "discordConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "discordConnectedAt" TIMESTAMP(3),
ADD COLUMN     "discordDisplayName" TEXT;
