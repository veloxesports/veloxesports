import type { Prisma } from "@/lib/generated/prisma/client";
import { TournamentParticipantType, UserStatus } from "@/lib/generated/prisma/client";

type TeamTournament = {
  id: string;
  participantType: TournamentParticipantType;
  teamSize: number;
};

export type ValidatedTeamEntry = {
  teamId: string;
  teamName: string;
  memberIds: string[];
};

/**
 * Validates the exact roster that a captain is about to enter. Call this from
 * the same serializable transaction that creates the registration or payment.
 */
export async function validateTeamEntry(
  tx: Prisma.TransactionClient,
  tournament: TeamTournament,
  captainId: string,
  teamId: string,
): Promise<ValidatedTeamEntry> {
  if (tournament.participantType !== TournamentParticipantType.TEAM) {
    throw new Error("TEAM_EVENT_REQUIRED");
  }

  const team = await tx.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        orderBy: { joinedAt: "asc" },
        include: { user: { select: { id: true, status: true } } },
      },
    },
  });

  if (!team) throw new Error("TEAM_NOT_FOUND");
  if (team.captainId !== captainId) throw new Error("NOT_TEAM_CAPTAIN");
  if (team.members.length !== tournament.teamSize) throw new Error("TEAM_ROSTER_SIZE_INVALID");
  if (team.members.some((member) => member.user.status !== UserStatus.ACTIVE)) {
    throw new Error("TEAM_MEMBER_UNAVAILABLE");
  }

  const memberIds = team.members.map((member) => member.userId);
  const existing = await tx.tournamentRegistration.findFirst({
    where: {
      tournamentId: tournament.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      OR: [
        { userId: { in: memberIds } },
        { team: { is: { members: { some: { userId: { in: memberIds } } } } } },
      ],
    },
    select: { id: true },
  });
  if (existing) throw new Error("TEAM_MEMBER_ALREADY_REGISTERED");

  return { teamId: team.id, teamName: team.name, memberIds };
}

export function teamEntryErrorMessage(code: string, teamSize?: number) {
  const messages: Record<string, string> = {
    TEAM_EVENT_REQUIRED: "Choose an individual tournament for a solo entry.",
    TEAM_NOT_FOUND: "That team is no longer available.",
    NOT_TEAM_CAPTAIN: "Only the team captain can register this roster.",
    TEAM_ROSTER_SIZE_INVALID: `This event requires exactly ${teamSize ?? "the configured number of"} active team members.`,
    TEAM_MEMBER_UNAVAILABLE: "Every team member must have an active VELOX account.",
    TEAM_MEMBER_ALREADY_REGISTERED: "A member of this roster is already registered for this tournament.",
  };
  return messages[code] ?? "This roster is not eligible for the tournament.";
}
