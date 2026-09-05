"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Command,
  Compass,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  MonitorPlay,
  PanelLeftClose,
  PanelLeftOpen,
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
      { label: "Finance & Stars", href: "/admin/finance", icon: CircleDollarSign, countKey: "finance" as const },
      { label: "Analytics & KPIs", href: "/admin/analytics", icon: BarChart3 },
      { label: "Settings & Logs", href: "/admin/settings", icon: Settings },
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

const SIDEBAR_STORAGE_KEY = "velox_admin_sidebar_collapsed";
const sidebarListeners = new Set<() => void>();

function subscribeToSidebar(listener: () => void) {
  sidebarListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    sidebarListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSidebarSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getSidebarServerSnapshot(): boolean {
  return false;
}

function toggleSidebarStorage() {
  if (typeof window === "undefined") return;
  try {
    const current = localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!current));
    sidebarListeners.forEach((fn) => fn());
  } catch {
    // Ignore
  }
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

  // Desktop sidebar collapsed state with useSyncExternalStore persistence
  const isCollapsed = useSyncExternalStore(
    subscribeToSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot
  );

  // Mobile / tablet off-canvas drawer open state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (mobileOpen) {
      setMobileOpen(false);
    }
  }

  // Quick Command Palette state
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const paletteInputRef = useRef<HTMLInputElement>(null);

  // Collapsible sections state in expanded mode
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Competition: true,
    Community: true,
    Platform: true,
  });

  const toggleCollapsed = () => {
    toggleSidebarStorage();
  };

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [title]: prev[title] === undefined ? false : !prev[title],
    }));
  };

  // Handle ESC key to close mobile drawer or command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mobileOpen) setMobileOpen(false);
        if (paletteOpen) setPaletteOpen(false);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, paletteOpen]);

  // Focus input when palette opens
  useEffect(() => {
    if (paletteOpen) {
      setTimeout(() => paletteInputRef.current?.focus(), 60);
    }
  }, [paletteOpen]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

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

  // Filter sections by authenticated role
  const visibleSections = navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isRouteAllowed(adminRole, item.href)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className={`admin-shell ${isCollapsed ? "admin-shell--collapsed" : ""}`}>
      {/* Mobile Backdrop Scrim */}
      {mobileOpen && (
        <div
          role="presentation"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
          className="admin-drawer-scrim"
        />
      )}

      {/* Production-Grade Sidebar */}
      <aside
        className={`admin-sidebar ${mobileOpen ? "admin-sidebar--open" : ""}`}
        aria-label="Admin navigation"
      >
        {/* Pinned Brand Header */}
        <div className="admin-sidebar__brand">
          <Link
            href="/admin"
            className="flex min-w-0 items-center gap-3 group"
            onClick={() => setMobileOpen(false)}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#c5f94d] text-base font-black tracking-tighter text-[#090d09] shadow-[0_0_15px_rgba(197,249,77,0.3)] transition group-hover:scale-105">
              {"//"}
            </span>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-black tracking-[0.2em] text-white">
                  VELOX
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#788e76]">
                  Admin Console
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse / Expand Toggle Button */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="admin-collapse-button hidden lg:grid"
            aria-label={isCollapsed ? "Expand sidebar navigation" : "Collapse sidebar navigation"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden />
            )}
          </button>

          {/* Mobile Drawer Close Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="admin-mobile-close lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Vertically Scrollable Navigation Area */}
        <nav className="admin-sidebar__nav" role="navigation">
          {visibleSections.map((section, idx) => {
            const isSectionExpanded = expandedSections[section.title] !== false;

            return (
              <div key={section.title} className={idx > 0 && !isCollapsed ? "pt-2" : ""}>
                {/* Section Header */}
                {!isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#718570] hover:text-[#c5f94d] transition-colors rounded-lg group"
                    aria-expanded={isSectionExpanded}
                  >
                    <span>{section.title}</span>
                    <ChevronDown
                      className={`h-3 w-3 text-[#586b57] group-hover:text-[#c5f94d] transition-transform duration-200 ${
                        isSectionExpanded ? "" : "-rotate-90"
                      }`}
                      aria-hidden
                    />
                  </button>
                ) : (
                  idx > 0 && <div className="mx-2 my-2 h-px bg-[#1d291e]" aria-hidden />
                )}

                {/* Section Items */}
                {(isCollapsed || isSectionExpanded) && (
                  <div className="mt-1 space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active =
                        item.href === "/admin"
                          ? pathname === "/admin"
                          : pathname === item.href || pathname.startsWith(`${item.href}/`);
                      const count = item.countKey ? (counts[item.countKey] ?? 0) : 0;

                      return (
                        <div key={item.label} className="group relative">
                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={`admin-nav-link ${active ? "admin-nav-link--active" : ""}`}
                            aria-current={active ? "page" : undefined}
                          >
                            <Icon
                              className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                                active ? "text-[#c5f94d]" : "text-[#8e9f8c] group-hover:text-white"
                              }`}
                              aria-hidden
                            />
                            {!isCollapsed && (
                              <>
                                <span className="truncate flex-1">{item.label}</span>
                                {count > 0 && (
                                  <span className="admin-nav-link__badge">
                                    {count > 99 ? "99+" : count}
                                  </span>
                                )}
                                {item.external && (
                                  <ExternalLink className="h-3 w-3 text-[#556955] group-hover:text-[#c5f94d]" aria-hidden />
                                )}
                              </>
                            )}
                          </Link>

                          {/* Floating Tooltip in Collapsed Mode */}
                          {isCollapsed && (
                            <div className="admin-tooltip">
                              <div className="flex items-center gap-2 rounded-xl border border-[#2f4230] bg-[#0c140e]/95 px-3 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.85)] backdrop-blur-md">
                                <span className="text-xs font-bold text-white">{item.label}</span>
                                {count > 0 && (
                                  <span className="rounded-full bg-[#c5f94d] px-1.5 py-0.2 text-[9px] font-black text-[#080d09]">
                                    {count}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Pinned Bottom Footer */}
        <div className="admin-sidebar__footer">
          {/* Player App Switcher */}
          {!isCollapsed ? (
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-player-link"
              title="Open Player Telegram Mini App"
            >
              <MonitorPlay className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate flex-1">Player App</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            </Link>
          ) : (
            <div className="group relative w-full flex justify-center">
              <Link
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="grid h-9 w-9 place-items-center rounded-xl border border-[#273827] bg-[#101711] text-[#c5f94d] hover:border-[#4d6d3d] hover:bg-[#152016] transition"
                aria-label="Open Player App"
              >
                <MonitorPlay className="h-4 w-4" aria-hidden />
              </Link>
              <div className="admin-tooltip">
                <div className="rounded-xl border border-[#2f4230] bg-[#0c140e]/95 px-3 py-1.5 text-xs font-bold text-white shadow-xl backdrop-blur-md">
                  Open Player App ↗
                </div>
              </div>
            </div>
          )}

          {/* Admin User Card */}
          {!isCollapsed ? (
            <div className="admin-user-card">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#253820] text-xs font-black text-[#c5f94d]">
                  {adminName.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-white">{adminName}</p>
                  <p className="truncate text-[9px] font-bold uppercase tracking-wider text-[#8b9e89]">
                    {adminRole.replaceAll("_", " ")}
                  </p>
                </div>
              </div>
              <form action="/api/admin/auth/logout" method="post">
                <button
                  type="submit"
                  className="grid h-7 w-7 place-items-center rounded-lg border border-[#243425] bg-[#121913] text-[#7d8f7b] hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition"
                  title="Sign out of Admin Dashboard"
                  aria-label="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          ) : (
            <div className="group relative w-full flex justify-center">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#253820] text-xs font-black text-[#c5f94d] cursor-pointer">
                {adminName.slice(0, 1).toUpperCase()}
              </span>
              <div className="admin-tooltip">
                <div className="rounded-xl border border-[#2f4230] bg-[#0c140e]/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md min-w-[140px]">
                  <p className="font-bold text-white">{adminName}</p>
                  <p className="text-[9px] text-[#8b9e89] uppercase tracking-wider">{adminRole.replaceAll("_", " ")}</p>
                  <div className="mt-2 border-t border-[#233324] pt-1.5">
                    <form action="/api/admin/auth/logout" method="post">
                      <button
                        type="submit"
                        className="flex w-full items-center gap-1.5 text-[10px] font-bold text-red-400 hover:text-red-300"
                      >
                        <LogOut className="h-3 w-3" />
                        <span>Sign out</span>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="admin-content">
        <header className="admin-topbar">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger Menu Button (Mobile & Tablet) */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-[#263527] bg-[#0e150f] text-[#c5f94d] hover:bg-[#152216] transition active:scale-95 shrink-0"
              aria-label="Open navigation drawer"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>

            {/* Desktop Quick Sidebar Collapse Toggle in Topbar */}
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg border border-[#263527] bg-[#0e150f] text-[#8e9f8c] hover:text-white hover:border-[#4d6a40] transition active:scale-95 shrink-0"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>

            {/* Breadcrumbs Navigation Trail */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-[#8e998f] min-w-0">
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
          </div>

          {/* Quick Search & Command Palette Trigger */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="admin-search flex items-center justify-between text-left cursor-pointer transition hover:border-[#4d6645] mx-2"
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
              title="Notifications"
            >
              <Bell className="h-4 w-4" aria-hidden />
            </Link>
            <form action="/api/admin/auth/logout" method="post">
              <button
                type="submit"
                className="admin-avatar"
                aria-label="Sign out of the Command Center"
                title={`Signed in as ${adminName} (${adminRole}) - Click to sign out`}
              >
                {adminName.slice(0, 1).toUpperCase()}
              </button>
            </form>
          </div>
        </header>

        {/* Global Command Palette Modal */}
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
