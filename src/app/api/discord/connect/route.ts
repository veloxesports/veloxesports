import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";

const STATE_COOKIE = "velox_discord_oauth_state";
const STATE_MAX_AGE_SECONDS = 10 * 60;

function appUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!value) throw new Error("NEXT_PUBLIC_APP_URL is not configured");

  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL must be an HTTP(S) URL");
  }
  return url;
}

function settingsUrl(status: string) {
  const url = new URL("/settings", appUrl());
  url.searchParams.set("discord", status);
  return url;
}

export async function GET() {
  try {
    await requireCurrentUser();

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(settingsUrl("unavailable"));
    }

    const redirectUri = new URL("/api/discord/callback", appUrl()).toString();
    const state = crypto.randomBytes(32).toString("base64url");
    const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
    authorizeUrl.search = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: "identify",
      state,
    }).toString();

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: STATE_MAX_AGE_SECONDS,
      path: "/api/discord/callback",
    });
    return response;
  } catch (error) {
    console.error("Discord connection could not be started", error);
    try {
      return NextResponse.redirect(settingsUrl("auth_required"));
    } catch {
      return new NextResponse("Discord connection is unavailable.", { status: 503 });
    }
  }
}
