"use client";

import { use, useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, CircleAlert, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTournamentBySlug, registerForFreeTournament } from "@/features/tournaments/actions";
import { initiateTournamentPayment } from "@/features/payments/actions";

type RegistrationTournament = {
  id: string;
  title: string;
  isPaid: boolean;
  entryFee: number;
  maxParticipants: number;
  currentParticipants: number;
  status: string;
};

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

  useEffect(() => {
    let mounted = true;

    void getTournamentBySlug(slug).then((result) => {
      if (!mounted) return;
      if (result.success && result.data) {
        setTournament(result.data);
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

    setRegistering(true);
    setError(null);

    try {
      if (tournament.isPaid) {
        const result = await initiateTournamentPayment(tournament.id);
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
        const result = await registerForFreeTournament(tournament.id);
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
          <p className="mt-3 text-sm leading-relaxed text-[#aeb8ad]">{success ? `You are registered for ${tournament.title}.` : "VELOX is verifying Telegram's payment event and will confirm your entry shortly."}</p>
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
          <Summary label="Available slots" value={`${availableSlots} of ${tournament.maxParticipants}`} />
        </div>
      </section>

      {error && <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-[#6e342d] bg-[#331d1a] p-4 text-sm leading-relaxed text-[#ffd1c7]"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />{error}</div>}

      <label className="velox-card mt-5 flex cursor-pointer items-start gap-3 p-4 text-sm leading-relaxed text-[#c9d3c4]">
        <input type="checkbox" checked={acceptedRules} onChange={(event) => setAcceptedRules(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#c5f94d]" />
        <span>I have read and accept the VELOX tournament rules and terms of service.</span>
      </label>

      <section className="mt-5 flex items-start gap-3 rounded-2xl border border-[#2e4722] bg-[#12200e] p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#203318] text-[#c5f94d]"><ShieldCheck className="h-5 w-5" aria-hidden /></span><p className="text-sm leading-relaxed text-[#aeb8ad]">Payments are completed securely through Telegram. VELOX never asks for payment details in chat.</p></section>

      <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 px-5 sm:px-8"><div className="mx-auto w-full max-w-3xl rounded-2xl bg-[#080d09]/90 p-1.5 backdrop-blur"><button type="button" onClick={handleRegister} disabled={registering || !acceptedRules || !hasSlots} className="velox-action w-full disabled:cursor-not-allowed disabled:opacity-45">{registering ? "Preparing…" : !hasSlots ? "Tournament is full" : tournament.isPaid ? `Pay ⭐ ${tournament.entryFee.toLocaleString()} with Telegram Stars` : "Confirm free registration"}</button></div></div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 py-4"><span className="text-sm text-[#9ca89a]">{label}</span><span className="text-right text-sm font-black text-white">{value}</span></div>;
}

function Unavailable({ slug, message }: { slug: string; message: string }) {
  return <main className="velox-page flex min-h-[68vh] items-center justify-center"><section className="velox-card w-full max-w-md p-7 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1d2c1a] text-[#c5f94d]"><Users className="h-7 w-7" aria-hidden /></span><p className="velox-eyebrow mt-5">Entry unavailable</p><h1 className="mt-2 text-2xl font-black text-white">Registration is closed</h1><p className="mt-3 text-sm leading-relaxed text-[#aeb8ad]">{message}</p><Link href={`/tournaments/${slug}`} className="velox-action mt-6 w-full">Back to tournament</Link></section></main>;
}
