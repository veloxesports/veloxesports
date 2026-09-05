import "server-only";

import crypto from "crypto";
import { cookies } from "next/headers";

const ADMIN_SESSION_COOKIE = "khemora_admin_session";
const LEGACY_ADMIN_SESSION_COOKIE = "velox_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

type AdminSession = {
  accountId: string;
  userId: string;
  expiresAt: number;
};

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("ADMIN_SESSION_SECRET or SESSION_SECRET must be configured with at least 32 characters");
  return secret;
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(`admin:${value}`).digest("base64url");
}

function serialize(session: AdminSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function deserialize(value: string): AdminSession | null {
  const [payload, signature, ...rest] = value.split(".");
  if (!payload || !signature || rest.length > 0) return null;

  try {
    const expected = Buffer.from(sign(payload));
    const provided = Buffer.from(signature);
    if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (!session.accountId || !session.userId || !Number.isSafeInteger(session.expiresAt) || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function createAdminSession(accountId: string, userId: string) {
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000;
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, serialize({ accountId, userId, expiresAt }), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
    priority: "high",
  });
}

export async function getAdminSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? cookieStore.get(LEGACY_ADMIN_SESSION_COOKIE)?.value;
    return token ? deserialize(token) : null;
  } catch {
    return null;
  }
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  cookieStore.delete(LEGACY_ADMIN_SESSION_COOKIE);
}
