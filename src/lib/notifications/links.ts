import type { NotificationType } from "@/lib/generated/prisma/client";

export type NotificationTarget = {
  href: string;
  label: string;
};

function metadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function safePathSegment(value: string | null) {
  return value ? encodeURIComponent(value) : null;
}

/** Resolves both in-app cards and Telegram actions to the same relevant Khemora screen. */
export function notificationTarget(type: NotificationType | string, metadata: unknown): NotificationTarget {
  const matchId = safePathSegment(metadataValue(metadata, "matchId"));
  if (matchId) return { href: `/matches/${matchId}`, label: "Open match" };

  const tournamentSlug = safePathSegment(metadataValue(metadata, "tournamentSlug"));
  if (tournamentSlug) return { href: `/tournaments/${tournamentSlug}`, label: "Open tournament" };
  if (metadataValue(metadata, "tournamentId")) return { href: "/tournaments", label: "Open tournaments" };

  if (type === "PAYMENT" || metadataValue(metadata, "paymentId") || metadataValue(metadata, "refundId")) {
    return { href: "/wallet", label: "Open wallet" };
  }
  if (type === "ACHIEVEMENT" || type === "TEAM") return { href: "/profile", label: "Open profile" };
  return { href: "/notifications", label: "Open alerts" };
}

/** Telegram Web App buttons require an HTTPS URL. Local development keeps in-app links without sending a bot button. */
export function notificationMiniAppUrl(href: string) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredUrl) return null;

  try {
    const appUrl = new URL(configuredUrl);
    if (appUrl.protocol !== "https:") return null;
    return new URL(href, appUrl).toString();
  } catch {
    return null;
  }
}
