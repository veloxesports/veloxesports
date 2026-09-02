import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  appBaseUrl,
  buildDiscordAuthorizeUrl,
  createSignedDiscordState,
  isDiscordOAuthConfigured,
} from "@/lib/discord/oauth";

const STATE_COOKIE = "velox_discord_oauth_state";
const STATE_MAX_AGE_SECONDS = 15 * 60;

export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo") || "profile";
  const user = await getCurrentUser();

  if (!user) {
    const errorUrl = new URL("/discord/status", appBaseUrl());
    errorUrl.searchParams.set("status", "auth_required");
    errorUrl.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(errorUrl);
  }

  if (!isDiscordOAuthConfigured()) {
    const errorUrl = new URL("/discord/status", appBaseUrl());
    errorUrl.searchParams.set("status", "unavailable");
    errorUrl.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(errorUrl);
  }

  try {
    const signedState = createSignedDiscordState({
      userId: user.id,
      telegramId: user.telegramId,
      returnTo,
    });

    const authorizeUrl = buildDiscordAuthorizeUrl(signedState);
    const response = NextResponse.redirect(authorizeUrl);

    response.cookies.set(STATE_COOKIE, signedState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: STATE_MAX_AGE_SECONDS,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Discord connection initiation failed", error);
    const errorUrl = new URL("/discord/status", appBaseUrl());
    errorUrl.searchParams.set("status", "failed");
    errorUrl.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(errorUrl);
  }
}
