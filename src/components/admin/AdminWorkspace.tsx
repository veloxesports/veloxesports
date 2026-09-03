"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bell, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardList, LayoutDashboard, Menu, MessageSquare, MonitorPlay, Search, Settings, Shield, ShieldAlert, Swords, Trophy, Users, X } from "lucide-react";

type NavCounts = { disputes: number; finance: number; matches: number; registrations: number; notifications?: number };

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  countKey?: keyof NavCounts;
  external?: boolean;
};

const navigation: NavItem[] = [
  { label: "Command Center", href: "/admin", icon: LayoutDashboard },
  { label: "Tournaments", href: "/admin/tournaments", icon: Trophy },
  { label: "Matches", href: "/admin/matches", icon: Swords, countKey: "matches" as const },
  { label: "Players", href: "/admin/players", icon: Users },
  { label: "Teams", href: "/admin/teams", icon: Shield },
  { label: "Registrations", href: "/admin/registrations", icon: ClipboardList, countKey: "registrations" as const },
  { label: "Discord", href: "/admin/discord", icon: MessageSquare },
  { label: "Notifications", href: "/admin/notifications", icon: Bell, countKey: "notifications" as const },
  { label: "Disputes", href: "/admin/disputes", icon: ShieldAlert, countKey: "disputes" as const },
  { label: "Finance", href: "/admin/finance", icon: CircleDollarSign, countKey: "finance" as const },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminWorkspace({ children, adminName, adminRole, counts }: { children: ReactNode; adminName: string; adminRole: string; counts: NavCounts }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  function goToSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (term.length >= 2) {
      router.push(`/admin/search?q=${encodeURIComponent(term)}`);
      setQuery("");
      setMobileOpen(false);
    }
  }

  return (
    <div className={`admin-shell ${collapsed ? "admin-shell--collapsed" : ""}`}>
      <button type="button" aria-label="Open admin navigation" onClick={() => setMobileOpen(true)} className="admin-mobile-menu"><Menu className="h-5 w-5" aria-hidden /></button>
      {mobileOpen && <button type="button" aria-label="Close admin navigation" onClick={() => setMobileOpen(false)} className="admin-drawer-scrim" />}
      <aside className={`admin-sidebar ${mobileOpen ? "admin-sidebar--open" : ""}`} aria-label="Admin navigation">
        <div className="admin-sidebar__brand">
          <Link href="/admin" className="flex min-w-0 items-center gap-3" onClick={() => setMobileOpen(false)}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#c5f94d] text-base font-black tracking-tighter text-[#090d09]">{"//"}</span>
            <span className="admin-sidebar__wordmark text-sm font-black tracking-[0.22em] text-white">VELOX</span>
          </Link>
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="admin-collapse-button" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}>{collapsed ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronLeft className="h-4 w-4" aria-hidden />}</button>
          <button type="button" onClick={() => setMobileOpen(false)} className="admin-mobile-close" aria-label="Close navigation"><X className="h-4 w-4" aria-hidden /></button>
        </div>
        <p className="admin-sidebar__section">Operations</p>
        <nav className="admin-sidebar__nav">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const count = item.countKey ? (counts[item.countKey] ?? 0) : 0;
            return <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className={`admin-nav-link ${active ? "admin-nav-link--active" : ""}`} title={collapsed ? item.label : undefined}><Icon className="h-[18px] w-[18px] shrink-0" aria-hidden /><span className="admin-nav-link__label">{item.label}</span>{count > 0 && <span className="admin-nav-link__badge">{count > 99 ? "99+" : count}</span>}{item.external && <MonitorPlay className="admin-nav-link__external h-3.5 w-3.5" aria-hidden />}</Link>;
          })}
        </nav>
        <div className="admin-sidebar__footer">
          <Link href="/" className="admin-player-link"><MonitorPlay className="h-4 w-4" aria-hidden /><span>Player app</span><ChevronRight className="ml-auto h-3.5 w-3.5" aria-hidden /></Link>
          <div className="admin-user-card"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#253820] text-xs font-black text-[#c5f94d]">{adminName.slice(0, 1).toUpperCase()}</span><span className="min-w-0 admin-sidebar__user"><span className="block truncate text-xs font-black text-white">{adminName}</span><span className="mt-0.5 block truncate text-[10px] font-bold uppercase tracking-[0.1em] text-[#92a18f]">{adminRole.replaceAll("_", " ")}</span></span></div>
        </div>
      </aside>
      <div className="admin-content">
        <header className="admin-topbar">
          <form onSubmit={goToSearch} className="admin-search"><Search className="h-4 w-4" aria-hidden /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search players and tournaments…" aria-label="Search players and tournaments" /><kbd>Enter</kbd></form>
          <div className="admin-topbar__actions">
            <Link href="/admin/tournaments" className="admin-create-button"><span className="hidden sm:inline">Create tournament</span><span className="sm:hidden">Create</span></Link>
            <Link href="/admin/notifications" className="admin-icon-button" aria-label="Open notifications and announcements"><Bell className="h-4 w-4" aria-hidden /></Link>
            <form action="/api/admin/auth/logout" method="post"><button type="submit" className="admin-avatar" aria-label="Sign out of the Command Center">{adminName.slice(0, 1).toUpperCase()}</button></form>
          </div>
        </header>
        {query.trim() && <div className="admin-search-results" role="status">{query.trim().length < 2 ? <span>Enter at least two characters.</span> : <span>Press Enter to search players and tournaments.</span>}</div>}
        <div className="admin-content__body">{children}</div>
      </div>
    </div>
  );
}
