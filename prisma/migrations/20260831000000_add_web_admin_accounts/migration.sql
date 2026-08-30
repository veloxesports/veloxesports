CREATE TABLE "WebAdminAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SUPER_ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebAdminAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebAdminAccount_userId_key" ON "WebAdminAccount"("userId");
CREATE UNIQUE INDEX "WebAdminAccount_username_key" ON "WebAdminAccount"("username");
CREATE INDEX "WebAdminAccount_isActive_lockedUntil_idx" ON "WebAdminAccount"("isActive", "lockedUntil");

ALTER TABLE "WebAdminAccount" ADD CONSTRAINT "WebAdminAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
