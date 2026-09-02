"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth/current-user";

const teamIdSchema = z.string().uuid();
const inviteCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8}$/);
const createTeamSchema = z.object({
  name: z.string().trim().min(3).max(32).regex(/^[\p{L}\p{N} _.-]+$/u),
  logoUrl: z.string().url().max(2_048).optional(),
});

function newInviteCode() {
  return crypto.randomBytes(5).toString("hex").toUpperCase().slice(0, 8);
}

function revalidateTeams() {
  revalidatePath("/teams");
}

async function teamRosterIsLocked(tx: Prisma.TransactionClient, teamId: string) {
  const registration = await tx.tournamentRegistration.findFirst({
    where: {
      teamId,
      status: "CONFIRMED",
      tournament: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
    },
    select: { id: true },
  });
  return Boolean(registration);
}

export async function getMyTeams() {
  try {
    const user = await requireCurrentUser();
    const memberships = await prisma.teamMember.findMany({
      where: { userId: user.id },
      orderBy: { joinedAt: "desc" },
      include: {
        team: {
          include: {
            _count: { select: { members: true, registrations: true } },
            members: {
              orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
              select: {
                id: true,
                userId: true,
                role: true,
                joinedAt: true,
                user: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    profileImage: true,
                    profile: {
                      select: {
                        veloxUsername: true,
                        rank: true,
                        level: true,
                        wins: true,
                        losses: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const teamIds = memberships.map((membership) => membership.teamId);
    const invites = teamIds.length
      ? await prisma.teamInvite.findMany({
          where: { teamId: { in: teamIds }, createdById: user.id, expiresAt: { gt: new Date() } },
          select: { teamId: true, code: true, expiresAt: true, uses: true, maxUses: true },
          orderBy: { createdAt: "desc" },
        })
      : [];
    const inviteByTeam = new Map(invites.map((invite) => [invite.teamId, invite]));

    return {
      success: true,
      data: memberships.map((membership) => {
        const roster = membership.team.members.map((member) => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          name: member.user.profile?.veloxUsername ?? member.user.username ?? member.user.firstName ?? "Player",
          profileImage: member.user.profileImage,
          rank: member.user.profile?.rank ?? "BRONZE",
          level: member.user.profile?.level ?? 1,
          wins: member.user.profile?.wins ?? 0,
          losses: member.user.profile?.losses ?? 0,
          joinedAt: member.joinedAt,
        }));
        return {
          id: membership.team.id,
          name: membership.team.name,
          logoUrl: membership.team.logoUrl,
          role: membership.role,
          members: membership.team._count.members,
          tournamentEntries: membership.team._count.registrations,
          wins: roster.reduce((total, member) => total + member.wins, 0),
          losses: roster.reduce((total, member) => total + member.losses, 0),
          invite: membership.role === "CAPTAIN" ? inviteByTeam.get(membership.team.id) ?? null : null,
          roster,
        };
      }),
    };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { success: false, error: "Open VELOX in Telegram to manage your teams." };
    }
    console.error("Team fetch failed", error);
    return { success: false, error: "We couldn't load your teams." };
  }
}

export async function createTeam(input: unknown) {
  const parsed = createTeamSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Use a 3–32 character team name with letters, numbers, spaces, dots, hyphens, or underscores." };

  try {
    const user = await requireCurrentUser();
    const team = await prisma.$transaction(async (tx) => {
      const existing = await tx.team.findUnique({ where: { name: parsed.data.name } });
      if (existing) throw new Error("TEAM_NAME_TAKEN");

      const created = await tx.team.create({
        data: { name: parsed.data.name, captainId: user.id, logoUrl: parsed.data.logoUrl },
      });
      await tx.teamMember.create({ data: { teamId: created.id, userId: user.id, role: "CAPTAIN" } });
      return created;
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    revalidateTeams();
    return { success: true, data: team };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return { success: false, error: "Open VELOX in Telegram to create a team." };
    if (message === "TEAM_NAME_TAKEN") return { success: false, error: "That team name is already taken." };
    console.error("Team creation failed", error);
    return { success: false, error: "We couldn't create the team. Please try again." };
  }
}

export async function createTeamInvite(teamId: unknown) {
  const parsed = teamIdSchema.safeParse(teamId);
  if (!parsed.success) return { success: false, error: "Invalid team." };

  try {
    const user = await requireCurrentUser();
    const invite = await prisma.$transaction(async (tx) => {
      const membership = await tx.teamMember.findUnique({ where: { teamId_userId: { teamId: parsed.data, userId: user.id } } });
      if (!membership || membership.role !== "CAPTAIN") throw new Error("NOT_CAPTAIN");

      // Replace only unused active invitations created by this captain, keeping
      // old redeemed invitations as an audit trail.
      await tx.teamInvite.deleteMany({
        where: { teamId: parsed.data, createdById: user.id, uses: 0, expiresAt: { gt: new Date() } },
      });
      return tx.teamInvite.create({
        data: {
          teamId: parsed.data,
          createdById: user.id,
          code: newInviteCode(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
        },
      });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    revalidateTeams();
    return { success: true, data: { code: invite.code, expiresAt: invite.expiresAt } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return { success: false, error: "Open VELOX in Telegram to invite teammates." };
    if (message === "NOT_CAPTAIN") return { success: false, error: "Only the team captain can create invitations." };
    console.error("Team invite creation failed", error);
    return { success: false, error: "We couldn't create an invitation. Please try again." };
  }
}

export async function redeemTeamInvite(code: unknown) {
  const parsed = inviteCodeSchema.safeParse(code);
  if (!parsed.success) return { success: false, error: "Enter the 8-character team invite code." };

  try {
    const user = await requireCurrentUser();
    const membership = await prisma.$transaction(async (tx) => {
      const invite = await tx.teamInvite.findUnique({ where: { code: parsed.data } });
      if (!invite || invite.expiresAt <= new Date() || invite.uses >= invite.maxUses) throw new Error("INVITE_INVALID");

      const existing = await tx.teamMember.findUnique({ where: { teamId_userId: { teamId: invite.teamId, userId: user.id } } });
      if (existing) throw new Error("ALREADY_MEMBER");
      if (await teamRosterIsLocked(tx, invite.teamId)) throw new Error("ROSTER_LOCKED");

      const updatedInvite = await tx.teamInvite.updateMany({
        where: { id: invite.id, uses: { lt: invite.maxUses }, expiresAt: { gt: new Date() } },
        data: { uses: { increment: 1 } },
      });
      if (updatedInvite.count !== 1) throw new Error("INVITE_INVALID");

      return tx.teamMember.create({ data: { teamId: invite.teamId, userId: user.id, role: "MEMBER" } });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    revalidateTeams();
    return { success: true, data: membership };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return { success: false, error: "Open VELOX in Telegram to join a team." };
    if (message === "INVITE_INVALID") return { success: false, error: "That invite is expired, used, or invalid." };
    if (message === "ALREADY_MEMBER") return { success: false, error: "You are already a member of this team." };
    if (message === "ROSTER_LOCKED") return { success: false, error: "This roster is locked while it has an active tournament entry." };
    console.error("Team invite redemption failed", error);
    return { success: false, error: "We couldn't join the team. Please try again." };
  }
}

export async function leaveTeam(teamId: unknown) {
  const parsed = teamIdSchema.safeParse(teamId);
  if (!parsed.success) return { success: false, error: "Invalid team." };

  try {
    const user = await requireCurrentUser();
    await prisma.$transaction(async (tx) => {
      const membership = await tx.teamMember.findUnique({ where: { teamId_userId: { teamId: parsed.data, userId: user.id } } });
      if (!membership) throw new Error("NOT_MEMBER");
      if (membership.role === "CAPTAIN") throw new Error("CAPTAIN_MUST_TRANSFER");
      if (await teamRosterIsLocked(tx, parsed.data)) throw new Error("ROSTER_LOCKED");
      await tx.teamMember.delete({ where: { id: membership.id } });
    });
    revalidateTeams();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_MEMBER") return { success: false, error: "You are not a member of this team." };
    if (message === "CAPTAIN_MUST_TRANSFER") return { success: false, error: "Transfer captaincy before leaving this team." };
    if (message === "ROSTER_LOCKED") return { success: false, error: "This roster is locked while it has an active tournament entry." };
    if (message === "UNAUTHENTICATED") return { success: false, error: "Open VELOX in Telegram to manage your teams." };
    console.error("Leave team failed", error);
    return { success: false, error: "We couldn't leave the team. Please try again." };
  }
}

const transferCaptaincySchema = z.object({
  teamId: z.string().uuid(),
  newCaptainUserId: z.string().uuid(),
});

export async function transferCaptaincy(input: unknown) {
  const parsed = transferCaptaincySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid transfer request." };

  try {
    const user = await requireCurrentUser();
    await prisma.$transaction(async (tx) => {
      const captainMembership = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId: parsed.data.teamId, userId: user.id } },
      });
      if (!captainMembership || captainMembership.role !== "CAPTAIN") {
        throw new Error("NOT_CAPTAIN");
      }

      const targetMembership = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId: parsed.data.teamId, userId: parsed.data.newCaptainUserId } },
      });
      if (!targetMembership) throw new Error("TARGET_NOT_MEMBER");

      await tx.teamMember.update({
        where: { id: captainMembership.id },
        data: { role: "MEMBER" },
      });
      await tx.teamMember.update({
        where: { id: targetMembership.id },
        data: { role: "CAPTAIN" },
      });
      await tx.team.update({
        where: { id: parsed.data.teamId },
        data: { captainId: parsed.data.newCaptainUserId },
      });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    revalidateTeams();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_CAPTAIN") return { success: false, error: "Only the team captain can transfer leadership." };
    if (message === "TARGET_NOT_MEMBER") return { success: false, error: "The new captain must already be a member of the team." };
    if (message === "UNAUTHENTICATED") return { success: false, error: "Open VELOX in Telegram to manage your teams." };
    console.error("Transfer captaincy failed", error);
    return { success: false, error: "We couldn't transfer team captaincy." };
  }
}

const removeMemberSchema = z.object({
  teamId: z.string().uuid(),
  memberUserId: z.string().uuid(),
});

export async function removeTeamMember(input: unknown) {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid remove request." };

  try {
    const user = await requireCurrentUser();
    await prisma.$transaction(async (tx) => {
      const captainMembership = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId: parsed.data.teamId, userId: user.id } },
      });
      if (!captainMembership || captainMembership.role !== "CAPTAIN") {
        throw new Error("NOT_CAPTAIN");
      }
      if (parsed.data.memberUserId === user.id) throw new Error("CANNOT_REMOVE_SELF");

      if (await teamRosterIsLocked(tx, parsed.data.teamId)) throw new Error("ROSTER_LOCKED");

      const targetMembership = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId: parsed.data.teamId, userId: parsed.data.memberUserId } },
      });
      if (!targetMembership) throw new Error("TARGET_NOT_MEMBER");

      await tx.teamMember.delete({ where: { id: targetMembership.id } });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    revalidateTeams();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_CAPTAIN") return { success: false, error: "Only the team captain can remove members." };
    if (message === "CANNOT_REMOVE_SELF") return { success: false, error: "Transfer captaincy or disband the team instead." };
    if (message === "ROSTER_LOCKED") return { success: false, error: "This roster is locked while it has an active tournament entry." };
    if (message === "TARGET_NOT_MEMBER") return { success: false, error: "That player is no longer on the team." };
    if (message === "UNAUTHENTICATED") return { success: false, error: "Open VELOX in Telegram to manage your teams." };
    console.error("Remove team member failed", error);
    return { success: false, error: "We couldn't remove that player." };
  }
}

export async function disbandTeam(teamId: unknown) {
  const parsed = teamIdSchema.safeParse(teamId);
  if (!parsed.success) return { success: false, error: "Invalid team." };

  try {
    const user = await requireCurrentUser();
    await prisma.$transaction(async (tx) => {
      const captainMembership = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId: parsed.data, userId: user.id } },
      });
      if (!captainMembership || captainMembership.role !== "CAPTAIN") {
        throw new Error("NOT_CAPTAIN");
      }
      if (await teamRosterIsLocked(tx, parsed.data)) throw new Error("ROSTER_LOCKED");

      await tx.teamInvite.deleteMany({ where: { teamId: parsed.data } });
      await tx.teamMember.deleteMany({ where: { teamId: parsed.data } });
      await tx.team.delete({ where: { id: parsed.data } });
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });

    revalidateTeams();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_CAPTAIN") return { success: false, error: "Only the team captain can disband the team." };
    if (message === "ROSTER_LOCKED") return { success: false, error: "This team cannot be disbanded while registered in an active tournament." };
    if (message === "UNAUTHENTICATED") return { success: false, error: "Open VELOX in Telegram to manage your teams." };
    console.error("Disband team failed", error);
    return { success: false, error: "We couldn't disband the team." };
  }
}
