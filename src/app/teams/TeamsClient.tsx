"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Check, Copy, Crown, Plus, Shield, Trash2, Trophy, UserMinus, Users, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  createTeam,
  createTeamInvite,
  disbandTeam,
  leaveTeam,
  redeemTeamInvite,
  removeTeamMember,
  transferCaptaincy,
} from "@/features/teams/actions";

type TeamMemberItem = {
  id: string;
  userId: string;
  role: "CAPTAIN" | "MEMBER";
  name: string;
  profileImage: string | null;
  rank: string;
  level: number;
  wins: number;
  losses: number;
  joinedAt: Date;
};

type Team = {
  id: string;
  name: string;
  logoUrl: string | null;
  role: "CAPTAIN" | "MEMBER";
  members: number;
  tournamentEntries: number;
  wins: number;
  losses: number;
  invite: { code: string; expiresAt: Date; uses: number; maxUses: number } | null;
  roster: TeamMemberItem[];
};

export function TeamsClient({ initialTeams }: { initialTeams: Team[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function perform(action: () => Promise<{ success: boolean; error?: string }>, successMessage: string) {
    setIsPending(true);
    setError(null);
    const result = await action();
    setIsPending(false);
    if (!result.success) {
      setError(result.error ?? "Something went wrong. Please try again.");
      return false;
    }
    setMessage(successMessage);
    router.refresh();
    return true;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const success = await perform(() => createTeam({ name: teamName }), "Team created. You are its captain.");
    if (success) {
      setTeamName("");
      setShowCreate(false);
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const success = await perform(() => redeemTeamInvite(inviteCode), "You joined the team.");
    if (success) {
      setInviteCode("");
      setShowJoin(false);
    }
  }

  async function handleInvite(teamId: string) {
    setIsPending(true);
    setError(null);
    const result = await createTeamInvite(teamId);
    setIsPending(false);
    if (!result.success || !result.data) {
      setError(result.error ?? "We couldn't create an invitation.");
      return;
    }
    setMessage(`New team invite: ${result.data.code}`);
    router.refresh();
  }

  async function copyInvite(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setMessage("Invite code copied.");
    } catch {
      setMessage(`Invite code: ${code}`);
    }
  }

  async function handleTransferCaptaincy(teamId: string, member: TeamMemberItem) {
    if (!window.confirm(`Transfer captaincy to ${member.name}? You will become a regular member.`)) return;
    await perform(() => transferCaptaincy({ teamId, newCaptainUserId: member.userId }), `${member.name} is now the team captain.`);
  }

  async function handleRemoveMember(teamId: string, member: TeamMemberItem) {
    if (!window.confirm(`Remove ${member.name} from the team?`)) return;
    await perform(() => removeTeamMember({ teamId, memberUserId: member.userId }), `${member.name} was removed from the team.`);
  }

  async function handleDisbandTeam(team: Team) {
    if (!window.confirm(`Disband ${team.name}? This removes all members and permanently deletes the team.`)) return;
    await perform(() => disbandTeam(team.id), `${team.name} was disbanded.`);
  }

  return (
    <main className="velox-page text-slate-100">
      <header className="flex items-start justify-between gap-3 pt-2">
        <div>
          <p className="velox-eyebrow">Build your squad</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white">Teams</h1>
          <p className="mt-1 text-sm text-slate-400">Build a squad. Compete together.</p>
        </div>
        <Button onClick={() => setShowCreate((value) => !value)} className="h-11 rounded-full bg-[#c5f94d] px-4 font-bold text-[#090d09] hover:bg-[#d5ff70]"><Plus className="mr-1 h-4 w-4" aria-hidden />Create</Button>
      </header>

      <div className="mt-5 flex gap-3">
        <Button onClick={() => setShowJoin((value) => !value)} variant="outline" className="flex-1 border-white/10 bg-slate-900 text-slate-200 hover:bg-slate-800">Join with invite</Button>
        <span className="flex items-center rounded-xl border border-white/10 bg-slate-900 px-3 text-xs font-medium text-slate-400">{initialTeams.length} {initialTeams.length === 1 ? "team" : "teams"}</span>
      </div>

      {error && <Notice tone="error" message={error} />}
      {message && <Notice tone="success" message={message} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 rounded-2xl border border-[#49633d] bg-[#162313] p-4">
          <label className="text-sm font-semibold text-slate-200">
            Team name
            <input value={teamName} onChange={(event) => setTeamName(event.target.value)} required minLength={3} maxLength={32} placeholder="Nightfall Esports" className="mt-2 w-full rounded-xl border border-[#2a352b] bg-[#090d09] px-3 py-3 text-white outline-none focus:border-[#c5f94d]" />
          </label>
          <Button type="submit" disabled={isPending} className="mt-3 w-full bg-[#c5f94d] font-bold text-[#090d09] hover:bg-[#d5ff70]">{isPending ? "Creating…" : "Create team"}</Button>
        </form>
      )}

      {showJoin && (
        <form onSubmit={handleJoin} className="mt-4 rounded-2xl border border-blue-400/20 bg-blue-500/5 p-4">
          <label className="text-sm font-semibold text-slate-200">
            8-character invite code
            <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} required maxLength={8} placeholder="ABC12345" className="mt-2 w-full rounded-xl border border-white/10 bg-black px-3 py-3 font-mono tracking-[0.2em] text-white outline-none focus:border-blue-400" />
          </label>
          <Button type="submit" disabled={isPending} className="mt-3 w-full bg-blue-600 font-bold hover:bg-blue-500">{isPending ? "Joining…" : "Join team"}</Button>
        </form>
      )}

      <section className="mt-6 space-y-5">
        {initialTeams.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-slate-900 p-8 text-center">
            <Shield className="mx-auto h-12 w-12 text-slate-700" aria-hidden />
            <h2 className="mt-3 text-lg font-bold text-white">No teams yet</h2>
            <p className="mt-1 text-sm text-slate-500">Create a team or ask a captain for an invite code.</p>
          </div>
        ) : initialTeams.map((team) => {
          const games = team.wins + team.losses;
          const winRate = games ? Math.round((team.wins / games) * 100) : 0;
          const isCaptain = team.role === "CAPTAIN";

          return (
            <article key={team.id} className="velox-card overflow-hidden p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#426036] bg-[#1a3015]">
                    <Shield className="h-6 w-6 text-[#c5f94d]" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black text-white">{team.name}</h2>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${isCaptain ? "bg-amber-400/10 text-amber-300" : "bg-blue-400/10 text-blue-300"}`}>
                      {team.role}
                    </span>
                  </div>
                </div>
                {!isCaptain && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Leave ${team.name}?`)) {
                        void perform(() => leaveTeam(team.id), "You left the team.");
                      }
                    }}
                    disabled={isPending}
                    className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Leave
                  </button>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 divide-x divide-[#2a352b] rounded-xl border border-[#2a352b] bg-black/40 py-3 text-center">
                <Stat icon={<Users className="h-4 w-4" />} value={String(team.members)} label="Members" />
                <Stat icon={<Trophy className="h-4 w-4" />} value={`${winRate}%`} label="Win rate" />
                <Stat icon={<Check className="h-4 w-4" />} value={String(team.tournamentEntries)} label="Entries" />
              </div>

              {/* Team Roster */}
              <div className="mt-5 border-t border-[#29342a] pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.1em] text-[#aeb8ad]">Team Roster ({team.roster.length})</p>
                </div>
                <div className="mt-3 divide-y divide-[#222c23] rounded-xl border border-[#2a352b] bg-black/30">
                  {team.roster.map((member) => (
                    <div key={member.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-white">{member.name}</p>
                          {member.role === "CAPTAIN" && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300">
                              <Crown className="h-2.5 w-2.5" aria-hidden /> Captain
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#8e998f]">{member.rank} · Level {member.level} · {member.wins}W / {member.losses}L</p>
                      </div>
                      {isCaptain && member.role !== "CAPTAIN" && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            title="Make Captain"
                            onClick={() => void handleTransferCaptaincy(team.id, member)}
                            disabled={isPending}
                            className="flex h-8 items-center gap-1 rounded-lg border border-[#3e5635] bg-[#142012] px-2 text-[11px] font-bold text-[#c5f94d] transition hover:bg-[#1d301a] disabled:opacity-50"
                          >
                            <Crown className="h-3 w-3" aria-hidden />
                            <span className="hidden sm:inline">Make Captain</span>
                          </button>
                          <button
                            type="button"
                            title="Remove from team"
                            onClick={() => void handleRemoveMember(team.id, member)}
                            disabled={isPending}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                          >
                            <UserMinus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Captain Controls & Invites */}
              {isCaptain && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-[#2a352b] bg-black/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Team invite</p>
                        {team.invite ? (
                          <p className="mt-1 font-mono text-base font-black tracking-[0.15em] text-white">{team.invite.code}</p>
                        ) : (
                          <p className="mt-1 text-sm text-slate-500">Create a one-time invite code.</p>
                        )}
                      </div>
                      {team.invite && (
                        <Button onClick={() => copyInvite(team.invite!.code)} variant="outline" className="h-9 border-white/10 bg-slate-900 px-3 text-slate-200 hover:bg-slate-800">
                          <Copy className="h-4 w-4" aria-hidden />
                        </Button>
                      )}
                    </div>
                    <Button onClick={() => handleInvite(team.id)} disabled={isPending} variant="outline" className="mt-3 w-full border-[#577246] text-[#c5f94d] hover:bg-[#c5f94d]/10">
                      {team.invite ? "Replace invite code" : "Create invite code"}
                    </Button>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => void handleDisbandTeam(team)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Disband Team
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return <div className="flex flex-col items-center gap-1 px-2"><span className="text-slate-500">{icon}</span><span className="text-sm font-bold text-white">{value}</span><span className="text-[9px] font-bold uppercase text-slate-500">{label}</span></div>;
}

function Notice({ tone, message }: { tone: "error" | "success"; message: string }) {
  const styles = tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-100" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  const Icon = tone === "error" ? XCircle : Check;
  return <div role="status" className={`mt-4 flex gap-2 rounded-xl border p-3 text-sm ${styles}`}><Icon className="h-4 w-4 shrink-0" aria-hidden />{message}</div>;
}
