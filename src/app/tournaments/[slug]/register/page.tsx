"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { getTournamentBySlug, registerForFreeTournament } from "@/features/tournaments/actions";
import { Button } from "@/components/ui/button";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function RegisterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await getTournamentBySlug(slug);
      if (res.success) {
        setTournament(res.data);
      } else {
        setError("Tournament not found.");
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  const handleRegister = async () => {
    setRegistering(true);
    setError(null);
    
    // In a real app, you would get the userId from the authenticated session
    // For now, we mock a user ID since we haven't implemented full Telegram Auth flow yet.
    const mockUserId = "mock-user-id"; 

    const res = await registerForFreeTournament(tournament.id, mockUserId);
    
    if (res.success) {
      setSuccess(true);
    } else {
      setError(res.error || "An error occurred");
    }
    setRegistering(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (error && !tournament) return <div className="p-8 text-center text-red-400">{error}</div>;

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black p-6">
        <CheckCircle2 className="w-20 h-20 text-green-500 mb-6" />
        <h1 className="text-2xl font-bold text-white text-center mb-2">Registration Confirmed!</h1>
        <p className="text-gray-400 text-center mb-8">You are officially registered for {tournament.title}.</p>
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
          <span className="text-purple-400 font-bold text-xs uppercase mb-1 block">Selected Tournament</span>
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

        <p className="text-xs text-gray-500 text-center">
          By registering, you agree to the VELOX tournament rules and terms of service.
        </p>

        <Button 
          onClick={handleRegister} 
          disabled={registering || tournament.isPaid}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 text-lg shadow-[0_0_20px_rgba(147,51,234,0.3)] mt-2"
        >
          {registering ? "Confirming..." : tournament.isPaid ? "Use Paid Registration (Phase 3)" : "Confirm Free Registration"}
        </Button>
      </div>
    </div>
  );
}
