import Link from "next/link";
import { Send, ShieldCheck } from "lucide-react";

type TelegramAccessRequiredProps = { title: string; message: string };

/** Shared empty state for player-only surfaces opened outside Telegram. */
export function TelegramAccessRequired({ title, message }: TelegramAccessRequiredProps) {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  const telegramUrl = botUsername ? `https://t.me/${botUsername}?startapp=velox` : null;

  return (
    <main className="velox-page flex min-h-[70dvh] flex-col items-center justify-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#45613a] bg-[#182715] text-[#c5f94d] shadow-[0_0_30px_rgba(197,249,77,0.12)]"><ShieldCheck className="h-7 w-7" aria-hidden /></span>
      <p className="velox-eyebrow mt-6">Telegram player access</p>
      <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8e998f]">{message}</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {telegramUrl && <a href={telegramUrl} target="_blank" rel="noreferrer" className="velox-action"><Send className="mr-2 h-4 w-4" aria-hidden />Open in Telegram</a>}
        <Link href="/" className="velox-muted-button">Back to VELOX</Link>
      </div>
    </main>
  );
}
