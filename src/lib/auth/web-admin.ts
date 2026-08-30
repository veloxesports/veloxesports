import "server-only";

import { prisma } from "@/lib/database/prisma";
import { getAdminSession } from "@/lib/auth/admin-session";

export const webAdminRoles = ["SUPER_ADMIN", "ADMIN", "TOURNAMENT_MANAGER", "FINANCE_MANAGER", "MODERATOR", "SUPPORT"] as const;
export type WebAdminRole = (typeof webAdminRoles)[number];

export async function getCurrentWebAdmin() {
  const session = await getAdminSession();
  if (!session) return null;

  const account = await prisma.webAdminAccount.findUnique({
    where: { id: session.accountId },
    select: {
      id: true,
      userId: true,
      username: true,
      role: true,
      isActive: true,
      user: { select: { status: true } },
    },
  });

  if (!account || account.userId !== session.userId || !account.isActive || account.user.status !== "ACTIVE" || !webAdminRoles.includes(account.role as WebAdminRole)) {
    return null;
  }

  return { id: account.userId, accountId: account.id, username: account.username, role: account.role as WebAdminRole };
}
