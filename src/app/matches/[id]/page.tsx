"use client";

import { use, useState } from "react";
import { ChevronLeft, Upload, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function MatchDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  // Mock Match Data
  const match = {
    id,
    tournament: "FC26 Weekend Championship",
    round: "Quarter Finals",
    status: "AWAITING_RESULT", // SCHEDULED, LIVE, AWAITING_RESULT, COMPLETED, DISPUTED
    player1: "Alex",
    player2: "Michael",
  };

  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setSubmitting(false);
      setSuccess(true);
    }, 1500);
  };

  return (
    <div className="flex flex-col min-h-screen bg-black">
      <header className="p-4 flex items-center gap-4 bg-gray-900 border-b border-white/10 sticky top-0 z-10">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white border border-white/10">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="font-bold text-white leading-tight">Match Details</h1>
          <p className="text-xs text-gray-400">{match.tournament}</p>
        </div>
      </header>

      <div className="p-4 flex flex-col gap-6 pb-24">
        {/* Matchup Header */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-6 relative overflow-hidden flex flex-col items-center">
          <span className="text-xs text-purple-400 font-bold uppercase tracking-widest mb-4">{match.round}</span>
          
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col items-center gap-2 w-1/3">
              <div className="w-16 h-16 rounded-full bg-blue-900 border-2 border-blue-500 flex items-center justify-center text-xl font-black text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                A
              </div>
              <span className="font-bold text-white text-sm truncate w-full text-center">{match.player1}</span>
            </div>

            <div className="w-1/3 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-gray-700 italic">VS</span>
            </div>

            <div className="flex flex-col items-center gap-2 w-1/3">
              <div className="w-16 h-16 rounded-full bg-red-900 border-2 border-red-500 flex items-center justify-center text-xl font-black text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                M
              </div>
              <span className="font-bold text-white text-sm truncate w-full text-center">{match.player2}</span>
            </div>
          </div>

          <div className="mt-6 bg-black border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${match.status === 'LIVE' ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`} />
            <span className="text-xs font-bold text-white tracking-wide">{match.status.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Submit Result Form */}
        {success ? (
          <div className="bg-green-900/20 border border-green-500/20 rounded-2xl p-6 flex flex-col items-center text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
            <h2 className="text-lg font-bold text-white">Result Submitted</h2>
            <p className="text-sm text-gray-400 mt-1">Waiting for opponent to confirm.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-gray-900 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-white">Submit Score</h2>
            
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-2 w-full">
                <label className="text-xs text-gray-400 font-bold uppercase">{match.player1} Score</label>
                <input 
                  type="number" 
                  value={score1} 
                  onChange={(e) => setScore1(e.target.value)}
                  className="bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-xl font-bold text-center focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="0"
                  required
                />
              </div>
              <span className="text-gray-600 font-bold">-</span>
              <div className="flex flex-col gap-2 w-full">
                <label className="text-xs text-gray-400 font-bold uppercase text-right">{match.player2} Score</label>
                <input 
                  type="number" 
                  value={score2} 
                  onChange={(e) => setScore2(e.target.value)}
                  className="bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-xl font-bold text-center focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="0"
                  required
                />
              </div>
            </div>

            <div className="mt-2">
              <label className="text-xs text-gray-400 font-bold uppercase mb-2 block">Upload Evidence (Screenshot)</label>
              <div className="border-2 border-dashed border-white/10 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 hover:border-purple-500/50 hover:text-purple-400 transition-colors cursor-pointer bg-black/50">
                <Upload className="w-6 h-6 mb-2" />
                <span className="text-sm font-medium">Tap to upload image</span>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={submitting || !score1 || !score2}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 mt-2"
            >
              {submitting ? "Submitting..." : "Submit Match Result"}
            </Button>
          </form>
        )}

        {/* Dispute Button */}
        <button className="flex items-center justify-center gap-2 text-gray-500 hover:text-red-400 transition-colors text-sm font-bold p-4">
          <ShieldAlert className="w-4 h-4" /> Open Dispute
        </button>
      </div>
    </div>
  );
}
