"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { getTournamentBySlug, registerForFreeTournament } from "@/features/tournaments/actions";
import { initiateTournamentPayment } from "@/features/payments/actions";
import { Button } from "@/components/ui/button";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

type RegistrationTournament = {
  id: string;
  title: string;
  isPaid: boolean;
  entryFee: number;
  maxParticipants: number;
  currentParticipants: number;
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
    async function load() {
      const res = await getTournamentBySlug(slug);
      if (res.success && res.data) {
        setTournament(res.data);
      } else {
        setError("Tournament not found.");
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  const handleRegister = async () => {
    if (!tournament) return;

    if (!acceptedRules) {
      setError("Please accept the tournament rules before continuing.");
      return;
    }

    setRegistering(true);
    setError(null);

    if (tournament.isPaid) {
      const res = await initiateTournamentPayment(tournament.id);
      if (res.success && res.data) {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.openInvoice(res.data.invoiceUrl, (status) => {
            if (status === "paid") {
              setPaymentSubmitted(true);
              router.refresh();
            } else if (status === "failed") {
              setError("Telegram couldn't complete the payment. No registration was created.");
            }
          });
        } else {
          setError("Telegram Stars payments must be completed inside the Telegram app.");
        }
      } else {
        setError(res.error || "An error occurred");
      }
    } else {
      const res = await registerForFreeTournament(tournament.id);
      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error || "An error occurred");
      }
    }
    setRegistering(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (error && !tournament) return <div className="p-8 text-center text-red-400">{error}</div>;
  if (!tournament) return <div className="p-8 text-center text-gray-400">Tournament unavailable.</div>;

  if (success || paymentSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black p-6">
        <CheckCircle2 className="w-20 h-20 text-green-500 mb-6" />
        <h1 className="text-2xl font-bold text-white text-center mb-2">
          {success ? "Registration Confirmed!" : "Payment received"}
        </h1>
        <p className="text-gray-400 text-center mb-8">
          {success
            ? `You are officially registered for ${tournament.title}.`
            : "Your registration will be confirmed after VELOX verifies Telegram's payment event."}
        </p>
        <Link href={`/tournaments/${slug}`} className="w-full">
          <Button className="w-full bg-gray-800 text-white hover:bg-gray-700 font-bold py-6">
            Back to Tournament
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-black p-4">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-gray-900 border border-white/10 flex items-center justify-center text-white">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold text-white">Register</h1>
      </header>

      <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
        <div>
          <span className="text-[#c5f94d] font-bold text-xs uppercase mb-1 block">Selected Tournament</span>
          <h2 className="text-2xl font-black text-white">{tournament.title}</h2>
        </div>

        <div className="bg-black/50 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex justify-between">
            <span className="text-gray-400">Entry Fee</span>
            <span className="font-bold text-white">{tournament.isPaid ? `⭐ ${tournament.entryFee}` : 'Free'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Available Slots</span>
            <span className="font-bold text-white">{tournament.maxParticipants - tournament.currentParticipants}</span>
          </div>
        </div>
        
        {error && <div className="bg-red-500/10 text-red-500 p-3 rounded-xl text-sm border border-red-500/20">{error}</div>}

        <label className="flex items-start gap-3 rounded-xl bg-black/30 p-3 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedRules}
            onChange={(event) => setAcceptedRules(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#c5f94d]"
          />
          <span>I have read and accept the VELOX tournament rules and terms of service.</span>
        </label>

        <Button 
          onClick={handleRegister} 
          disabled={registering || !acceptedRules}
          className="w-full bg-[#c5f94d] hover:bg-[#d5ff70] text-[#090d09] font-bold py-6 text-lg shadow-[0_0_20px_rgba(197,249,77,0.22)] mt-2"
        >
          {registering ? "Preparing..." : tournament.isPaid ? `Pay ⭐ ${tournament.entryFee} with Telegram Stars` : "Confirm Free Registration"}
        </Button>
      </div>
    </div>
  );
}
