import { AlertCircle, ArrowLeft, Send } from "lucide-react";
import Link from "next/link";

const statusMessages: Record<string, { title: string; detail: string }> = {
  already_connected: {
    title: "Account Already Linked",
    detail: "That Discord account is already connected to another Khemora player account. Disconnect it there first or use a different Discord account.",
  },
  cancelled: {
    title: "Connection Cancelled",
    detail: "The Discord authorization was cancelled. You can try connecting again whenever you're ready.",
  },
  unavailable: {
    title: "Discord Service Notice",
    detail: "Discord OAuth is temporarily unavailable. You can link your Discord tag directly inside the Khemora Telegram Mini App.",
  },
  auth_required: {
    title: "Authentication Required",
    detail: "Please launch the Khemora Esports Telegram Mini App before connecting your Discord account.",
  },
  invalid_state: {
    title: "Session Expired",
    detail: "The authorization session expired or was invalid. Please initiate connection again from the Khemora app.",
  },
  failed: {
    title: "Connection Failed",
    detail: "We couldn't complete the Discord connection. Please check your internet connection and try again.",
  },
};

export default async function DiscordStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; returnTo?: string }>;
}) {
  const { status, returnTo } = await searchParams;
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "khemora_esports_bot";
  const telegramMiniAppUrl = `https://t.me/${botUsername}/app`;
  const fallbackUrl = returnTo === "settings" ? "/settings" : "/profile";

  const message = (status && statusMessages[status]) || statusMessages.failed;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#080d09] p-4 text-center">
      <div className="relative z-10 flex w-full max-w-md flex-col items-center rounded-[28px] border border-[#263828] bg-[#0c140e]/95 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-8">
        <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
          <AlertCircle className="h-8 w-8" />
        </div>

        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-400">
          Discord Integration
        </p>
        <h1 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">
          {message.title}
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-[#8a9d8b]">
          {message.detail}
        </p>

        <div className="mt-7 flex w-full flex-col gap-3">
          <a
            href={telegramMiniAppUrl}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#c5f94d] px-6 text-sm font-black text-[#080d09] shadow-lg transition hover:bg-[#d5ff70] active:scale-[0.98]"
          >
            <Send className="h-4 w-4 fill-[#080d09]" />
            <span>Return to Telegram Mini App</span>
          </a>

          <Link
            href={fallbackUrl}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#273728] bg-[#111912] text-xs font-bold text-[#b0c0b1] transition hover:bg-[#182319] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Profile / Settings</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
