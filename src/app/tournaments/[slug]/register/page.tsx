"use client";

import { use, useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, CircleAlert, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getEligibleTeamsForTournament, getTournamentBySlug, registerForFreeTournament, registerTeamForFreeTournament } from "@/features/tournaments/actions";
import { initiateTournamentPayment } from "@/features/payments/actions";

type RegistrationTournament = {
  id: string;
  title: string;
  isPaid: boolean;
  entryFee: number;
  maxParticipants: number;
  currentParticipants: number;
  status: string;
  participantType: "INDIVIDUAL" | "TEAM";
  teamSize: number;
};

type EligibleTeam = { id: string; name: string; logoUrl: string | null; memberCount: number; ready: boolean; issue: string | null };

export default function RegisterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [tournament, setTournament] = useState<RegistrationTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [teams, setTeams] = useState<EligibleTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");

  useEffect(() => {
    let mounted = true;

    void getTournamentBySlug(slug).then((result) => {
      if (!mounted) return;
      if (result.success && result.data) {
        setTournament(result.data);
        if (result.data.participantType === "TEAM") {
          void getEligibleTeamsForTournament(result.data.id).then((teamResult) => {
            if (!mounted) return;
            if (!teamResult.success || !teamResult.data) {
              setError(teamResult.error ?? "We couldn't load your captained teams.");
              return;
            }
            setTeams(teamResult.data);
            setSelectedTeamId(teamResult.data.find((team) => team.ready)?.id ?? "");
          });
        }
      } else {
        setError("Tournament not found.");
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [slug]);

  const handleRegister = async () => {
    if (!tournament || tournament.status !== "REGISTRATION_OPEN") return;

    if (!acceptedRules) {
      setError("Please accept the tournament rules before continuing.");
      return;
    }
    if (tournament.participantType === "TEAM" && !selectedTeamId) {
      setError("Choose a ready team roster. Only a team captain can enter it.");
      return;
    }

    setRegistering(true);
    setError(null);

    try {
      if (tournament.isPaid) {
        const result = await initiateTournamentPayment({ tournamentId: tournament.id, ...(tournament.participantType === "TEAM" ? { teamId: selectedTeamId } : {}) });
        if (!result.success || !result.data) {
          setError(result.error || "We couldn't prepare this payment. Please try again.");
          return;
        }

        if (!window.Telegram?.WebApp) {
          setError("Telegram Stars payments must be completed inside the Telegram app.");
          return;
        }

        window.Telegram.WebApp.openInvoice(result.data.invoiceUrl, (status) => {
          if (status === "paid") {
            setPaymentSubmitted(true);
            router.refresh();
          } else if (status === "failed") {
            setError("Telegram couldn't complete the payment. No registration was created.");
          } else if (status === "cancelled") {
            setError("Payment was cancelled. You have not been registered.");
          }
        });
      } else {
        const result = tournament.participantType === "TEAM"
          ? await registerTeamForFreeTournament({ tournamentId: tournament.id, teamId: selectedTeamId })
          : await registerForFreeTournament(tournament.id);
        if (result.success) {
          setSuccess(true);
        } else {
          setError(result.error || "We couldn't complete your registration. Please try again.");
        }
      }
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return <main className="velox-page flex min-h-[60vh] items-center justify-center"><p className="text-sm font-bold text-[#9ca89a]">Loading tournament…</p></main>;
  }

  if (!tournament) {
    return <Unavailable slug={slug} message={error || "Tournament unavailable."} />;
  }

  const isTeamTournament = tournament.participantType === "TEAM";

  if (tournament.status !== "REGISTRATION_OPEN") {
    return <Unavailable slug={slug} message="Registration is not open for this tournament." />;
  }

  if (success || paymentSubmitted) {
    return (
      <main className="velox-page flex min-h-[72vh] items-center justify-center">
        <section className="velox-card w-full max-w-md p-7 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1f3119] text-[#c5f94d]"><CheckCircle2 className="h-9 w-9" aria-hidden /></span>
          <p className="velox-eyebrow mt-6">You&apos;re in</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-white">{success ? "Registration confirmed" : "Payment received"}</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#aeb8ad]">{success ? `${isTeamTournament ? "Your team is" : "You are"} registered for ${tournament.title}.` : "VELOX is verifying Telegram's payment event and will confirm your entry shortly."}</p>
          <Link href={`/tournaments/${slug}`} className="velox-action mt-7 w-full">Back to tournament</Link>
        </section>
      </main>
    );
  }

  const availableSlots = Math.max(0, tournament.maxParticipants - tournament.currentParticipants);
  const hasSlots = availableSlots > 0;

  return (
    <main className="velox-page pb-36">
      <header className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()} className="velox-muted-button flex h-10 w-10 shrink-0 p-0" aria-label="Back to tournament"><ChevronLeft className="h-5 w-5" aria-hidden /></button>
        <div><p className="velox-eyebrow">Secure entry</p><h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">Register</h1></div>
      </header>

      <section className="velox-card mt-6 overflow-hidden">
        <div className="border-b border-[#29342a] bg-[#142010] px-5 py-5">
          <p className="velox-eyebrow">Selected tournament</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">{tournament.title}</h2>
        </div>
        <div className="divide-y divide-[#29342a] px-5">
          <Summary label="Entry" value={tournament.isPaid ? `⭐ ${tournament.entryFee.toLocaleString()} Telegram Stars` : "Free"} />
          <Summary label="Entry type" value={isTeamTournament ? `${tournament.teamSize}-player team roster` : "Individual player"} />
          <Summary label="Available slots" value={`${availableSlots} of ${tournament.maxParticipants} ${isTeamTournament ? "teams" : "players"}`} />
        </div>
      </section>

      {error && <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-[#6e342d] bg-[#331d1a] p-4 text-sm leading-relaxed text-[#ffd1c7]"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />{error}</div>}

      {isTeamTournament && (
        <section className="velox-card mt-5 p-4">
          <p className="velox-eyebrow">Captain roster</p>
          <h2 className="mt-1 text-lg font-black text-white">Choose the {tournament.teamSize}-player team entering this event</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#9ca89a]">Only teams you captain are listed. An entered roster stays locked until the tournament ends.</p>
          {teams.length === 0 ? <p className="mt-4 rounded-xl border border-[#3b4e3a] bg-[#111b12] p-3 text-sm text-[#c9d3c4]">You do not captain a team yet. <Link href="/teams" className="font-black text-[#c5f94d] underline">Create or manage a team</Link>, then return here.</p> : <div className="mt-4 grid gap-2">{teams.map((team) => <label key={team.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition ${selectedTeamId === team.id ? "border-[#c5f94d] bg-[#1b2a16]" : "border-[#2b3a2c] bg-[#0e150f]"} ${!team.ready ? "cursor-not-allowed opacity-55" : ""}`}><span className="flex min-w-0 items-center gap-3"><input type="radio" name="team" value={team.id} checked={selectedTeamId === team.id} disabled={!team.ready} onChange={() => setSelectedTeamId(team.id)} className="accent-[#c5f94d]" /><span className="min-w-0"><span className="block truncate font-black text-white">{team.name}</span><span className="mt-0.5 block text-xs text-[#8e998f]">{team.memberCount}/{tournament.teamSize} roster members{team.issue ? ` · ${team.issue}` : " · Ready"}</span></span></span><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${team.ready ? "bg-[#23391d] text-[#c5f94d]" : "bg-[#302521] text-[#c9a89d]"}`}>{team.ready ? "Ready" : "Unavailable"}</span></label>)}</div>}
        </section>
      )}

      <label className="velox-card mt-5 flex cursor-pointer items-start gap-3 p-4 text-sm leading-relaxed text-[#c9d3c4]">
        <input type="checkbox" checked={acceptedRules} onChange={(event) => setAcceptedRules(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#c5f94d]" />
        <span>I have read and accept the VELOX tournament rules and terms of service.</span>
      </label>

      <section className="mt-5 flex items-start gap-3 rounded-2xl border border-[#2e4722] bg-[#12200e] p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#203318] text-[#c5f94d]"><ShieldCheck className="h-5 w-5" aria-hidden /></span><p className="text-sm leading-relaxed text-[#aeb8ad]">Payments are completed securely through Telegram. VELOX never asks for payment details in chat.</p></section>

      <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 px-5 sm:px-8"><div className="mx-auto w-full max-w-3xl rounded-2xl bg-[#080d09]/90 p-1.5 backdrop-blur"><button type="button" onClick={handleRegister} disabled={registering || !acceptedRules || !hasSlots || (isTeamTournament && !selectedTeamId)} className="velox-action w-full disabled:cursor-not-allowed disabled:opacity-45">{registering ? "Preparing…" : !hasSlots ? "Tournament is full" : isTeamTournament && !selectedTeamId ? "Choose a ready team" : tournament.isPaid ? `Pay ⭐ ${tournament.entryFee.toLocaleString()}${isTeamTournament ? " for team entry" : ""}` : isTeamTournament ? "Confirm team registration" : "Confirm free registration"}</button></div></div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 py-4"><span className="text-sm text-[#9ca89a]">{label}</span><span className="text-right text-sm font-black text-white">{value}</span></div>;
}

function Unavailable({ slug, message }: { slug: string; message: string }) {
  return <main className="velox-page flex min-h-[68vh] items-center justify-center"><section className="velox-card w-full max-w-md p-7 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1d2c1a] text-[#c5f94d]"><Users className="h-7 w-7" aria-hidden /></span><p className="velox-eyebrow mt-5">Entry unavailable</p><h1 className="mt-2 text-2xl font-black text-white">Registration is closed</h1><p className="mt-3 text-sm leading-relaxed text-[#aeb8ad]">{message}</p><Link href={`/tournaments/${slug}`} className="velox-action mt-6 w-full">Back to tournament</Link></section></main>;
}
