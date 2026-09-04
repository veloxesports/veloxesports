"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Command,
  Compass,
  LayoutDashboard,
  Menu,
  MessageSquare,
  MonitorPlay,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react";

type NavCounts = {
  disputes: number;
  finance: number;
  matches: number;
  registrations: number;
  notifications?: number;
};

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  countKey?: keyof NavCounts;
  external?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navigationSections: NavSection[] = [
  {
    title: "Competition",
    items: [
      { label: "Command Center", href: "/admin", icon: LayoutDashboard },
      { label: "Tournaments", href: "/admin/tournaments", icon: Trophy },
      { label: "Matches", href: "/admin/matches", icon: Swords, countKey: "matches" as const },
      { label: "Registrations", href: "/admin/registrations", icon: ClipboardList, countKey: "registrations" as const },
      { label: "Disputes", href: "/admin/disputes", icon: ShieldAlert, countKey: "disputes" as const },
    ],
  },
  {
    title: "Community",
    items: [
      { label: "Players", href: "/admin/players", icon: Users },
      { label: "Teams", href: "/admin/teams", icon: Shield },
      { label: "Discord", href: "/admin/discord", icon: MessageSquare },
      { label: "Notifications", href: "/admin/notifications", icon: Bell, countKey: "notifications" as const },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Finance", href: "/admin/finance", icon: CircleDollarSign, countKey: "finance" as const },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  ADMIN: ["*"],
  TOURNAMENT_MANAGER: [
    "/admin",
    "/admin/tournaments",
    "/admin/matches",
    "/admin/registrations",
    "/admin/disputes",
    "/admin/players",
    "/admin/teams",
    "/admin/discord",
    "/admin/notifications",
  ],
  FINANCE_MANAGER: ["/admin", "/admin/finance", "/admin/analytics"],
  MODERATOR: ["/admin", "/admin/disputes", "/admin/matches", "/admin/players", "/admin/teams"],
  SUPPORT: ["/admin", "/admin/registrations", "/admin/players", "/admin/discord", "/admin/notifications"],
};

function isRouteAllowed(role: string, href: string): boolean {
  const allowed = ROLE_ALLOWED_ROUTES[role] ?? ["/admin"];
  if (allowed.includes("*")) return true;
  return allowed.includes(href);
}

function getBreadcrumbs(pathname: string) {
  if (pathname === "/admin") return [{ label: "Command Center", href: "/admin" }];

  const segments = pathname.replace(/^\/admin\/?/, "").split("/").filter(Boolean);
  const crumbs = [{ label: "Command Center", href: "/admin" }];

  let currentPath = "/admin";
  for (const seg of segments) {
    currentPath += `/${seg}`;
    const name = seg.replace(/[-_]/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    crumbs.push({ label: name, href: currentPath });
  }

  return crumbs;
}

export function AdminWorkspace({
  children,
  adminName,
  adminRole,
  counts,
}: {
  children: ReactNode;
  adminName: string;
  adminRole: string;
  counts: NavCounts;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const paletteInputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      } else if (e.key === "Escape" && paletteOpen) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paletteOpen]);

  useEffect(() => {
    if (paletteOpen) {
      setTimeout(() => paletteInputRef.current?.focus(), 50);
    }
  }, [paletteOpen]);

  function goToSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (term.length >= 2) {
      router.push(`/admin/search?q=${encodeURIComponent(term)}`);
      setQuery("");
      setMobileOpen(false);
      setPaletteOpen(false);
    }
  }

  const breadcrumbs = getBreadcrumbs(pathname);

  // Filter sections by role
  const visibleSections = navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isRouteAllowed(adminRole, item.href)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className={`admin-shell ${collapsed ? "admin-shell--collapsed" : ""}`}>
      <button
        type="button"
        aria-label="Open admin navigation"
        onClick={() => setMobileOpen(true)}
        className="admin-mobile-menu"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close admin navigation"
          onClick={() => setMobileOpen(false)}
          className="admin-drawer-scrim"
        />
      )}

      {/* Admin Sidebar */}
      <aside
        className={`admin-sidebar ${mobileOpen ? "admin-sidebar--open" : ""}`}
        aria-label="Admin navigation"
      >
        <div className="admin-sidebar__brand">
          <Link
            href="/admin"
            className="flex min-w-0 items-center gap-3"
            onClick={() => setMobileOpen(false)}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#c5f94d] text-base font-black tracking-tighter text-[#090d09]">
              {"//"}
            </span>
            <span className="admin-sidebar__wordmark text-sm font-black tracking-[0.22em] text-white">
              VELOX
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="admin-collapse-button"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronLeft className="h-4 w-4" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="admin-mobile-close"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Grouped Navigation */}
        <nav className="admin-sidebar__nav">
          {visibleSections.map((section, idx) => (
            <div key={section.title} className={idx > 0 ? "mt-4 pt-3 border-t border-[#1e2a1f]" : ""}>
              {!collapsed && (
                <p className="admin-sidebar__section text-[10px] font-black uppercase tracking-[0.14em] text-[#718570] px-3 pb-1.5">
                  {section.title}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const count = item.countKey ? (counts[item.countKey] ?? 0) : 0;

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`admin-nav-link ${active ? "admin-nav-link--active" : ""}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                      <span className="admin-nav-link__label">{item.label}</span>
                      {count > 0 && (
                        <span className="admin-nav-link__badge">
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                      {item.external && (
                        <MonitorPlay className="admin-nav-link__external h-3.5 w-3.5" aria-hidden />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="admin-sidebar__footer">
          <Link href="/" className="admin-player-link">
            <MonitorPlay className="h-4 w-4" aria-hidden />
            <span>Player app</span>
            <ChevronRight className="ml-auto h-3.5 w-3.5" aria-hidden />
          </Link>
          <div className="admin-user-card">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#253820] text-xs font-black text-[#c5f94d]">
              {adminName.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 admin-sidebar__user">
              <span className="block truncate text-xs font-black text-white">{adminName}</span>
              <span className="mt-0.5 block truncate text-[10px] font-bold uppercase tracking-[0.1em] text-[#92a18f]">
                {adminRole.replaceAll("_", " ")}
              </span>
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="admin-content">
        <header className="admin-topbar">
          {/* Breadcrumb Navigation Trail */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#8e998f] min-w-0 mr-4">
            <Compass className="h-3.5 w-3.5 text-[#c5f94d] shrink-0" />
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <div key={crumb.href} className="flex items-center gap-1.5 min-w-0">
                  {idx > 0 && <span className="text-[#4e604f]">/</span>}
                  {isLast ? (
                    <span className="truncate font-black text-white">{crumb.label}</span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="truncate font-semibold text-[#8e998f] hover:text-[#c5f94d] transition"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Search & Command Palette Trigger */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="admin-search flex items-center justify-between text-left cursor-pointer transition hover:border-[#4d6645]"
            aria-label="Open global search and command palette"
          >
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[#8e998f]" aria-hidden />
              <span className="text-xs text-[#6e7d6f] hidden sm:inline">Search platform or press</span>
              <span className="text-xs text-[#6e7d6f] sm:hidden">Search…</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono bg-[#162117] border border-[#2e4030] px-1.5 py-0.5 rounded text-[#9bb09c]">
              <Command className="h-2.5 w-2.5" /> K
            </kbd>
          </button>

          {/* Topbar Right Actions */}
          <div className="admin-topbar__actions">
            <Link href="/admin/tournaments" className="admin-create-button">
              <span className="hidden sm:inline">Create tournament</span>
              <span className="sm:hidden">Create</span>
            </Link>
            <Link
              href="/admin/notifications"
              className="admin-icon-button"
              aria-label="Open notifications and announcements"
            >
              <Bell className="h-4 w-4" aria-hidden />
            </Link>
            <form action="/api/admin/auth/logout" method="post">
              <button
                type="submit"
                className="admin-avatar"
                aria-label="Sign out of the Command Center"
              >
                {adminName.slice(0, 1).toUpperCase()}
              </button>
            </form>
          </div>
        </header>

        {/* Command Palette Modal */}
        {paletteOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[100] flex items-start justify-center bg-[#020503]/80 p-4 pt-16 sm:pt-24 backdrop-blur-[6px]"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPaletteOpen(false);
            }}
          >
            <div className="w-full max-w-xl rounded-[24px] border border-[#40563a] bg-[#0c130d] shadow-[0_25px_80px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <form onSubmit={goToSearch} className="flex items-center border-b border-[#232f24] px-4 py-3.5">
                <Search className="h-4 w-4 text-[#c5f94d] shrink-0 mr-3" />
                <input
                  ref={paletteInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a destination or search players & tournaments..."
                  className="w-full bg-transparent text-sm text-white placeholder:text-[#5f6f5f] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setPaletteOpen(false)}
                  className="rounded-lg p-1 text-[#8e998f] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </form>

              <div className="p-3 max-h-[60vh] overflow-y-auto">
                {query.trim().length >= 2 ? (
                  <div className="p-3 text-center">
                    <p className="text-xs text-[#8e998f]">
                      Press <strong className="text-white">Enter</strong> to run global search for &ldquo;{query}&rdquo;
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        router.push(`/admin/search?q=${encodeURIComponent(query.trim())}`);
                        setPaletteOpen(false);
                        setQuery("");
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#c5f94d] px-4 py-2 text-xs font-black text-[#080d09]"
                    >
                      <Search className="h-3.5 w-3.5" />
                      <span>Search All Records</span>
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#6c7d6c]">
                      Quick Destinations
                    </p>
                    <div className="space-y-1">
                      {[
                        { label: "Tournaments Directory & Editor", href: "/admin/tournaments", icon: Trophy, cat: "Competition" },
                        { label: "Live Matches Desk & Brackets", href: "/admin/matches", icon: Swords, cat: "Competition" },
                        { label: "Registrations & Check-In Queue", href: "/admin/registrations", icon: ClipboardList, cat: "Competition" },
                        { label: "Match Disputes Review", href: "/admin/disputes", icon: ShieldAlert, cat: "Competition" },
                        { label: "Player Operations & Moderation", href: "/admin/players", icon: Users, cat: "Community" },
                        { label: "Teams & Squad Rosters", href: "/admin/teams", icon: Shield, cat: "Community" },
                        { label: "Discord Community Integrations", href: "/admin/discord", icon: MessageSquare, cat: "Community" },
                        { label: "Broadcast Alerts & Notifications", href: "/admin/notifications", icon: Bell, cat: "Community" },
                        { label: "Revenue, Ledgers & Stars Refunds", href: "/admin/finance", icon: CircleDollarSign, cat: "Platform" },
                        { label: "Analytics & Growth Insights", href: "/admin/analytics", icon: BarChart3, cat: "Platform" },
                        { label: "System Parameters & Admin Accounts", href: "/admin/settings", icon: Settings, cat: "Platform" },
                      ]
                        .filter((item) => isRouteAllowed(adminRole, item.href))
                        .map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.href}
                              type="button"
                              onClick={() => {
                                router.push(item.href);
                                setPaletteOpen(false);
                              }}
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-bold text-[#c7d5c5] transition hover:bg-[#152216] hover:text-white"
                            >
                              <div className="flex items-center gap-2.5">
                                <Icon className="h-4 w-4 text-[#c5f94d]" />
                                <span>{item.label}</span>
                              </div>
                              <span className="text-[10px] font-medium text-[#647665] uppercase tracking-wider">
                                {item.cat}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-[#232f24] bg-[#080d09] px-4 py-2.5 text-[11px] text-[#69796a]">
                <span>Navigation & Search</span>
                <span>ESC to close</span>
              </div>
            </div>
          </div>
        )}

        <div className="admin-content__body">{children}</div>
      </div>
    </div>
  );
}
