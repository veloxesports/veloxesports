"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ChevronLeft, CircleAlert, Database, MessageSquare, Server, Settings, Shield, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateSystemSetting } from "@/features/admin/actions";

type SystemSetting = {
  key: string;
  value: unknown;
  updatedAt: Date;
};

type WebAdminAccount = {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  createdAt: Date;
};

type SettingsData = {
  settings: SystemSetting[];
  adminAccounts: WebAdminAccount[];
  systemStatus: {
    database: boolean;
    telegramBot: boolean;
    storage: boolean;
    discord: boolean;
    aiAssistant: boolean;
    appUrl: string;
  };
};

export function AdminSettingsClient({ initialData }: { initialData: SettingsData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [referralReward, setReferralReward] = useState<number>(() => {
    const found = initialData.settings.find((setting) => setting.key === "referral_reward_xtr");
    return typeof found?.value === "number" ? found.value : 0;
  });

  const handleSaveReferral = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await updateSystemSetting({
        key: "referral_reward_xtr",
        value: Number(referralReward),
      });
      if (!result.success) {
        setError(result.error ?? "Failed to update referral reward.");
        return;
      }
      setMessage("Referral reward setting updated successfully.");
      router.refresh();
    });
  };

  return (
    <main className="velox-page">
      <header className="flex items-start gap-3">
        <Link href="/admin" className="velox-muted-button flex h-10 w-10 shrink-0 p-0" aria-label="Back to Command Center">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div>
          <p className="velox-eyebrow">Platform control</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">System & Settings</h1>
          <p className="mt-1 text-sm leading-relaxed text-[#8e998f]">
            Platform integration status, administrator accounts, and competitive parameters.
          </p>
        </div>
      </header>

      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl border border-[#87493d] bg-[#2b1d19] px-4 py-3 text-sm text-[#ffb1a0]">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-2xl border border-[#496b38] bg-[#182716] px-4 py-3 text-sm text-[#d8f5b3]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {message}
        </p>
      )}

      {/* Integration Status Grid */}
      <section className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="velox-eyebrow">Environment</p>
            <h2 className="mt-1 text-xl font-black text-white">Integration health</h2>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatusCard icon={<Database className="h-5 w-5" />} label="PostgreSQL & Prisma" active={initialData.systemStatus.database} detail="Connected via connection pool" />
          <StatusCard icon={<MessageSquare className="h-5 w-5" />} label="Telegram Bot API" active={initialData.systemStatus.telegramBot} detail="Webhook & Stars invoices" />
          <StatusCard icon={<Server className="h-5 w-5" />} label="Supabase Storage" active={initialData.systemStatus.storage} detail="Evidence & avatars bucket" />
          <StatusCard icon={<Zap className="h-5 w-5" />} label="Discord OAuth" active={initialData.systemStatus.discord} detail="Player identity linking" />
          <StatusCard icon={<Settings className="h-5 w-5" />} label="OpenAI Assistant" active={initialData.systemStatus.aiAssistant} detail="Khemora Guide LLM" />
          <div className="velox-card p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1f3119] text-[#c5f94d]">
              <Server className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 text-[11px] font-black uppercase tracking-[0.1em] text-[#c3ceb9]">App URL</p>
            <p className="mt-1 truncate font-mono text-xs text-white">{initialData.systemStatus.appUrl}</p>
            <p className="mt-1 text-xs text-[#718071]">Public production endpoint</p>
          </div>
        </div>
      </section>

      {/* Competitive System Parameters */}
      <section className="mt-8">
        <p className="velox-eyebrow">Competition</p>
        <h2 className="mt-1 text-xl font-black text-white">System parameters</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="velox-card p-5">
            <h3 className="text-base font-black text-white">Referral reward (Telegram Stars)</h3>
            <p className="mt-1 text-xs leading-relaxed text-[#8e998f]">
              Configure the Stars reward disbursed when a player signs up using an existing referral code.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="1000"
                value={referralReward}
                onChange={(event) => setReferralReward(Number(event.target.value))}
                className="w-32 rounded-2xl border border-[#344335] bg-[#080d09] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#c5f94d]"
              />
              <button
                type="button"
                onClick={handleSaveReferral}
                disabled={pending}
                className="velox-action text-xs"
              >
                {pending ? "Saving…" : "Save parameter"}
              </button>
            </div>
          </div>

          <div className="velox-card p-5">
            <h3 className="text-base font-black text-white">Rank & Tier Thresholds</h3>
            <p className="mt-1 text-xs leading-relaxed text-[#8e998f]">
              Global tier definitions (Bronze, Silver, Gold, Platinum, Diamond, Master, Grandmaster, Legend).
            </p>
            <p className="mt-4 text-xs font-mono text-[#c5f94d]">
              Configured via system_setting / seed.
            </p>
          </div>
        </div>
      </section>

      {/* Web Admin Accounts */}
      <section className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="velox-eyebrow">Access control</p>
            <h2 className="mt-1 text-xl font-black text-white">Administrator accounts</h2>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#8e998f]">
            {initialData.adminAccounts.length} account{initialData.adminAccounts.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="mt-3 divide-y divide-[#29342a] overflow-hidden rounded-2xl border border-[#29342a] bg-[#0c120d]">
          {initialData.adminAccounts.map((account) => (
            <div key={account.id} className="flex flex-wrap items-center justify-between gap-4 p-4 transition hover:bg-[#121a13]">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1f3119] text-[#c5f94d]">
                  <Shield className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-black text-white">{account.username}</p>
                    <span className="rounded-full bg-[#1b2b18] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#c5f94d]">
                      {account.role}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#718071]">
                    Created {formatDate(account.createdAt)} · Last login: {account.lastLoginAt ? formatDate(account.lastLoginAt) : "Never"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${account.isActive ? "bg-[#20331b] text-[#c5f94d]" : "bg-[#3b211e] text-[#ffad9a]"}`}>
                  {account.isActive ? "Active" : "Inactive"}
                </span>
                {account.failedLoginCount > 0 && (
                  <p className="mt-1 text-[10px] text-[#f0ca8b]">
                    {account.failedLoginCount} failed attempt{account.failedLoginCount === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function StatusCard({ icon, label, active, detail }: { icon: React.ReactNode; label: string; active: boolean; detail: string }) {
  return (
    <div className="velox-card p-4">
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-[#1f3119] text-[#c5f94d]" : "bg-[#2b1d19] text-[#ffad9a]"}`}>
          {icon}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${active ? "bg-[#1f3119] text-[#c5f94d]" : "bg-[#2b1d19] text-[#ffad9a]"}`}>
          {active ? "Configured" : "Missing"}
        </span>
      </div>
      <p className="mt-3 text-sm font-black text-white">{label}</p>
      <p className="mt-0.5 text-xs text-[#718071]">{detail}</p>
    </div>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
