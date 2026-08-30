"use server";

import { prisma } from "@/lib/database/prisma";

export async function generateSingleEliminationBracket(tournamentId: string) {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        registrations: true
      }
    });

    if (!tournament) return { success: false, error: "Tournament not found" };
    if (tournament.status !== "REGISTRATION_CLOSED") {
      return { success: false, error: "Tournament registration must be closed to generate brackets." };
    }

    const participants = tournament.registrations.map(r => r.userId); // Simplified for solo
    // Shuffle or seed participants here (omitted for brevity)
    
    let currentRound = 1;
    let matchCount = Math.pow(2, Math.ceil(Math.log2(participants.length))) / 2;
    let participantIndex = 0;

    await prisma.$transaction(async (tx) => {
      // Create Round 1 Matches
      for (let i = 0; i < matchCount; i++) {
        const player1Id = participants[participantIndex++] || null;
        const player2Id = participants[participantIndex++] || null;

        await tx.match.create({
          data: {
            tournamentId,
            round: currentRound,
            player1Id,
            player2Id,
            status: (!player1Id || !player2Id) ? "COMPLETED" : "SCHEDULED", // BYE handling
            winnerId: (!player2Id && player1Id) ? player1Id : (!player1Id && player2Id) ? player2Id : null,
          }
        });
      }

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: "UPCOMING" } // Or LIVE depending on schedule
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to generate bracket", error);
    return { success: false, error: "Internal error" };
  }
}

export async function submitMatchResult(
  matchId: string, 
  submitterId: string, 
  score1: number, 
  score2: number, 
  winnerId: string, 
  evidenceUrl?: string
) {
  try {
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return { success: false, error: "Match not found" };
    if (match.status !== "SCHEDULED" && match.status !== "LIVE") {
      return { success: false, error: "Match is not active" };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Record the result submission
      await tx.matchResult.create({
        data: {
          matchId,
          submitterId,
          score1,
          score2,
          winnerId,
          status: "PENDING_CONFIRMATION",
        }
      });

      // 2. Save Evidence if provided
      if (evidenceUrl) {
        await tx.matchEvidence.create({
          data: {
            matchId,
            uploaderId: submitterId,
            fileUrl: evidenceUrl,
            fileType: "image/jpeg", // Simple mock
          }
        });
      }

      // 3. Update Match Status
      await tx.match.update({
        where: { id: matchId },
        data: { status: "AWAITING_RESULT" } // Awaiting opponent confirmation
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Submit result error", error);
    return { success: false, error: "Failed to submit result" };
  }
}

export async function createDispute(matchId: string, creatorId: string, reason: string) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.dispute.create({
        data: {
          matchId,
          creatorId,
          reason,
          status: "OPEN"
        }
      });
      await tx.match.update({
        where: { id: matchId },
        data: { status: "DISPUTED" }
      });
    });
    return { success: true };
  } catch (error) {
    console.error("Create dispute error", error);
    return { success: false, error: "Failed to create dispute" };
  }
}
