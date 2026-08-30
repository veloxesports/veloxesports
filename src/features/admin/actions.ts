"use server";

import { prisma } from "@/lib/database/prisma";

export async function createAuditLog(
  adminId: string,
  action: string,
  entity: string,
  entityId: string,
  oldValue?: any,
  newValue?: any
) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId,
        action,
        entity,
        entityId,
        oldValue: oldValue || null,
        newValue: newValue || null,
      },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to write audit log", error);
    return { success: false };
  }
}

export async function getAdminStats() {
  try {
    const totalUsers = await prisma.user.count();
    const activeTournaments = await prisma.tournament.count({
      where: { status: { in: ["REGISTRATION_OPEN", "UPCOMING", "LIVE"] } }
    });
    const pendingDisputes = await prisma.dispute.count({
      where: { status: "OPEN" }
    });

    const recentTransactions = await prisma.walletTransaction.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        wallet: { include: { user: true } }
      }
    });

    return { 
      success: true, 
      data: { totalUsers, activeTournaments, pendingDisputes, recentTransactions } 
    };
  } catch (error) {
    console.error("Failed to fetch admin stats", error);
    return { success: false, error: "Failed to fetch stats" };
  }
}
