import crypto from "node:crypto";
import { z } from "zod";

const STATE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

export type DiscordOAuthStatePayload = {
  userId: string;
  telegramId?: string;
  returnTo?: string;
  nonce: string;
  exp: number;
};

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

const discordUserSchema = z.object({
  id: z.string().min(1).max(32),
  username: z.string().min(1).max(64),
  global_name: z.string().max(64).nullable().optional(),
  avatar: z.string().max(256).nullable().optional(),
  discriminator: z.string().max(8).optional(),
});

export type DiscordUserProfile = z.infer<typeof discordUserSchema>;

/**
 * Returns the CDN avatar URL for a Discord user, or a deterministic fallback avatar.
 */
export function getDiscordAvatarUrl(user: { id: string; avatar?: string | null }): string {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
  }
  try {
    const defaultIndex = Math.abs(Number(BigInt(user.id) >> BigInt(22)) % 6);
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
}

function getSecretKey(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return "khemora-discord-oauth-signing-secret-default-32-chars";
  }
  return secret;
}

export function isDiscordOAuthConfigured(): boolean {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
}

export function appBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_APP_URL || "https://khemoraesports.vercel.app";
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.origin;
    }
  } catch {
    // ignore
  }
  return "https://khemoraesports.vercel.app";
}

export function discordRedirectUri(): string {
  return `${appBaseUrl()}/api/discord/callback`;
}

/**
 * Creates an HMAC-signed state token containing user identity and return destination.
 * This guarantees that even if OAuth completes in an external mobile browser without
 * cookies, the server can cryptographically verify the user who initiated the connection.
 */
export function createSignedDiscordState(data: {
  userId: string;
  telegramId?: string;
  returnTo?: string;
}): string {
  const payload: DiscordOAuthStatePayload = {
    userId: data.userId,
    telegramId: data.telegramId,
    returnTo: data.returnTo || "profile",
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + STATE_MAX_AGE_MS,
  };
  const serialized = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getSecretKey()).update(serialized).digest("base64url");
  return `${serialized}.${signature}`;
}

/**
 * Verifies the HMAC-signed state token and checks that it has not expired.
 */
export function verifySignedDiscordState(stateString: string): DiscordOAuthStatePayload | null {
  if (!stateString || typeof stateString !== "string") return null;
  const [data, signature, ...rest] = stateString.split(".");
  if (!data || !signature || rest.length > 0) return null;

  try {
    const expectedSig = crypto.createHmac("sha256", getSecretKey()).update(data).digest("base64url");
    const providedBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as DiscordOAuthStatePayload;
    if (!payload.userId || !payload.exp || payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generates the Discord OAuth 2.0 authorization URL.
 */
export function buildDiscordAuthorizeUrl(signedState: string): string {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    throw new Error("DISCORD_CLIENT_ID is not configured");
  }

  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: discordRedirectUri(),
    scope: "identify",
    state: signedState,
    prompt: "consent",
  }).toString();

  return url.toString();
}

/**
 * Exchanges authorization code for access token with Discord API.
 */
export async function exchangeDiscordCode(code: string): Promise<{ accessToken: string } | null> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: discordRedirectUri(),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Discord token exchange returned error status:", response.status);
      return null;
    }

    const json = await response.json().catch(() => null);
    const parsed = tokenResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.error("Discord token response schema mismatch:", parsed.error);
      return null;
    }

    return { accessToken: parsed.data.access_token };
  } catch (error) {
    console.error("Discord token exchange network failure:", error);
    return null;
  }
}

/**
 * Fetches user profile from Discord @me endpoint.
 */
export async function fetchDiscordUserProfile(accessToken: string): Promise<DiscordUserProfile | null> {
  try {
    const response = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Discord user fetch returned status:", response.status);
      return null;
    }

    const json = await response.json().catch(() => null);
    const parsed = discordUserSchema.safeParse(json);
    if (!parsed.success) {
      console.error("Discord user profile schema mismatch:", parsed.error);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.error("Discord user profile fetch network failure:", error);
    return null;
  }
}
