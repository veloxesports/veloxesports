"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, BarChart3, Swords, User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { name: "Home", href: "/", icon: Home },
  { name: "Tournaments", href: "/tournaments", icon: Trophy },
  { name: "Rankings", href: "/leaderboard", icon: BarChart3 },
  { name: "Matches", href: "/matches", icon: Swords },
  { name: "Wallet", href: "/wallet", icon: Wallet },
  { name: "Profile", href: "/profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin") || pathname === "/admin-login" || pathname === "/onboarding") return null;

  const triggerHaptic = () => {
    try {
      if (typeof window !== "undefined" && window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
      }
    } catch {
      // Haptics not supported in browser desktop view
    }
  };

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#1f2c20]/90 bg-[#090e0a]/92 pb-[max(10px,env(safe-area-inset-bottom))] pt-1 backdrop-blur-2xl shadow-[0_-12px_36px_rgba(0,0,0,0.7)]"
    >
      {/* Subtle top ambient glow */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[#c5f94d]/25 to-transparent"
        aria-hidden
      />

      <div className="mx-auto flex h-[66px] max-w-lg items-center justify-around px-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(`${item.href}/`)) ||
            (item.href === "/leaderboard" && pathname.startsWith("/players"));

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={triggerHaptic}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-all duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-[#c5f94d]",
                isActive
                  ? "text-[#c5f94d]"
                  : "text-[#738273] hover:text-[#c4d2c2]"
              )}
            >
              {/* Active top neon indicator pill */}
              {isActive && (
                <span
                  className="absolute top-0.5 h-1 w-6 rounded-full bg-[#c5f94d] shadow-[0_0_12px_rgba(197,249,77,0.85)] animate-in fade-in zoom-in duration-200"
                  aria-hidden
                />
              )}

              <div
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-xl transition-transform duration-200",
                  isActive
                    ? "scale-105 drop-shadow-[0_0_8px_rgba(197,249,77,0.35)]"
                    : "group-hover:scale-105"
                )}
              >
                <Icon
                  className="h-5 w-5 transition-colors"
                  strokeWidth={isActive ? 2.5 : 2}
                  aria-hidden
                />
              </div>

              <span
                className={cn(
                  "truncate text-[10px] tracking-tight transition-colors",
                  isActive
                    ? "font-black text-[#c5f94d]"
                    : "font-semibold text-[#808f81] group-hover:text-[#c4d2c2]"
                )}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
