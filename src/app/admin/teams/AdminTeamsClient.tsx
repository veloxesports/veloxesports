"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Search,
  Shield,
  X,
} from "lucide-react";
import type { AdminTeamItem } from "@/features/admin/actions";

type TeamItem = AdminTeamItem;

export function AdminTeamsClient({ teams }: { teams: TeamItem[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<TeamItem | null>(null);

  const filteredTeams = teams.filter((team) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const tName = team.name.toLowerCase();
      const cName = team.captain?.profile?.khemoraUsername?.toLowerCase() ?? team.captain?.username?.toLowerCase() ?? "";
      const mMatches = team.members.some((m) => {
        const mName = m.user.profile?.khemoraUsername?.toLowerCase() ?? m.user.username?.toLowerCase() ?? m.user.firstName?.toLowerCase() ?? "";
        return mName.includes(q);
      });
      if (!tName.includes(q) && !cName.includes(q) && !mMatches) return false;
    }
    return true;
  });

  const totalMembers = teams.reduce((acc, t) => acc + t._count.members, 0);

  return (
    <main className="velox-page">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="velox-eyebrow">Roster Administration</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-white sm:text-3xl">
            Team Operations
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#8e998f]">
            Audit registered esports organizations, roster compositions, captains, and tournament participation.
          </p>
        </div>
      </header>

      {/* KPI Counters */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-white">{teams.length}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Registered teams</p>
        </div>
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-[#c5f94d]">{totalMembers}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Total roster players</p>
        </div>
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-[#f0cf78]">
            {teams.reduce((acc, t) => acc + t._count.registrations, 0)}
          </p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Team tournament entries</p>
        </div>
      </section>

      {/* Search Bar */}
      <section className="mt-5 flex items-center justify-between rounded-2xl border border-[#273628] bg-[#0e150f] p-4">
        <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-[#2d3e2e] bg-[#121a13] px-3 py-1.5 text-xs text-[#8e998f]">
          <Search className="h-3.5 w-3.5 text-[#6c7b6c]" />
          <input
            type="text"
            placeholder="Search teams by name or captain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-white outline-none placeholder:text-[#5f6f5f]"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")} className="text-[#8e998f] hover:text-white">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <span className="text-xs text-[#8e998f]">
          Showing <strong>{filteredTeams.length}</strong> team{filteredTeams.length === 1 ? "" : "s"}
        </span>
      </section>

      {/* Teams Grid */}
      <section className="mt-5">
        {filteredTeams.length === 0 ? (
          <div className="velox-card py-16 text-center">
            <Shield className="mx-auto h-10 w-10 text-[#4c5b4c]" aria-hidden />
            <p className="mt-3 font-bold text-white">No teams found</p>
            <p className="mt-1 text-xs text-[#8e998f]">Try adjusting your search query.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTeams.map((team) => {
              const captainName = team.captain?.profile?.khemoraUsername ?? team.captain?.username ?? team.captain?.firstName ?? "Captain";

              return (
                <article key={team.id} className="velox-card flex flex-col overflow-hidden transition hover:border-[#4f6e3e]">
                  {/* Team Card Header */}
                  <div className="flex items-center justify-between border-b border-[#232f24] bg-[#0c130d] px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {team.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={team.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                      ) : (
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#1a291b] text-xs font-black text-[#c5f94d]">
                          {team.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div>
                        <h3 className="font-bold text-white">{team.name}</h3>
                        <p className="text-[10px] text-[#718071]">
                          Created {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(team.createdAt))}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#182419] px-2.5 py-0.5 text-[10px] font-black text-[#c5f94d]">
                      {team._count.members} Members
                    </span>
                  </div>

                  {/* Body */}
                  <div className="flex-1 p-4">
                    <div className="rounded-xl border border-[#232f24] bg-[#0f1610] p-3 text-xs">
                      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#8e998f]">Captain</p>
                      <p className="mt-0.5 font-bold text-white">{captainName}</p>
                    </div>

                    {/* Member Roster Preview */}
                    <div className="mt-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#8e998f]">Roster Preview</p>
                      <div className="mt-2 space-y-1.5">
                        {team.members.slice(0, 4).map((m) => {
                          const mName = m.user.profile?.khemoraUsername ?? m.user.username ?? m.user.firstName ?? "Member";
                          return (
                            <div key={m.id} className="flex items-center justify-between text-xs">
                              <span className="truncate text-[#b6c5b2]">{mName}</span>
                              <span className="text-[10px] font-bold text-[#8e998f]">{m.role}</span>
                            </div>
                          );
                        })}
                        {team.members.length > 4 && (
                          <p className="text-[10px] text-[#718071]">+{team.members.length - 4} more members</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between border-t border-[#232f24] bg-[#0c130d] px-4 py-2.5 text-xs">
                    <span className="text-[#8e998f]">
                      <strong className="text-white">{team._count.registrations}</strong> tournament entries
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedTeam(team)}
                      className="inline-flex items-center gap-1 font-bold text-[#c5f94d] hover:underline"
                    >
                      <span>Full roster</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Team Roster Modal */}
      {selectedTeam && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#020503]/80 p-4 backdrop-blur-[6px]">
          <div className="w-full max-w-lg rounded-[24px] border border-[#40563a] bg-[#0d140e] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.7)]">
            <div className="flex items-center justify-between border-b border-[#232f24] pb-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1c291c] text-sm font-black text-[#c5f94d]">
                  {selectedTeam.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <h2 className="text-lg font-black text-white">{selectedTeam.name}</h2>
                  <p className="text-xs text-[#8e998f]">{selectedTeam.members.length} roster members</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedTeam(null)} className="text-[#8e998f] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
              {selectedTeam.members.map((m) => {
                const memberName = m.user.profile?.khemoraUsername ?? m.user.username ?? m.user.firstName ?? "Member";
                const dName = m.user.profile?.discordUsername;

                return (
                  <div key={m.id} className="flex items-center justify-between rounded-xl border border-[#232f24] bg-[#111911] p-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#1c261c] text-xs font-black text-[#c5f94d]">
                        {memberName.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-bold text-white">{memberName}</p>
                        {dName && (
                          <p className="flex items-center gap-1 text-[10px] text-[#849bf8]">
                            <MessageSquare className="h-2.5 w-2.5" />
                            <span>@{dName}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#1b261b] px-2.5 py-0.5 text-[10px] font-bold text-[#c5f94d]">
                        {m.role}
                      </span>
                      <Link
                        href={`/players/${m.user.profile?.khemoraUsername || m.user.username || m.user.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-1 text-[#8e998f] transition hover:bg-[#1a291b] hover:text-[#c5f94d]"
                        title="View player profile"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 border-t border-[#232f24] pt-4 text-right">
              <button
                type="button"
                onClick={() => setSelectedTeam(null)}
                className="rounded-xl bg-[#1b261c] px-4 py-2 text-xs font-bold text-white hover:bg-[#253626]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
