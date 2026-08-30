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
  if (pathname.startsWith("/admin")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#253026] bg-[#090d09]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-3xl items-center justify-around px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`) && item.href !== "/";
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1.5 whitespace-nowrap text-[9px] font-bold transition-colors sm:text-[10px]",
                isActive ? "text-[#c5f94d]" : "text-[#8e998f] hover:text-[#dce3d6]"
              )}
            >
              <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
