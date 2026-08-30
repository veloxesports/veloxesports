import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSession } from "@/lib/auth/admin-session";
import { verifyAdminPassword } from "@/lib/auth/admin-password";
import { prisma } from "@/lib/database/prisma";

export const runtime = "nodejs";

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(64).regex(/^[a-z0-9][a-z0-9_.-]*$/),
  password: z.string().min(12).max(128),
});

function response(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return response("Invalid sign-in request.", 403);

  let input: z.infer<typeof loginSchema>;
  try {
    input = loginSchema.parse(await request.json());
  } catch {
    return response("Enter a valid username and password.", 400);
  }

  const account = await prisma.webAdminAccount.findUnique({
    where: { username: input.username },
    select: {
      id: true,
      userId: true,
      passwordHash: true,
      isActive: true,
      failedLoginCount: true,
      lockedUntil: true,
      user: { select: { status: true } },
    },
  });

  if (!account || !account.isActive || account.user.status !== "ACTIVE") return response("Incorrect username or password.", 401);

  if (account.lockedUntil && account.lockedUntil > new Date()) {
    return response("Too many sign-in attempts. Please wait 15 minutes and try again.", 429);
  }

  const passwordIsValid = await verifyAdminPassword(input.password, account.passwordHash);
  if (!passwordIsValid) {
    const nextAttempt = account.failedLoginCount + 1;
    const lockedUntil = nextAttempt >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await prisma.webAdminAccount.update({
      where: { id: account.id },
      data: { failedLoginCount: nextAttempt, lockedUntil },
    });
    return response(lockedUntil ? "Too many sign-in attempts. Please wait 15 minutes and try again." : "Incorrect username or password.", lockedUntil ? 429 : 401);
  }

  await prisma.$transaction([
    prisma.webAdminAccount.update({
      where: { id: account.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    }),
    prisma.user.update({ where: { id: account.userId }, data: { lastLogin: new Date() } }),
  ]);
  await createAdminSession(account.id, account.userId);

  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
