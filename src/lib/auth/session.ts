import crypto from "crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "velox_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type Session = {
  userId: string;
  telegramId: string;
  expiresAt: number;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters");
  }

  return secret;
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function serialize(session: Session) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function deserialize(value: string): Session | null {
  const [payload, signature, ...rest] = value.split(".");
  if (!payload || !signature || rest.length > 0) return null;

  try {
    const expectedSignature = sign(payload);
    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return null;
    }

    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (!session.userId || !session.telegramId || !Number.isSafeInteger(session.expiresAt) || session.expiresAt <= Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, telegramId: string) {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, serialize({ userId, telegramId, expiresAt }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function getSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    return token ? deserialize(token) : null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
