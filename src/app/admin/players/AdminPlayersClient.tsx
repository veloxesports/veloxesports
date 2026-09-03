"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  MessageSquare,
  Search,
  Users,
  X,
} from "lucide-react";
import type { UserStatus } from "@/lib/generated/prisma/client";
import type { AdminPlayerItem } from "@/features/admin/actions";
import { moderatePlayerStatus } from "@/features/admin/actions";

type PlayerItem = AdminPlayerItem;

export function AdminPlayersClient({
  players,
}: {
  players: PlayerItem[];
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [discordOnly, setDiscordOnly] = useState(false);
  const [moderatingPlayer, setModeratingPlayer] = useState<PlayerItem | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const filteredPlayers = players.filter((player) => {
    if (statusFilter !== "ALL" && player.status !== statusFilter) return false;
    if (discordOnly && !player.profile?.discordConnected) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const uName = player.username?.toLowerCase() ?? "";
      const fName = player.firstName?.toLowerCase() ?? "";
      const vName = player.profile?.veloxUsername?.toLowerCase() ?? "";
      const dName = player.profile?.discordUsername?.toLowerCase() ?? "";
      const dDisp = player.profile?.discordDisplayName?.toLowerCase() ?? "";
      const teleId = player.telegramId.toLowerCase();
      if (!uName.includes(q) && !fName.includes(q) && !vName.includes(q) && !dName.includes(q) && !dDisp.includes(q) && !teleId.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const activeCount = players.filter((p) => p.status === "ACTIVE").length;
  const restrictedCount = players.filter((p) => p.status === "RESTRICTED" || p.status === "SUSPENDED" || p.status === "BANNED").length;
  const discordLinkedCount = players.filter((p) => p.profile?.discordConnected).length;

  return (
    <main className="velox-page">
      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed right-4 top-20 z-[90] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold shadow-[0_18px_55px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:right-6 ${
            toast.type === "success"
              ? "border-[#55783e] bg-[#172417]/95 text-[#e8ffd0]"
              : "border-[#8a4237] bg-[#291715]/95 text-[#ffd5ce]"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 className="h-5 w-5 text-[#c5f94d]" /> : <AlertCircle className="h-5 w-5 text-[#ff8e7d]" />}
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="ml-2 text-current opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="velox-eyebrow">User Administration</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-white sm:text-3xl">
            Player Operations
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#8e998f]">
            Inspect player accounts, monitor Discord connections, audit competitive stats, and manage moderation statuses.
          </p>
        </div>
      </header>

      {/* KPI Counters */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-white">{players.length}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Total players</p>
        </div>
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-[#c5f94d]">{activeCount}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Active status</p>
        </div>
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-[#849bf8]">{discordLinkedCount}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Discord linked</p>
        </div>
        <div className={`rounded-2xl border p-4 ${restrictedCount > 0 ? "border-[#964738]/70 bg-[#2b1916]" : "border-[#2f4530] bg-[#121b12]"}`}>
          <p className={`text-2xl font-black ${restrictedCount > 0 ? "text-[#ffad97]" : "text-white"}`}>{restrictedCount}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Restricted / Suspended</p>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#273628] bg-[#0e150f] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 text-xs">
          {[
            { id: "ALL", label: "All players" },
            { id: "ACTIVE", label: `Active (${activeCount})` },
            { id: "RESTRICTED", label: "Restricted" },
            { id: "SUSPENDED", label: "Suspended" },
            { id: "BANNED", label: "Banned" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 font-bold transition ${
                statusFilter === tab.id
                  ? "bg-[#1f311c] text-[#c5f94d]"
                  : "text-[#8e998f] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Discord only toggle */}
          <button
            type="button"
            onClick={() => setDiscordOnly(!discordOnly)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              discordOnly
                ? "border-[#5865F2] bg-[#242b4d] text-[#849bf8]"
                : "border-[#2d3e2e] bg-[#121a13] text-[#8e998f] hover:text-white"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Discord only</span>
          </button>

          {/* Search input */}
          <div className="flex items-center gap-2 rounded-xl border border-[#2d3e2e] bg-[#121a13] px-3 py-1.5 text-xs text-[#8e998f]">
            <Search className="h-3.5 w-3.5 text-[#6c7b6c]" />
            <input
              type="text"
              placeholder="Search by username, Discord, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-white outline-none placeholder:text-[#5f6f5f]"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="text-[#8e998f] hover:text-white">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Players Table */}
      <section className="velox-card mt-5 overflow-hidden">
        {filteredPlayers.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto h-10 w-10 text-[#4c5b4c]" aria-hidden />
            <p className="mt-3 font-bold text-white">No players match the criteria</p>
            <p className="mt-1 text-xs text-[#8e998f]">Try adjusting your search terms or filter selection.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#232f24] bg-[#0c130d] text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">
                <tr>
                  <th className="px-5 py-3">Player</th>
                  <th className="px-4 py-3">Rank / Level</th>
                  <th className="px-4 py-3">Discord Integration</th>
                  <th className="px-4 py-3">Stats</th>
                  <th className="px-4 py-3">Registrations</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b20]">
                {filteredPlayers.map((player) => {
                  const displayName = player.profile?.veloxUsername ?? player.username ?? player.firstName ?? "Player";
                  const p = player.profile;
                  const winRate = (p?.wins ?? 0) + (p?.losses ?? 0) > 0 ? Math.round(((p?.wins ?? 0) / ((p?.wins ?? 0) + (p?.losses ?? 0))) * 100) : 0;

                  return (
                    <tr key={player.id} className="transition hover:bg-[#131d14]">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {player.profileImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={player.profileImage} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1c291c] text-xs font-black text-[#c5f94d]">
                              {displayName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-white">{displayName}</p>
                            <p className="truncate text-xs text-[#788877]">
                              {player.username ? `@${player.username}` : `TG: ${player.telegramId}`}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-xs">
                          <span className="font-bold text-[#c5f94d]">{p?.rank ?? "BRONZE"}</span>
                          <span className="text-[#8e998f]"> · Lv. {p?.level ?? 1}</span>
                          <p className="text-[10px] text-[#718071]">{p?.xp ?? 0} XP</p>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {p?.discordConnected ? (
                          <div className="flex items-center gap-2">
                            {p.discordAvatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.discordAvatarUrl} alt="" className="h-6 w-6 rounded-full border border-[#5865F2]" />
                            ) : (
                              <MessageSquare className="h-4 w-4 text-[#849bf8]" />
                            )}
                            <div className="text-xs">
                              <p className="font-bold text-[#849bf8]">@{p.discordUsername ?? "unknown"}</p>
                              {p.discordDisplayName && (
                                <p className="text-[10px] text-[#9aabd4]">{p.discordDisplayName}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-[#637263]">Not linked</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-xs">
                          <span className="font-bold text-white">{p?.wins ?? 0}W</span>
                          <span className="text-[#8e998f]"> / {p?.losses ?? 0}L</span>
                          <p className="text-[10px] text-[#8e998f]">{winRate}% win rate</p>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="rounded-lg bg-[#152016] px-2.5 py-1 text-xs font-bold text-white">
                          {player._count.registrations} entries
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <StatusChip status={player.status} />
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setModeratingPlayer(player)}
                          className="rounded-lg border border-[#2b3a2c] bg-[#121a13] px-2.5 py-1 text-xs font-bold text-[#b6c5b2] transition hover:border-[#527448] hover:text-white"
                        >
                          Moderate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Moderation Modal */}
      {moderatingPlayer && (
        <ModeratePlayerModal
          player={moderatingPlayer}
          onClose={() => setModeratingPlayer(null)}
          onSuccess={(msg) => {
            setModeratingPlayer(null);
            setToast({ message: msg, type: "success" });
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-[#1f311c] text-[#c5f94d] border border-[#3e6138]",
    RESTRICTED: "bg-[#2e2617] text-[#f0cf78] border border-[#54462a]",
    SUSPENDED: "bg-[#381e1a] text-[#ffad9a] border border-[#6b352e]",
    BANNED: "bg-[#251717] text-[#ff6f6f] border border-[#502424]",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${styles[status] ?? styles.ACTIVE}`}>
      {status}
    </span>
  );
}

function ModeratePlayerModal({
  player,
  onClose,
  onSuccess,
}: {
  player: PlayerItem;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [status, setStatus] = useState<string>(player.status);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerName = player.profile?.veloxUsername ?? player.username ?? player.firstName ?? "Player";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await moderatePlayerStatus({
      userId: player.id,
      status: status as UserStatus,
      reason: reason.trim() || undefined,
    });

    setPending(false);
    if (result.success) {
      onSuccess(`Status for ${playerName} updated to ${status}.`);
    } else {
      setError(result.error ?? "Failed to update moderation status.");
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#020503]/80 p-4 backdrop-blur-[6px]">
      <div className="w-full max-w-md rounded-[24px] border border-[#40563a] bg-[#0d140e] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between border-b border-[#232f24] pb-4">
          <div>
            <p className="velox-eyebrow">Moderation Desk</p>
            <h2 className="mt-0.5 text-lg font-black text-white">Moderate {playerName}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-[#8e998f] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-[#8a4237] bg-[#291715] p-3 text-xs text-[#ffd5ce]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#b6c5b2]">Platform Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#2d3e2e] bg-[#121a13] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#c5f94d]"
            >
              <option value="ACTIVE">ACTIVE (Full access)</option>
              <option value="RESTRICTED">RESTRICTED (Tournament entry blocked)</option>
              <option value="SUSPENDED">SUSPENDED (Temporary platform lockout)</option>
              <option value="BANNED">BANNED (Permanent ban)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#b6c5b2]">Moderation Reason (Recorded in audit trail)</label>
            <textarea
              rows={3}
              placeholder="State reason for restriction or suspension..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#2d3e2e] bg-[#121a13] p-3 text-sm text-white outline-none placeholder:text-[#5f6f5f] focus:border-[#c5f94d]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#232f24] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#2d3e2e] bg-transparent px-4 py-2 text-xs font-bold text-[#9eb09b] transition hover:bg-[#1a251b] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl bg-[#c5f94d] px-4 py-2 text-xs font-black text-[#0a0e0a] transition hover:bg-[#d5ff70] disabled:opacity-50"
            >
              {pending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
              <span>Update status</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
