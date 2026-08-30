import { prisma } from "@/lib/database/prisma";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const chatRequestSchema = z.object({
  message: z.string().trim().min(1, "Ask a question first.").max(600),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(600),
      }),
    )
    .max(6)
    .default([]),
});

type TournamentContext = {
  title: string;
  gameName: string;
  status: string;
  prizePool: number;
  entryFee: number;
  isPaid: boolean;
  currentParticipants: number;
  maxParticipants: number;
  registrationDeadline: Date;
  startDate: Date;
};

type RateLimitWindow = { count: number; resetAt: number };

const rateLimitWindows = new Map<string, RateLimitWindow>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 12;

function getClientIdentifier(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function canRequestAnswer(request: Request) {
  const now = Date.now();
  const clientIdentifier = getClientIdentifier(request);
  const current = rateLimitWindows.get(clientIdentifier);

  if (!current || current.resetAt <= now) {
    rateLimitWindows.set(clientIdentifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  current.count += 1;
  return true;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatTournament(tournament: TournamentContext) {
  const fee = tournament.isPaid ? `${tournament.entryFee} Telegram Stars` : "Free entry";
  return `${tournament.title} — ${tournament.gameName}; status: ${tournament.status.replaceAll("_", " ")}; ${tournament.currentParticipants}/${tournament.maxParticipants} players; ${fee}; prize pool: ${tournament.prizePool} Stars; registration closes ${formatDate(tournament.registrationDeadline)}; starts ${formatDate(tournament.startDate)}.`;
}

function fallbackAnswer(question: string, tournaments: TournamentContext[]) {
  const normalized = question.toLowerCase();

  if (/(tournament|event|join|register|registration|upcoming)/.test(normalized)) {
    const registrationOpen = tournaments.filter((tournament) => tournament.status === "REGISTRATION_OPEN");
    if (registrationOpen.length > 0) {
      const eventList = registrationOpen
        .slice(0, 3)
        .map((tournament) => `${tournament.title} (${tournament.gameName}, ${tournament.currentParticipants}/${tournament.maxParticipants})`)
        .join(" · ");
      return `Open for registration: ${eventList}. Open Tournaments, choose an event, and tap Join. Paid events show a Telegram Stars invoice; free events confirm immediately when there is space.`;
    }
    return "No event is currently marked open for registration. Check Tournaments for upcoming and live events, and return when registration opens.";
  }

  if (/(star|payment|pay|refund|wallet|fee)/.test(normalized)) {
    return "Paid tournament entry is handled through a Telegram Stars invoice. Select the event, tap Join, and approve the Telegram payment. Your wallet shows completed activity. Refunds are handled by VELOX moderators where the event is eligible—never send Stars directly to another player.";
  }

  if (/(match|result|score|evidence|dispute|report)/.test(normalized)) {
    return "Open your game in Match Center to submit a result. You can attach an optional screenshot as evidence. Your opponent can confirm or reject it; if there is a problem, open a dispute with a clear explanation so moderators can review it.";
  }

  if (/(team|invite|captain)/.test(normalized)) {
    return "Go to Teams to create a squad or join one with an 8-character invite code from its captain. Captains can create team invites; never post invite codes publicly if you want to keep the team private.";
  }

  if (/(hello|hi|hey|what is velox|about)/.test(normalized)) {
    return "VELOX is a Telegram esports tournament platform. You can discover events, register, manage matches, join teams, track rankings, and review your wallet activity in one place.";
  }

  return "I can help with tournament discovery and registration, Telegram Stars payments, match results and disputes, teams, rankings, and wallet activity. Try asking about one of those.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractOpenAiText(value: unknown) {
  if (!isRecord(value)) return null;
  if (typeof value.output_text === "string" && value.output_text.trim()) return value.output_text.trim();
  if (!Array.isArray(value.output)) return null;

  const text = value.output
    .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
    .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text.trim() : ""))
    .filter(Boolean)
    .join("\n")
    .trim();

  return text || null;
}

function buildInstructions(tournaments: TournamentContext[]) {
  const eventContext = tournaments.length
    ? tournaments.map(formatTournament).join("\n")
    : "No active or upcoming tournament records are available right now.";

  return `You are VELOX Guide, the concise support assistant inside an esports tournament app.

You can help only with VELOX, its current public tournaments, registration, Telegram Stars payments, wallet activity, matches, results/evidence/disputes, teams, referrals, rankings, and profiles. Do not perform actions, claim you changed account data, or request passwords, API keys, payment details, or private codes. Never invent tournament dates, prizes, availability, rules, policies, or a player's account information. If context does not answer a question, say what is unavailable and point the player to the relevant VELOX screen. Be friendly, practical, and under 150 words. Use short bullets only when they make steps clearer.

Current public tournament context:
${eventContext}`;
}

async function getTournamentContext(): Promise<TournamentContext[]> {
  const tournaments = await prisma.tournament.findMany({
    where: { status: { in: ["REGISTRATION_OPEN", "UPCOMING", "CHECK_IN", "LIVE"] } },
    select: {
      title: true,
      prizePool: true,
      entryFee: true,
      isPaid: true,
      currentParticipants: true,
      maxParticipants: true,
      registrationDeadline: true,
      startDate: true,
      status: true,
      game: { select: { name: true } },
    },
    orderBy: [{ startDate: "asc" }],
    take: 8,
  });

  return tournaments.map((tournament) => ({
    title: tournament.title,
    gameName: tournament.game.name,
    status: tournament.status,
    prizePool: tournament.prizePool,
    entryFee: tournament.entryFee,
    isPaid: tournament.isPaid,
    currentParticipants: tournament.currentParticipants,
    maxParticipants: tournament.maxParticipants,
    registrationDeadline: tournament.registrationDeadline,
    startDate: tournament.startDate,
  }));
}

async function askOpenAi(message: string, history: Array<{ role: "user" | "assistant"; content: string }>, tournaments: TournamentContext[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const conversation = [...history, { role: "user" as const, content: message }]
    .map((entry) => `${entry.role === "assistant" ? "Guide" : "Player"}: ${entry.content}`)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.4",
      instructions: buildInstructions(tournaments),
      input: conversation,
      max_output_tokens: 300,
      store: false,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("VELOX Guide OpenAI request failed", response.status, detail.slice(0, 500));
    return null;
  }

  return extractOpenAiText(await response.json());
}

export async function POST(request: Request) {
  if (!canRequestAnswer(request)) {
    return Response.json({ error: "Please wait a moment before sending another question." }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Please send a valid question." }, { status: 400 });
  }

  const parsedRequest = chatRequestSchema.safeParse(payload);
  if (!parsedRequest.success) {
    return Response.json({ error: "Questions must be between 1 and 600 characters." }, { status: 400 });
  }

  let tournaments: TournamentContext[] = [];
  try {
    tournaments = await getTournamentContext();
  } catch (error) {
    console.error("VELOX Guide tournament context failed", error);
  }

  try {
    const answer = await askOpenAi(parsedRequest.data.message, parsedRequest.data.history, tournaments);
    if (answer) return Response.json({ answer, source: "ai" });
  } catch (error) {
    console.error("VELOX Guide AI response failed", error);
  }

  return Response.json({
    answer: fallbackAnswer(parsedRequest.data.message, tournaments),
    source: "faq",
  });
}
