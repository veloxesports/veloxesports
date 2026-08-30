"use client";

import { useState, type FormEvent } from "react";
import { Check, Copy, Gift, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { redeemReferralCode } from "@/features/referrals/actions";

type ReferralData = {
  code: string;
  referrals: Array<{ id: string; status: string; rewardAmount: number; completedAt: Date | null; referredUser: { username: string | null; firstName: string | null } | null }>;
};

export function ReferralsClient({ initialData }: { initialData: ReferralData }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function copyCode() {
    try { await navigator.clipboard.writeText(initialData.code); setMessage("Referral code copied."); }
    catch { setMessage(`Your referral code: ${initialData.code}`); }
  }

  async function redeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await redeemReferralCode(code);
    setPending(false);
    setMessage(result.success ? "Referral code applied. Welcome to VELOX!" : result.error ?? "We couldn't redeem that code.");
    if (result.success) { setCode(""); router.refresh(); }
  }

  return <main className="min-h-screen bg-black p-4 pb-24 text-slate-100"><header className="pt-2"><h1 className="text-3xl font-black tracking-tight text-white">Invite friends</h1><p className="mt-1 text-sm text-slate-400">Share your code and grow the competition.</p></header><section className="mt-6 rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-900/30 to-slate-950 p-5"><Gift className="h-7 w-7 text-violet-300" aria-hidden /><p className="mt-4 text-sm font-semibold text-slate-300">Your VELOX referral code</p><div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/50 px-4 py-3"><code className="text-xl font-black tracking-[0.18em] text-white">{initialData.code}</code><Button onClick={copyCode} variant="outline" className="h-9 border-white/10 bg-slate-900 text-slate-100"><Copy className="h-4 w-4" aria-hidden /> <span className="sr-only">Copy code</span></Button></div><p className="mt-3 text-xs leading-relaxed text-slate-400">Referral promotions, if enabled by VELOX, are recorded server-side. A referral code never transfers Telegram Stars on its own.</p></section><form onSubmit={redeem} className="mt-5 rounded-2xl border border-white/5 bg-slate-900 p-4"><h2 className="font-bold text-white">Have an invite?</h2><p className="mt-1 text-sm text-slate-400">Apply a friend&apos;s referral code once.</p><div className="mt-3 flex gap-2"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required maxLength={8} placeholder="ABC12345" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 py-3 font-mono tracking-[0.15em] text-white outline-none focus:border-violet-400" /><Button type="submit" disabled={pending} className="bg-violet-600 font-bold hover:bg-violet-500">{pending ? "Applying…" : "Apply"}</Button></div></form>{message && <p role="status" className="mt-4 rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-slate-200">{message}</p>}<section className="mt-6"><h2 className="flex items-center gap-2 text-lg font-bold text-white"><Users className="h-5 w-5 text-violet-300" aria-hidden />Your referrals</h2>{initialData.referrals.length === 0 ? <p className="mt-3 rounded-xl border border-white/5 bg-slate-900 p-4 text-sm text-slate-500">No completed referrals yet.</p> : <div className="mt-3 space-y-2">{initialData.referrals.map((referral) => <div key={referral.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900 p-3"><div><p className="font-semibold text-white">{referral.referredUser?.username ?? referral.referredUser?.firstName ?? "VELOX player"}</p><p className="text-xs text-slate-500">{referral.completedAt ? new Date(referral.completedAt).toLocaleDateString() : "Pending"}</p></div><span className="flex items-center gap-1 text-xs font-bold text-emerald-300"><Check className="h-4 w-4" aria-hidden />{referral.status}</span></div>)}</div>}</section></main>;
}
