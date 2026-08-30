import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/auth/admin-session";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.get("host")) {
        return NextResponse.json({ error: "Invalid sign-out request." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid sign-out request." }, { status: 403 });
    }
  }

  await clearAdminSession();
  return NextResponse.redirect(new URL("/admin-login", request.url), { status: 303 });
}
