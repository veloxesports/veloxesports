import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { createSession } from "@/lib/auth/session";
import {
  appBaseUrl,
  exchangeDiscordCode,
  fetchDiscordUserProfile,
  getDiscordAvatarUrl,
  verifySignedDiscordState,
} from "@/lib/discord/oauth";

const STATE_COOKIE = "velox_discord_oauth_state";

function statusRedirect(status: string, returnTo: string = "profile") {
  const url = new URL("/discord/status", appBaseUrl());
  url.searchParams.set("status", status);
  url.searchParams.set("returnTo", returnTo);
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get("state");
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  // User cancelled or Discord reported error
  if (errorParam === "access_denied") {
    return statusRedirect("cancelled");
  }
  if (errorParam || !state || !code) {
    return statusRedirect("failed");
  }

  // Cryptographically verify HMAC-signed state token
  const statePayload = verifySignedDiscordState(state);
  if (!statePayload) {
    return statusRedirect("invalid_state");
  }

  const returnTo = statePayload.returnTo || "profile";

  try {
    // 1. Exchange code for access token with Discord
    const tokenResult = await exchangeDiscordCode(code);
    if (!tokenResult?.accessToken) {
      return statusRedirect("token_error", returnTo);
    }

    // 2. Fetch user profile from Discord @me
    const discordUser = await fetchDiscordUserProfile(tokenResult.accessToken);
    if (!discordUser?.id) {
      return statusRedirect("identity_error", returnTo);
    }

    // 3. Prevent duplicate account linking across different VELOX users
    const existing = await prisma.userProfile.findFirst({
      where: {
        discordId: discordUser.id,
        userId: { not: statePayload.userId },
      },
    });

    if (existing) {
      return statusRedirect("already_connected", returnTo);
    }

    const avatarUrl = getDiscordAvatarUrl(discordUser);
    const discordUsername = discordUser.username;
    const discordDisplayName = discordUser.global_name || discordUser.username;
    const connectedAt = new Date();

    // 4. Save Discord link in database
    await prisma.userProfile.upsert({
      where: { userId: statePayload.userId },
      update: {
        discordId: discordUser.id,
        discordUsername,
        discordDisplayName,
        discordAvatarUrl: avatarUrl,
        discordConnected: true,
        discordConnectedAt: connectedAt,
      },
      create: {
        userId: statePayload.userId,
        discordId: discordUser.id,
        discordUsername,
        discordDisplayName,
        discordAvatarUrl: avatarUrl,
        discordConnected: true,
        discordConnectedAt: connectedAt,
        favoriteGames: [],
      },
    });

    // 5. If user has a telegramId, maintain or establish the browser session
    const targetUser = await prisma.user.findUnique({
      where: { id: statePayload.userId },
      select: { id: true, telegramId: true },
    });

    if (targetUser) {
      await createSession(targetUser.id, targetUser.telegramId).catch(() => null);
    }

    // 6. Redirect to connected success screen
    const successUrl = new URL("/discord/connected", appBaseUrl());
    successUrl.searchParams.set("id", discordUser.id);
    successUrl.searchParams.set("username", discordUsername);
    if (discordDisplayName) successUrl.searchParams.set("displayName", discordDisplayName);
    if (avatarUrl) successUrl.searchParams.set("avatar", avatarUrl);
    successUrl.searchParams.set("connectedAt", connectedAt.toISOString());
    successUrl.searchParams.set("returnTo", returnTo);

    const response = NextResponse.redirect(successUrl);
    response.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    console.error("Discord connection callback error", error);
    return statusRedirect("failed", returnTo);
  }
}
