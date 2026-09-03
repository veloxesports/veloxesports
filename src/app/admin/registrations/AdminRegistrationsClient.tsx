"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import type { AdminRegistrationItem } from "@/features/admin/actions";
import { updateRegistrationStatus } from "@/features/admin/actions";

type RegistrationItem = AdminRegistrationItem;

type TournamentOption = {
  id: string;
  title: string;
  gameName: string;
};

export function AdminRegistrationsClient({
  registrations,
  tournaments,
}: {
  registrations: RegistrationItem[];
  tournaments: TournamentOption[];
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [tournamentFilter, setTournamentFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredRegistrations = registrations.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (tournamentFilter !== "ALL" && r.tournamentId !== tournamentFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const pName = r.user.profile?.veloxUsername?.toLowerCase() ?? r.user.username?.toLowerCase() ?? r.user.firstName?.toLowerCase() ?? "";
      const tName = r.team?.name?.toLowerCase() ?? "";
      const tourney = r.tournament.title.toLowerCase();
      if (!pName.includes(q) && !tName.includes(q) && !tourney.includes(q)) return false;
    }
    return true;
  });

  const confirmedCount = registrations.filter((r) => r.status === "CONFIRMED").length;
  const pendingCount = registrations.filter((r) => r.status === "PENDING").length;
  const checkedInCount = registrations.filter((r) => r.checkedIn).length;

  function handleUpdateStatus(registrationId: string, status: "CONFIRMED" | "CANCELLED" | "PENDING") {
    startTransition(async () => {
      const result = await updateRegistrationStatus({ registrationId, status });
      if (result.success) {
        setToast({ message: `Registration updated to ${status}.`, type: "success" });
        router.refresh();
      } else {
        setToast({ message: result.error ?? "Failed to update registration status.", type: "error" });
      }
    });
  }

  function handleToggleCheckIn(registrationId: string, currentCheckedIn: boolean) {
    startTransition(async () => {
      const result = await updateRegistrationStatus({ registrationId, checkedIn: !currentCheckedIn });
      if (result.success) {
        setToast({ message: !currentCheckedIn ? "Player checked in." : "Player check-in revoked.", type: "success" });
        router.refresh();
      } else {
        setToast({ message: result.error ?? "Failed to toggle check-in.", type: "error" });
      }
    });
  }

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
          <p className="velox-eyebrow">Entry Administration</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-white sm:text-3xl">
            Tournament Registrations Desk
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#8e998f]">
            Review tournament rosters, confirm pending entries, manage player check-ins, and inspect entry payment records.
          </p>
        </div>
      </header>

      {/* KPI Counters */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-white">{registrations.length}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Total entries</p>
        </div>
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-[#c5f94d]">{confirmedCount}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Confirmed</p>
        </div>
        <div className={`rounded-2xl border p-4 ${pendingCount > 0 ? "border-[#964738]/70 bg-[#2b1916]" : "border-[#2f4530] bg-[#121b12]"}`}>
          <p className={`text-2xl font-black ${pendingCount > 0 ? "text-[#f5c66b]" : "text-white"}`}>{pendingCount}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Pending approval</p>
        </div>
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-[#84d8ff]">{checkedInCount}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Checked in</p>
        </div>
      </section>

      {/* Filters and Search */}
      <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#273628] bg-[#0e150f] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 text-xs">
          {[
            { id: "ALL", label: "All entries" },
            { id: "CONFIRMED", label: `Confirmed (${confirmedCount})` },
            { id: "PENDING", label: `Pending (${pendingCount})` },
            { id: "CANCELLED", label: "Cancelled" },
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
          {/* Tournament select */}
          <select
            value={tournamentFilter}
            onChange={(e) => setTournamentFilter(e.target.value)}
            className="rounded-xl border border-[#2d3e2e] bg-[#121a13] px-3 py-2 text-xs text-white outline-none focus:border-[#c5f94d]"
          >
            <option value="ALL">All tournaments</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="flex items-center gap-2 rounded-xl border border-[#2d3e2e] bg-[#121a13] px-3 py-1.5 text-xs text-[#8e998f]">
            <Search className="h-3.5 w-3.5 text-[#6c7b6c]" />
            <input
              type="text"
              placeholder="Search player, team..."
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

      {/* Registrations Table */}
      <section className="velox-card mt-5 overflow-hidden">
        {filteredRegistrations.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-[#4c5b4c]" aria-hidden />
            <p className="mt-3 font-bold text-white">No registrations found</p>
            <p className="mt-1 text-xs text-[#8e998f]">Try adjusting your filter selection or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#232f24] bg-[#0c130d] text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">
                <tr>
                  <th className="px-5 py-3">Participant</th>
                  <th className="px-4 py-3">Tournament</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Check-In</th>
                  <th className="px-4 py-3">Registered At</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b20]">
                {filteredRegistrations.map((reg) => {
                  const participantName = reg.team
                    ? reg.team.name
                    : reg.user.profile?.veloxUsername ?? reg.user.username ?? reg.user.firstName ?? "Player";
                  const isTeam = Boolean(reg.team);
                  const discordName = reg.user.profile?.discordUsername;

                  return (
                    <tr key={reg.id} className="transition hover:bg-[#131d14]">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {reg.team?.logoUrl || reg.user.profileImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={reg.team?.logoUrl ?? reg.user.profileImage ?? ""} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1c291c] text-xs font-black text-[#c5f94d]">
                              {participantName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-white">{participantName}</p>
                            {discordName && (
                              <p className="flex items-center gap-1 text-[10px] text-[#849bf8]">
                                <MessageSquare className="h-2.5 w-2.5" />
                                <span>@{discordName}</span>
                              </p>
                            )}
                            {isTeam && <p className="text-[10px] font-bold text-[#c5f94d]">TEAM ROSTER</p>}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-xs">
                          <p className="font-bold text-white">{reg.tournament.title}</p>
                          <p className="text-[10px] text-[#8e998f]">{reg.tournament.game.name}</p>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {reg.tournament.isPaid ? (
                          <div className="text-xs">
                            <span className="font-bold text-[#c5f94d]">⭐ {reg.tournament.entryFee} Stars</span>
                            <p className="text-[10px] text-[#8e998f]">{reg.payment?.status ?? "Paid"}</p>
                          </div>
                        ) : (
                          <span className="rounded-md bg-[#162016] px-2 py-0.5 text-[10px] font-bold text-[#9eb09b]">
                            Free Entry
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleCheckIn(reg.id, reg.checkedIn)}
                          disabled={isPending}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] transition ${
                            reg.checkedIn
                              ? "bg-[#1f311c] text-[#c5f94d] border border-[#3e6138] hover:bg-[#2e472a]"
                              : "bg-[#212721] text-[#8e998f] border border-[#313a31] hover:bg-[#2b332b] hover:text-white"
                          }`}
                        >
                          {reg.checkedIn ? "Checked In ✓" : "Not Checked In"}
                        </button>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-[#8e998f]">
                        {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(reg.createdAt))}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${
                          reg.status === "CONFIRMED"
                            ? "bg-[#1f311c] text-[#c5f94d] border border-[#3e6138]"
                            : reg.status === "PENDING"
                            ? "bg-[#2e2617] text-[#f0cf78] border border-[#54462a]"
                            : "bg-[#251717] text-[#ff6f6f] border border-[#502424]"
                        }`}>
                          {reg.status}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {reg.status === "PENDING" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(reg.id, "CONFIRMED")}
                              disabled={isPending}
                              className="rounded-lg bg-[#1f311c] px-2.5 py-1 text-xs font-bold text-[#c5f94d] transition hover:bg-[#2c4528]"
                            >
                              Approve
                            </button>
                          )}
                          {reg.status !== "CANCELLED" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(reg.id, "CANCELLED")}
                              disabled={isPending}
                              className="rounded-lg border border-[#3d2726] bg-[#1a1111] px-2.5 py-1 text-xs font-bold text-[#ff997d] transition hover:border-[#633a38]"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
