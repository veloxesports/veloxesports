import { Check, ChevronRight, ExternalLink, Gamepad2, Send } from "lucide-react";
import Link from "next/link";

export default async function DiscordConnectedPage({
  searchParams,
}: {
  searchParams: Promise<{ username?: string; avatar?: string; returnTo?: string }>;
}) {
  const { username, avatar, returnTo } = await searchParams;
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "velox_esports_bot";
  const telegramMiniAppUrl = `https://t.me/${botUsername}/app?startapp=discord_connected`;
  const fallbackUrl = returnTo === "settings" ? "/settings" : "/profile";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#080d09] p-4 text-center">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden">
        <div className="h-96 w-96 rounded-full bg-[#5865F2]/10 blur-[100px]" />
        <div className="h-80 w-80 rounded-full bg-[#c5f94d]/10 blur-[120px]" />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center rounded-[28px] border border-[#263828] bg-[#0c140e]/95 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-8">
        {/* Animated Connected Badge */}
        <div className="relative mb-6">
          <div className="grid h-20 w-20 place-items-center rounded-3xl border-2 border-[#5865F2] bg-[#161c36] shadow-[0_0_30px_rgba(88,101,242,0.35)]">
            <Gamepad2 className="h-10 w-10 text-[#5865F2]" />
          </div>
          <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-[#0c140e] bg-[#c5f94d] text-[#080d09] shadow-md">
            <Check className="h-4 w-4 stroke-[3]" />
          </span>
        </div>

        {/* Title */}
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#c5f94d]">
          Integration Successful
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
          Discord Connected!
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-[#8a9d8b]">
          Your Discord account has been securely linked to your VELOX Esports competitor profile.
        </p>

        {/* User Card */}
        <div className="mt-6 flex w-full items-center gap-3.5 rounded-2xl border border-[#2b3c2c] bg-[#121c13] p-4 text-left">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              className="h-12 w-12 rounded-xl object-cover ring-2 ring-[#5865F2]"
            />
          ) : (
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#202947] text-[#5865F2]">
              <Gamepad2 className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">
              {username ? `@${username}` : "Verified Discord User"}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
              <span className="text-[11px] font-semibold text-emerald-300">
                Match Lobbies & Voice Active
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex w-full flex-col gap-3">
          {/* Primary CTA: Back to Telegram Mini App */}
          <a
            href={telegramMiniAppUrl}
            className="group flex h-13 w-full items-center justify-center gap-2.5 rounded-2xl bg-[#c5f94d] px-6 text-sm font-black text-[#080d09] shadow-[0_0_24px_rgba(197,249,77,0.3)] transition hover:bg-[#d5ff70] active:scale-[0.98]"
          >
            <Send className="h-4 w-4 fill-[#080d09]" />
            <span>Open in Telegram Mini App</span>
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>

          {/* Secondary CTA: Web Profile */}
          <Link
            href={fallbackUrl}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#273728] bg-[#111912] text-xs font-bold text-[#b0c0b1] transition hover:bg-[#182319] hover:text-white"
          >
            <span>Continue on Web Profile</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </Link>
        </div>

        <p className="mt-5 text-[11px] text-[#6e7e6f]">
          You can close this tab and return to Telegram at any time.
        </p>
      </div>
    </main>
  );
}
