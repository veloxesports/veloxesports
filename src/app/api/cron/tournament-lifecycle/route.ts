import { NextRequest, NextResponse } from "next/server";
import { runTournamentLifecycle } from "@/lib/tournaments/lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const summary = await runTournamentLifecycle();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("Tournament lifecycle cron failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
