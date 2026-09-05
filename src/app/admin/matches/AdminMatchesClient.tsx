"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  LoaderCircle,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import type { MatchStatus } from "@/lib/generated/prisma/client";
import type { AdminMatchItem } from "@/features/admin/actions";
import { createAdminMatch, updateAdminMatch } from "@/features/admin/actions";
import { confirmMatchResult } from "@/features/matches/actions";
import { AdminDateTimePicker } from "@/components/admin/AdminDateTimePicker";

type MatchItem = AdminMatchItem;

type TournamentOption = {
  id: string;
  title: string;
  gameId: string;
  gameName: string;
};

export function AdminMatchesClient({
  matches,
  tournaments,
}: {
  matches: MatchItem[];
  tournaments: TournamentOption[];
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [tournamentFilter, setTournamentFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingMatch, setEditingMatch] = useState<MatchItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filter matches
  const filteredMatches = matches.filter((match) => {
    if (statusFilter !== "ALL" && match.status !== statusFilter) return false;
    if (tournamentFilter !== "ALL" && match.tournamentId !== tournamentFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const p1 = match.player1?.profile?.khemoraUsername?.toLowerCase() ?? match.player1?.username?.toLowerCase() ?? match.team1?.name?.toLowerCase() ?? "";
      const p2 = match.player2?.profile?.khemoraUsername?.toLowerCase() ?? match.player2?.username?.toLowerCase() ?? match.team2?.name?.toLowerCase() ?? "";
      const tourney = match.tournamentTitle.toLowerCase();
      const game = match.gameName.toLowerCase();
      if (!p1.includes(q) && !p2.includes(q) && !tourney.includes(q) && !game.includes(q)) return false;
    }
    return true;
  });

  const liveCount = matches.filter((m) => m.status === "LIVE").length;
  const disputedCount = matches.filter((m) => m.status === "DISPUTED").length;
  const awaitingCount = matches.filter((m) => m.status === "AWAITING_RESULT" || m.status === "UNDER_REVIEW").length;
  const completedCount = matches.filter((m) => m.status === "COMPLETED").length;

  function handleConfirmResult(matchId: string) {
    startTransition(async () => {
      const result = await confirmMatchResult(matchId);
      if (result.success) {
        setToast({ message: "Match result verified and confirmed.", type: "success" });
        router.refresh();
      } else {
        setToast({ message: result.error ?? "Failed to confirm match result.", type: "error" });
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
          <p className="velox-eyebrow">Competition Operations</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-white sm:text-3xl">
            Match Operations Desk
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#8e998f]">
            Monitor live brackets, enter or verify scores, manage fixtures, and resolve match disputes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#c5f94d] px-3.5 py-2 text-xs font-black text-[#0a0e0a] transition hover:bg-[#d5ff70]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span>Create fixture</span>
          </button>
        </div>
      </header>

      {/* Metric Counters */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-white">{matches.length}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Total matches</p>
        </div>
        <div className={`rounded-2xl border p-4 ${liveCount > 0 ? "border-[#4f6e3e] bg-[#182616]" : "border-[#2f4530] bg-[#121b12]"}`}>
          <p className={`text-2xl font-black ${liveCount > 0 ? "text-[#c5f94d]" : "text-white"}`}>{liveCount}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Live fixtures</p>
        </div>
        <div className={`rounded-2xl border p-4 ${disputedCount > 0 ? "border-[#964738]/70 bg-[#2b1916]" : "border-[#2f4530] bg-[#121b12]"}`}>
          <p className={`text-2xl font-black ${disputedCount > 0 ? "text-[#ffad97]" : "text-white"}`}>{disputedCount}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Disputed</p>
        </div>
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-white">{completedCount}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Completed</p>
        </div>
      </section>

      {/* Filter and Search Controls */}
      <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#273628] bg-[#0e150f] p-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-1 text-xs">
          {[
            { id: "ALL", label: "All fixtures" },
            { id: "LIVE", label: `Live (${liveCount})` },
            { id: "AWAITING_RESULT", label: `Awaiting result (${awaitingCount})` },
            { id: "DISPUTED", label: `Disputed (${disputedCount})` },
            { id: "SCHEDULED", label: "Scheduled" },
            { id: "COMPLETED", label: `Completed (${completedCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 font-bold transition ${
                statusFilter === tab.id
                  ? "bg-[#1f311c] text-[#c5f94d] shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                  : "text-[#8e998f] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tournament filter */}
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

      {/* Match List */}
      <section className="mt-5">
        {filteredMatches.length === 0 ? (
          <div className="velox-card py-16 text-center">
            <Swords className="mx-auto h-10 w-10 text-[#4c5b4c]" aria-hidden />
            <p className="mt-3 font-bold text-white">No matches found</p>
            <p className="mt-1 text-xs text-[#8e998f]">
              {statusFilter !== "ALL" || tournamentFilter !== "ALL" || searchQuery
                ? "Try adjusting your filters or search query."
                : "Matches will appear once brackets are generated."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredMatches.map((match) => {
              const p1Name = match.player1?.profile?.khemoraUsername ?? match.player1?.username ?? match.team1?.name ?? "TBD";
              const p2Name = match.player2?.profile?.khemoraUsername ?? match.player2?.username ?? match.team2?.name ?? "TBD";
              const p1Discord = match.player1?.profile?.discordUsername;
              const p2Discord = match.player2?.profile?.discordUsername;

              return (
                <article
                  key={match.id}
                  className={`velox-card flex flex-col overflow-hidden transition hover:border-[#4f6e3e] ${
                    match.status === "DISPUTED" ? "border-[#8a4237]" : match.status === "LIVE" ? "border-[#405d33]" : ""
                  }`}
                >
                  {/* Card Header */}
                  <div className="border-b border-[#232f24] bg-[#0c130d] px-4 py-3">
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="font-black uppercase tracking-[0.08em] text-[#c5f94d]">
                        {match.gameName} · Round {match.round}
                      </span>
                      <StatusBadge status={match.status} />
                    </div>
                    <p className="mt-1 truncate text-xs font-bold text-[#b6c5b2]">{match.tournamentTitle}</p>
                  </div>

                  {/* Competitors & Score */}
                  <div className="flex-1 p-4">
                    <div className="space-y-3">
                      {/* Competitor 1 */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#1a261b] text-xs font-black text-[#c5f94d]">
                            {p1Name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white">{p1Name}</p>
                            {p1Discord && (
                              <p className="flex items-center gap-1 text-[10px] text-[#849bf8]">
                                <MessageSquare className="h-2.5 w-2.5" />
                                <span>@{p1Discord}</span>
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="rounded-lg bg-[#182419] px-2.5 py-1 text-sm font-black text-white">
                          {match.score1 ?? "–"}
                        </span>
                      </div>

                      <div className="text-center">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#556654]">VS</span>
                      </div>

                      {/* Competitor 2 */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#1a261b] text-xs font-black text-[#c5f94d]">
                            {p2Name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white">{p2Name}</p>
                            {p2Discord && (
                              <p className="flex items-center gap-1 text-[10px] text-[#849bf8]">
                                <MessageSquare className="h-2.5 w-2.5" />
                                <span>@{p2Discord}</span>
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="rounded-lg bg-[#182419] px-2.5 py-1 text-sm font-black text-white">
                          {match.score2 ?? "–"}
                        </span>
                      </div>
                    </div>

                    {/* Dispute Alert Box if Disputed */}
                    {match.disputes.length > 0 && (
                      <div className="mt-4 rounded-xl border border-[#7a3830] bg-[#241413] p-3 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-[#ffad97]">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          <span>Open Dispute Reported</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[#cbb2ad]">{match.disputes[0]?.reason}</p>
                        <Link
                          href="/admin/disputes"
                          className="mt-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#ffad97] hover:underline"
                        >
                          <span>Go to dispute resolution</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                    )}

                    {/* Schedule date */}
                    {match.scheduledTime && (
                      <p className="mt-3 flex items-center gap-1 text-[10px] text-[#718071]">
                        <Clock className="h-3 w-3" />
                        <span>Scheduled: {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(match.scheduledTime))}</span>
                      </p>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between border-t border-[#232f24] bg-[#0c130d] px-4 py-2.5">
                    <div className="flex items-center gap-1 text-xs">
                      {match.status === "AWAITING_RESULT" || match.status === "UNDER_REVIEW" ? (
                        <button
                          type="button"
                          onClick={() => handleConfirmResult(match.id)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#1f311c] px-2.5 py-1.5 text-xs font-bold text-[#c5f94d] transition hover:bg-[#2c4528]"
                        >
                          <Check className="h-3 w-3" />
                          <span>Confirm result</span>
                        </button>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingMatch(match)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#2b3a2c] bg-[#121a13] px-2.5 py-1.5 text-xs font-bold text-white transition hover:border-[#4c664b] hover:bg-[#1a251b]"
                      >
                        <Pencil className="h-3 w-3 text-[#c5f94d]" />
                        <span>Edit score</span>
                      </button>
                      <Link
                        href={`/admin/tournaments/${match.tournamentId}`}
                        className="rounded-lg border border-[#2b3a2c] bg-[#121a13] p-1.5 text-[#8e998f] transition hover:text-white"
                        title="View tournament"
                      >
                        <Trophy className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Edit Match Score / Status Modal */}
      {editingMatch && (
        <EditMatchModal
          match={editingMatch}
          onClose={() => setEditingMatch(null)}
          onSuccess={(msg) => {
            setEditingMatch(null);
            setToast({ message: msg, type: "success" });
            router.refresh();
          }}
        />
      )}

      {/* Create Match Modal */}
      {showCreateModal && (
        <CreateMatchModal
          tournaments={tournaments}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(msg) => {
            setShowCreateModal(false);
            setToast({ message: msg, type: "success" });
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    LIVE: "bg-[#1f311c] text-[#c5f94d] border border-[#3e6138]",
    SCHEDULED: "bg-[#182319] text-[#9eb09b] border border-[#2a3a2b]",
    AWAITING_RESULT: "bg-[#2e2617] text-[#f0cf78] border border-[#54462a]",
    UNDER_REVIEW: "bg-[#1c2930] text-[#8ee7ec] border border-[#314b58]",
    DISPUTED: "bg-[#381e1a] text-[#ffad9a] border border-[#6b352e]",
    COMPLETED: "bg-[#152016] text-[#8fa08e] border border-[#243325]",
    CANCELLED: "bg-[#251717] text-[#a07c7c] border border-[#402727]",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${styles[status] ?? styles.SCHEDULED}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function EditMatchModal({
  match,
  onClose,
  onSuccess,
}: {
  match: MatchItem;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [score1, setScore1] = useState<number | "">(match.score1 ?? "");
  const [score2, setScore2] = useState<number | "">(match.score2 ?? "");
  const [status, setStatus] = useState<string>(match.status);
  const [scheduledTime, setScheduledTime] = useState<string>(
    match.scheduledTime ? new Date(match.scheduledTime).toISOString().slice(0, 16) : ""
  );
  const [winnerId, setWinnerId] = useState<string>(match.winnerId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const p1Name = match.player1?.profile?.khemoraUsername ?? match.player1?.username ?? match.team1?.name ?? "Competitor 1";
  const p2Name = match.player2?.profile?.khemoraUsername ?? match.player2?.username ?? match.team2?.name ?? "Competitor 2";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await updateAdminMatch({
      matchId: match.id,
      score1: score1 === "" ? null : Number(score1),
      score2: score2 === "" ? null : Number(score2),
      status: status as MatchStatus,
      winnerId: winnerId || null,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
    });

    setPending(false);
    if (result.success) {
      onSuccess("Match details updated successfully.");
    } else {
      setError(result.error ?? "Failed to update match.");
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#020503]/80 p-4 backdrop-blur-[6px]">
      <div className="w-full max-w-lg rounded-[24px] border border-[#40563a] bg-[#0d140e] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between border-b border-[#232f24] pb-4">
          <div>
            <p className="velox-eyebrow">Match Editor</p>
            <h2 className="mt-0.5 text-lg font-black text-white">Update Match Scores</h2>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#b6c5b2]">{p1Name} Score</label>
              <input
                type="number"
                min="0"
                max="999"
                value={score1}
                onChange={(e) => setScore1(e.target.value === "" ? "" : Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[#2d3e2e] bg-[#121a13] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#c5f94d]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#b6c5b2]">{p2Name} Score</label>
              <input
                type="number"
                min="0"
                max="999"
                value={score2}
                onChange={(e) => setScore2(e.target.value === "" ? "" : Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[#2d3e2e] bg-[#121a13] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#c5f94d]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#b6c5b2]">Winner</label>
            <select
              value={winnerId}
              onChange={(e) => setWinnerId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#2d3e2e] bg-[#121a13] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#c5f94d]"
            >
              <option value="">No winner decided yet</option>
              {match.player1Id && <option value={match.player1Id}>{p1Name}</option>}
              {match.player2Id && <option value={match.player2Id}>{p2Name}</option>}
              {match.team1Id && <option value={match.team1Id}>{p1Name}</option>}
              {match.team2Id && <option value={match.team2Id}>{p2Name}</option>}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#b6c5b2]">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#2d3e2e] bg-[#121a13] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#c5f94d]"
              >
                <option value="SCHEDULED">Scheduled</option>
                <option value="LIVE">Live</option>
                <option value="AWAITING_RESULT">Awaiting result</option>
                <option value="UNDER_REVIEW">Under review</option>
                <option value="DISPUTED">Disputed</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div className="col-span-full">
              <AdminDateTimePicker
                name="scheduledTime"
                label="Scheduled Time"
                value={scheduledTime ? new Date(scheduledTime) : null}
                onChange={(d) => setScheduledTime(d ? d.toISOString() : "")}
                placeholder="Set scheduled fixture time..."
                helperText=""
              />
            </div>
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
              <span>Save match</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateMatchModal({
  tournaments,
  onClose,
  onSuccess,
}: {
  tournaments: TournamentOption[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [tournamentId, setTournamentId] = useState(tournaments[0]?.id ?? "");
  const [round, setRound] = useState(1);
  const [scheduledTime, setScheduledTime] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tournamentId) {
      setError("Please select a tournament.");
      return;
    }
    setPending(true);
    setError(null);

    const result = await createAdminMatch({
      tournamentId,
      round: Number(round),
      scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
      status: "SCHEDULED",
    });

    setPending(false);
    if (result.success) {
      onSuccess("New fixture created.");
    } else {
      setError(result.error ?? "Failed to create match.");
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#020503]/80 p-4 backdrop-blur-[6px]">
      <div className="w-full max-w-lg rounded-[24px] border border-[#40563a] bg-[#0d140e] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between border-b border-[#232f24] pb-4">
          <div>
            <p className="velox-eyebrow">Fixture Operations</p>
            <h2 className="mt-0.5 text-lg font-black text-white">Create New Fixture</h2>
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
            <label className="block text-xs font-bold text-[#b6c5b2]">Tournament</label>
            <select
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#2d3e2e] bg-[#121a13] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#c5f94d]"
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.gameName})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#b6c5b2]">Round number</label>
              <input
                type="number"
                min="1"
                max="50"
                value={round}
                onChange={(e) => setRound(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[#2d3e2e] bg-[#121a13] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#c5f94d]"
              />
            </div>
            <div className="col-span-full">
              <AdminDateTimePicker
                name="scheduledTime"
                label="Scheduled Time"
                value={scheduledTime ? new Date(scheduledTime) : null}
                onChange={(d) => setScheduledTime(d ? d.toISOString() : "")}
                placeholder="Set scheduled fixture time..."
                helperText=""
              />
            </div>
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
              <span>Create fixture</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
