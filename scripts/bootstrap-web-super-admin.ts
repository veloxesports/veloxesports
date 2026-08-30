import crypto from "crypto";
import { hashAdminPassword } from "../src/lib/auth/admin-password";
import { prisma } from "../src/lib/database/prisma";

function normalizedUsername(value: string) {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_.-]{2,63}$/.test(username)) {
    throw new Error("SUPER_ADMIN_USERNAME must be 3-64 lowercase letters, numbers, dots, underscores, or hyphens.");
  }
  return username;
}

async function main() {
  const username = normalizedUsername(process.env.SUPER_ADMIN_USERNAME ?? "super_admin");
  const configuredPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (configuredPassword && (configuredPassword.length < 12 || configuredPassword.length > 128)) {
    throw new Error("SUPER_ADMIN_PASSWORD must be between 12 and 128 characters.");
  }

  const existing = await prisma.webAdminAccount.findUnique({ where: { username }, select: { id: true, userId: true } });
  if (existing && !configuredPassword) {
    console.log(`Web Super Admin \"${username}\" already exists. Set SUPER_ADMIN_PASSWORD to rotate its password.`);
    return;
  }

  const password = configuredPassword ?? crypto.randomBytes(24).toString("base64url");
  const passwordHash = await hashAdminPassword(password);

  if (existing) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: existing.userId }, data: { role: "SUPER_ADMIN", status: "ACTIVE" } }),
      prisma.webAdminAccount.update({
        where: { id: existing.id },
        data: { passwordHash, role: "SUPER_ADMIN", isActive: true, failedLoginCount: 0, lockedUntil: null },
      }),
    ]);
    console.log(`Web Super Admin \"${username}\" was updated.`);
  } else {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          telegramId: `web-admin:${username}`,
          username,
          firstName: "VELOX",
          lastName: "Administrator",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
        },
      });
      await tx.webAdminAccount.create({
        data: { userId: user.id, username, passwordHash, role: "SUPER_ADMIN" },
      });
    });
    console.log(`Web Super Admin \"${username}\" was created.`);
  }

  console.log(`Username: ${username}`);
  console.log(`Password: ${password}`);
  console.log("Store this password securely. Set SUPER_ADMIN_PASSWORD and run this script again to rotate it.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Unable to bootstrap the Web Super Admin.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
