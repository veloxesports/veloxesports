import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/database/prisma";

const STATE_COOKIE = "velox_discord_oauth_state";
const tokenSchema = z.object({ access_token: z.string().min(1) });
const discordUserSchema = z.object({
  id: z.string().min(1).max(32),
  username: z.string().min(1).max(64),
  global_name: z.string().max(64).nullable().optional(),
  avatar: z.string().max(256).nullable().optional(),
});

function appUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!value) throw new Error("NEXT_PUBLIC_APP_URL is not configured");
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL must be an HTTP(S) URL");
  }
  return url;
}

function settingsRedirect(status: string) {
  const url = new URL("/settings", appUrl());
  url.searchParams.set("discord", status);
  return NextResponse.redirect(url);
}

function stateMatches(expected: string | undefined, actual: string | null) {
  if (!expected || !actual) return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function withStateCookieCleared(response: NextResponse) {
  response.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/api/discord/callback" });
  return response;
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  if (!stateMatches(expectedState, state) || !code) {
    return withStateCookieCleared(settingsRedirect("cancelled"));
  }

  try {
    const user = await requireCurrentUser();
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    if (!clientId || !clientSecret) return withStateCookieCleared(settingsRedirect("unavailable"));

    const redirectUri = new URL("/api/discord/callback", appUrl()).toString();
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      cache: "no-store",
    });
    const token = tokenSchema.safeParse(await tokenResponse.json().catch(() => null));
    if (!tokenResponse.ok || !token.success) return withStateCookieCleared(settingsRedirect("failed"));

    const identityResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token.data.access_token}` },
      cache: "no-store",
    });
    const identity = discordUserSchema.safeParse(await identityResponse.json().catch(() => null));
    if (!identityResponse.ok || !identity.success) return withStateCookieCleared(settingsRedirect("failed"));

    const avatarUrl = identity.data.avatar
      ? `https://cdn.discordapp.com/avatars/${identity.data.id}/${identity.data.avatar}.png?size=128`
      : null;

    await prisma.userProfile.update({
      where: { userId: user.id },
      data: {
        discordId: identity.data.id,
        discordUsername: identity.data.global_name || identity.data.username,
        discordAvatarUrl: avatarUrl,
      },
    });

    return withStateCookieCleared(settingsRedirect("connected"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return withStateCookieCleared(settingsRedirect("already_connected"));
    }
    console.error("Discord connection failed", error);
    return withStateCookieCleared(settingsRedirect("failed"));
  }
}
