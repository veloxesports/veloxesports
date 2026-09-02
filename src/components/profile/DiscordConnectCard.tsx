"use client";

import { useState, useTransition } from "react";
import {
  Check,
  ExternalLink,
  Gamepad2,
  Loader2,
  Radio,
  ShieldCheck,
  Unlink,
  X,
} from "lucide-react";
import { TelegramBottomSheet } from "@/components/ui/TelegramBottomSheet";
import {
  connectDiscordDirect,
  disconnectDiscord,
  getDiscordConnectInfo,
} from "@/features/profile/actions";

type DiscordConnectCardProps = {
  initialDiscordUsername?: string | null;
  initialDiscordAvatarUrl?: string | null;
};

export function DiscordConnectCard({
  initialDiscordUsername,
  initialDiscordAvatarUrl,
}: DiscordConnectCardProps) {
  const [discordUsername, setDiscordUsername] = useState(initialDiscordUsername || null);
  const [discordAvatarUrl, setDiscordAvatarUrl] = useState(initialDiscordAvatarUrl || null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [directTag, setDirectTag] = useState("");
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const isConnected = Boolean(discordUsername);

  const triggerHaptic = (type: "light" | "success" | "error") => {
    try {
      if (typeof window !== "undefined" && window.Telegram?.WebApp?.HapticFeedback) {
        if (type === "light") {
          window.Telegram.WebApp.HapticFeedback.impactOccurred("light");
        } else {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred(type);
        }
      }
    } catch {
      // Ignore outside Telegram
    }
  };

  const handleOpenConnect = () => {
    triggerHaptic("light");
    setNotice(null);
    setDirectTag("");
    setIsModalOpen(true);
  };

  const handleOAuthConnect = async () => {
    triggerHaptic("light");
    setNotice({ text: "Opening Discord authorization...", type: "info" });

    startTransition(async () => {
      const res = await getDiscordConnectInfo("profile");
      if (!res.success || !res.data) {
        triggerHaptic("error");
        setNotice({
          text: res.error || "Failed to initialize Discord authorization.",
          type: "error",
        });
        return;
      }

      if (res.data.isConfigured && res.data.oauthUrl) {
        // If in Telegram Mini App, open via openLink in native external browser
        if (typeof window !== "undefined" && window.Telegram?.WebApp?.openLink) {
          window.Telegram.WebApp.openLink(res.data.oauthUrl);
          setIsModalOpen(false);
        } else {
          window.location.href = res.data.oauthUrl;
        }
      } else {
        // OAuth keys not yet in env; prompt to use direct tag
        setNotice({
          text: "Discord OAuth keys are not set on server. You can link your Discord tag directly below!",
          type: "info",
        });
      }
    });
  };

  const handleDirectConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directTag.trim()) return;

    triggerHaptic("light");
    setNotice(null);

    startTransition(async () => {
      const res = await connectDiscordDirect(directTag.trim());
      if (res.success && res.data) {
        triggerHaptic("success");
        setDiscordUsername(res.data.discordUsername);
        setDiscordAvatarUrl(res.data.discordAvatarUrl);
        setNotice({ text: "Discord account linked successfully!", type: "success" });
        setTimeout(() => {
          setIsModalOpen(false);
          setNotice(null);
        }, 1200);
      } else {
        triggerHaptic("error");
        setNotice({ text: res.error || "Failed to link Discord tag.", type: "error" });
      }
    });
  };

  const handleDisconnect = () => {
    if (!confirm("Are you sure you want to disconnect your Discord account?")) return;

    triggerHaptic("light");
    startTransition(async () => {
      const res = await disconnectDiscord();
      if (res.success) {
        triggerHaptic("success");
        setDiscordUsername(null);
        setDiscordAvatarUrl(null);
      } else {
        triggerHaptic("error");
        alert(res.error || "Failed to disconnect Discord.");
      }
    });
  };

  return (
    <>
      <div className="flex flex-col gap-2 rounded-2xl border border-[#212f22] bg-[#0c130e] p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Discord Avatar or Brand Icon */}
            {isConnected && discordAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={discordAvatarUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-xl object-cover ring-2 ring-[#5865F2]"
              />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#201d36] text-[#5865F2] shadow-[0_0_12px_rgba(88,101,242,0.25)]">
                <Gamepad2 className="h-5 w-5" />
              </span>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-xs font-black text-white">
                  {isConnected ? `@${discordUsername}` : "Discord Integration"}
                </p>
                {isConnected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-black uppercase text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Verified
                  </span>
                )}
              </div>
              <p className="truncate text-[10px] font-medium text-[#7d8e7e]">
                {isConnected
                  ? "Match lobbies & voice channels enabled"
                  : "Match notifications, custom lobbies & roles"}
              </p>
            </div>
          </div>

          {/* Action Button */}
          {isConnected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isPending}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-black text-red-400 transition hover:bg-red-500/20 active:scale-[0.98] disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenConnect}
              disabled={isPending}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#5865F2] bg-[#5865F2] px-3 py-1.5 text-[10px] font-black text-white shadow-[0_0_15px_rgba(88,101,242,0.35)] transition hover:bg-[#4752c4] active:scale-[0.98]"
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              <span>Connect</span>
            </button>
          )}
        </div>
      </div>

      {/* Modern Discord Connect Modal */}
      <TelegramBottomSheet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Connect Discord"
        maxWidthClass="max-w-md"
        showDragHandle
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#202d21] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#201d36] text-[#5865F2]">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Connect Discord</h3>
              <p className="text-[11px] font-semibold text-[#809081]">
                Link your account for tournaments & lobbies
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-xl border border-[#273628] bg-[#121c13] text-[#8e9f8f] transition hover:bg-[#1a281b] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
          {/* Perks list */}
          <div className="space-y-2 rounded-2xl border border-[#213022] bg-[#111912] p-3.5">
            <div className="flex items-start gap-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#5865F2]/20 text-[#5865F2]">
                <Radio className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-xs font-black text-white">Tournament Match Coordination</p>
                <p className="text-[10px] text-[#7d8e7e]">
                  Automatically share private match room codes & servers with your opponents.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#c5f94d]/20 text-[#c5f94d]">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-xs font-black text-white">Verified Competitor Role</p>
                <p className="text-[10px] text-[#7d8e7e]">
                  Gain access to referee support channels and exclusive tournament voice lobbies.
                </p>
              </div>
            </div>
          </div>

          {/* Feedback notice */}
          {notice && (
            <div
              className={`rounded-xl p-3 text-xs font-semibold ${
                notice.type === "success"
                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : notice.type === "error"
                  ? "border border-red-500/30 bg-red-500/10 text-red-300"
                  : "border border-blue-500/30 bg-blue-500/10 text-blue-300"
              }`}
            >
              {notice.text}
            </div>
          )}

          {/* Method 1: Discord OAuth */}
          <button
            type="button"
            onClick={handleOAuthConnect}
            disabled={isPending}
            className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#5865F2] px-4 text-xs font-black text-white shadow-[0_0_20px_rgba(88,101,242,0.35)] transition hover:bg-[#4752c4] active:scale-[0.98] disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Gamepad2 className="h-4 w-4" />
            )}
            <span>Authorize with Discord (OAuth)</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center py-1">
            <div className="h-px w-full bg-[#1f2b20]" />
            <span className="absolute bg-[#0c130e] px-2.5 text-[10px] font-bold text-[#627263] uppercase tracking-wider">
              Or Link Handle Directly
            </span>
          </div>

          {/* Method 2: Direct Tag Linking */}
          <form onSubmit={handleDirectConnect} className="space-y-2.5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#829283]">
                Discord Username or Tag
              </label>
              <input
                type="text"
                value={directTag}
                onChange={(e) => setDirectTag(e.target.value)}
                placeholder="e.g. PlayerName or Gamer#1234"
                disabled={isPending}
                className="h-11 w-full rounded-xl border border-[#263727] bg-[#121c13] px-3.5 text-xs font-bold text-white placeholder:text-[#556656] focus:border-[#c5f94d] focus:outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={isPending || !directTag.trim()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#3e5934] bg-[#1a2d1a] px-4 text-xs font-black text-[#c5f94d] transition hover:bg-[#233a23] active:scale-[0.98] disabled:opacity-40"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4 stroke-[3]" />
              )}
              <span>Link Discord Account</span>
            </button>
          </form>
        </div>
      </TelegramBottomSheet>
    </>
  );
}
