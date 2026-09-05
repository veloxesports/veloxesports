import { prisma } from "@/lib/database/prisma";
import { getSession } from "@/lib/auth/session";
import { getCurrentWebAdmin, type WebAdminRole } from "@/lib/auth/web-admin";

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      telegramId: true,
      username: true,
      firstName: true,
      lastName: true,
      profileImage: true,
      role: true,
      status: true,
      profile: {
        select: { khemoraUsername: true, rank: true, level: true, xp: true, wins: true, losses: true },
      },
    },
  });

  if (!user || user.telegramId !== session.telegramId || user.status !== "ACTIVE") return null;
  return user;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireRole(roles: Array<WebAdminRole>) {
  const webAdmin = await getCurrentWebAdmin();
  if (webAdmin) {
    if (!roles.includes(webAdmin.role)) throw new Error("FORBIDDEN");
    return webAdmin;
  }

  const user = await requireCurrentUser();
  if (!roles.includes(user.role as WebAdminRole)) {
    throw new Error("FORBIDDEN");
  }

  return user;
}
