ALTER TABLE "Notification"
  ADD COLUMN "readAt" TIMESTAMP(3),
  ADD COLUMN "telegramDeliveryEligible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "telegramSentAt" TIMESTAMP(3),
  ADD COLUMN "telegramDeliveryError" TEXT,
  ADD COLUMN "telegramDeliveryAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Notification_userId_isRead_createdAt_idx"
  ON "Notification"("userId", "isRead", "createdAt");

CREATE INDEX "Notification_telegramDeliveryEligible_telegramSentAt_idx"
  ON "Notification"("telegramDeliveryEligible", "telegramSentAt");
