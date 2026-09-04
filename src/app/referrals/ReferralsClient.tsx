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
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(initialData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage(`Your referral code: ${initialData.code}`);
    }
  }

  async function redeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await redeemReferralCode(code);
    setPending(false);
    setMessage(result.success ? "Referral code applied. Welcome to VELOX!" : result.error ?? "We couldn't redeem that code.");
    if (result.success) { setCode(""); router.refresh(); }
  }

  return (
    <main className="velox-page text-slate-100">
      <header><p className="velox-eyebrow">Grow the lobby</p><h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white">Invite friends</h1><p className="mt-2 text-sm text-[#8e998f]">Share your code and grow the competition.</p></header>
      <section className="mt-7 rounded-[26px] border border-[#49633d] bg-gradient-to-br from-[#20351a] to-[#111811] p-5"><Gift className="h-7 w-7 text-[#c5f94d]" aria-hidden /><p className="mt-5 text-[11px] font-black uppercase tracking-[0.13em] text-[#aeb8ad]">Your VELOX referral code</p><div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-[#3a4d38] bg-[#090d09]/70 px-4 py-3"><code className="text-xl font-black tracking-[0.18em] text-white">{initialData.code}</code><Button onClick={copyCode} variant="outline" className="h-9 border-[#49633d] bg-[#182319] text-[#c5f94d] hover:bg-[#22311e] transition active:scale-95">{copied ? (<span className="flex items-center gap-1 text-xs font-black"><Check className="h-4 w-4 text-[#c5f94d]" aria-hidden />Copied!</span>) : (<><Copy className="h-4 w-4" aria-hidden /><span className="sr-only">Copy code</span></>)}</Button></div><p className="mt-4 text-xs leading-relaxed text-[#aeb8ad]">Referral promotions, if enabled by VELOX, are recorded server-side. A referral code never transfers Telegram Stars on its own.</p></section>
      <form onSubmit={redeem} className="velox-card mt-5 p-5"><h2 className="font-black text-white">Have an invite?</h2><p className="mt-1 text-sm text-[#8e998f]">Apply a friend&apos;s referral code once.</p><div className="mt-4 flex gap-2"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required maxLength={8} placeholder="ABC12345" className="min-w-0 flex-1 rounded-xl border border-[#2a352b] bg-[#090d09] px-3 py-3 font-mono tracking-[0.15em] text-white outline-none focus:border-[#c5f94d]" /><Button type="submit" disabled={pending} className="bg-[#c5f94d] font-bold text-[#090d09] hover:bg-[#d5ff70]">{pending ? "Applying…" : "Apply"}</Button></div></form>
      {message && <p role="status" className="mt-4 rounded-xl border border-[#2a352b] bg-[#111811] p-3 text-sm text-slate-200">{message}</p>}
      <section className="mt-8"><h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-[0.05em] text-white"><Users className="h-5 w-5 text-[#c5f94d]" aria-hidden />Your referrals</h2>{initialData.referrals.length === 0 ? <p className="velox-card mt-4 p-5 text-sm text-[#8e998f]">No completed referrals yet.</p> : <div className="mt-4 space-y-2">{initialData.referrals.map((referral) => <div key={referral.id} className="velox-card flex items-center justify-between p-4"><div><p className="font-bold text-white">{referral.referredUser?.username ?? referral.referredUser?.firstName ?? "VELOX player"}</p><p className="mt-1 text-xs text-[#8e998f]">{referral.completedAt ? new Date(referral.completedAt).toLocaleDateString() : "Pending"}</p></div><span className="flex items-center gap-1 text-xs font-black text-[#c5f94d]"><Check className="h-4 w-4" aria-hidden />{referral.status}</span></div>)}</div>}</section>
    </main>
  );
}
