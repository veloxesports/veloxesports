"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  ExternalLink,
  Gamepad2,
  Loader2,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Unlink,
  X,
} from "lucide-react";
import { TelegramBottomSheet } from "@/components/ui/TelegramBottomSheet";
import {
  checkDiscordConnectionStatus,
  connectDiscordDirect,
  disconnectDiscord,
  getDiscordConnectInfo,
} from "@/features/profile/actions";

type DiscordConnectCardProps = {
  initialDiscordId?: string | null;
  initialDiscordUsername?: string | null;
  initialDiscordDisplayName?: string | null;
  initialDiscordAvatarUrl?: string | null;
  initialDiscordConnected?: boolean;
  initialDiscordConnectedAt?: Date | string | null;
};

export function DiscordConnectCard({
  initialDiscordUsername,
  initialDiscordDisplayName,
  initialDiscordAvatarUrl,
  initialDiscordConnected,
  initialDiscordConnectedAt,
}: DiscordConnectCardProps) {
  const [discordConnected, setDiscordConnected] = useState(
    Boolean(initialDiscordConnected ?? initialDiscordUsername)
  );
  const [discordUsername, setDiscordUsername] = useState(initialDiscordUsername || null);
  const [discordDisplayName, setDiscordDisplayName] = useState(
    initialDiscordDisplayName || initialDiscordUsername || null
  );
  const [discordAvatarUrl, setDiscordAvatarUrl] = useState(initialDiscordAvatarUrl || null);
  const [discordConnectedAt, setDiscordConnectedAt] = useState<Date | string | null>(
    initialDiscordConnectedAt || null
  );

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isAwaitingOAuth, setIsAwaitingOAuth] = useState(false);
  const [directTag, setDirectTag] = useState("");
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const [isPending, startTransition] = useTransition();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const triggerHaptic = (type: "light" | "success" | "error" | "warning") => {
    try {
      if (typeof window !== "undefined" && window.Telegram?.WebApp?.HapticFeedback) {
        if (type === "light") {
          window.Telegram.WebApp.HapticFeedback.impactOccurred("light");
        } else {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred(
            type === "warning" ? "warning" : type
          );
        }
      }
    } catch {
      // Ignore outside Telegram
    }
  };

  // Poll & focus listener when awaiting OAuth completion in external browser
  useEffect(() => {
    if (!isAwaitingOAuth) return;

    const checkStatus = async () => {
      const res = await checkDiscordConnectionStatus();
      if (res.success && res.data?.connected) {
        triggerHaptic("success");
        setDiscordConnected(true);
        setDiscordUsername(res.data.discordUsername);
        setDiscordDisplayName(res.data.discordDisplayName);
        setDiscordAvatarUrl(res.data.discordAvatarUrl);
        setDiscordConnectedAt(res.data.discordConnectedAt);
        setIsAwaitingOAuth(false);
        setIsConnectModalOpen(false);
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    };

    // Check on window focus (when returning to Telegram)
    const onFocus = () => {
      void checkStatus();
    };

    window.addEventListener("focus", onFocus);
    // Also poll every 2.5s for 60s
    pollingRef.current = setInterval(checkStatus, 2500);
    const timeout = setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setIsAwaitingOAuth(false);
    }, 60000);

    return () => {
      window.removeEventListener("focus", onFocus);
      if (pollingRef.current) clearInterval(pollingRef.current);
      clearTimeout(timeout);
    };
  }, [isAwaitingOAuth]);

  const handleOpenConnect = () => {
    triggerHaptic("light");
    setNotice(null);
    setDirectTag("");
    setIsConnectModalOpen(true);
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
        setIsAwaitingOAuth(true);
        // If inside Telegram Mini App, open via openLink in native external browser
        if (typeof window !== "undefined" && window.Telegram?.WebApp?.openLink) {
          window.Telegram.WebApp.openLink(res.data.oauthUrl);
        } else {
          window.location.href = res.data.oauthUrl;
        }
      } else {
        setNotice({
          text: "Discord OAuth credentials are not set on server. You can link your Discord tag directly below.",
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
        setDiscordConnected(true);
        setDiscordUsername(res.data.discordUsername);
        setDiscordDisplayName(res.data.discordDisplayName);
        setDiscordAvatarUrl(res.data.discordAvatarUrl);
        setDiscordConnectedAt(res.data.discordConnectedAt);
        setNotice({ text: "Discord account linked successfully!", type: "success" });
        setTimeout(() => {
          setIsConnectModalOpen(false);
          setNotice(null);
        }, 1200);
      } else {
        triggerHaptic("error");
        setNotice({ text: res.error || "Failed to link Discord tag.", type: "error" });
      }
    });
  };

  const handleOpenDisconnectModal = () => {
    triggerHaptic("warning");
    setIsDisconnectModalOpen(true);
  };

  const handleConfirmDisconnect = () => {
    triggerHaptic("light");
    startTransition(async () => {
      const res = await disconnectDiscord();
      if (res.success) {
        triggerHaptic("success");
        setDiscordConnected(false);
        setDiscordUsername(null);
        setDiscordDisplayName(null);
        setDiscordAvatarUrl(null);
        setDiscordConnectedAt(null);
        setIsDisconnectModalOpen(false);
      } else {
        triggerHaptic("error");
        setNotice({ text: res.error || "Failed to disconnect Discord.", type: "error" });
      }
    });
  };

  const formattedConnectedDate = discordConnectedAt
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(discordConnectedAt))
    : null;

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-[#212f22] bg-[#0c130e] p-3.5 sm:p-4">
        {/* Main Header / Status Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Discord Avatar or Brand Icon */}
            {discordConnected && discordAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={discordAvatarUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-xl object-cover ring-2 ring-[#5865F2] shadow-md"
              />
            ) : (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#201d36] text-[#5865F2] shadow-[0_0_12px_rgba(88,101,242,0.25)]">
                <Gamepad2 className="h-5 w-5" />
              </span>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-xs font-black text-white">
                  {discordConnected
                    ? discordDisplayName || `@${discordUsername}`
                    : "Discord Integration"}
                </p>
                {discordConnected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connected
                  </span>
                )}
              </div>
              <p className="truncate text-[10px] font-medium text-[#7d8e7e]">
                {discordConnected
                  ? `@${discordUsername} · Match lobbies active`
                  : "Link for automated match lobbies & roles"}
              </p>
            </div>
          </div>

          {/* Action Button */}
          {discordConnected ? (
            <button
              type="button"
              onClick={handleOpenDisconnectModal}
              disabled={isPending}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-black text-red-400 transition hover:bg-red-500/20 active:scale-[0.98] disabled:opacity-50"
            >
              <Unlink className="h-3 w-3" />
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenConnect}
              disabled={isPending}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#5865F2] bg-[#5865F2] px-3.5 py-1.5 text-[10px] font-black text-white shadow-[0_0_15px_rgba(88,101,242,0.35)] transition hover:bg-[#4752c4] active:scale-[0.98]"
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              <span>Connect</span>
            </button>
          )}
        </div>

        {/* Connected Details Meta Bar */}
        {discordConnected && (
          <div className="grid grid-cols-2 gap-2 border-t border-[#1a261c] pt-2.5 text-[10px]">
            <div className="flex items-center gap-2 rounded-lg border border-[#1d2b1f] bg-[#080d09] px-2.5 py-1.5">
              <div className="min-w-0">
                <span className="block text-[8px] font-bold uppercase tracking-wider text-[#5a6b5c]">
                  Discord Status
                </span>
                <span className="block truncate text-[10px] font-bold text-[#c5f94d]">
                  {discordUsername ? `@${discordUsername}` : "Verified & Active"}
                </span>
              </div>
            </div>

            {formattedConnectedDate && (
              <div className="flex items-center gap-2 rounded-lg border border-[#1d2b1f] bg-[#080d09] px-2.5 py-1.5">
                <div className="min-w-0">
                  <span className="block text-[8px] font-bold uppercase tracking-wider text-[#5a6b5c]">
                    Connected Date
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-[#b0c2b2] truncate">
                    <Calendar className="h-2.5 w-2.5 text-[#c5f94d]" />
                    {formattedConnectedDate}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modern Connect Modal */}
      <TelegramBottomSheet
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        title="Connect Discord"
        maxWidthClass="max-w-md"
        showDragHandle
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#202d21] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#201d36] text-[#5865F2]">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Connect Discord</h3>
              <p className="text-[11px] font-semibold text-[#809081]">
                Link your account for tournaments & match lobbies
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsConnectModalOpen(false)}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-xl border border-[#273628] bg-[#121c13] text-[#8e9f8f] transition hover:bg-[#1a281b] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
          <div className="space-y-2 rounded-2xl border border-[#213022] bg-[#111912] p-3.5">
            <div className="flex items-start gap-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#5865F2]/20 text-[#5865F2]">
                <Radio className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-xs font-black text-white">Automated Match Lobbies</p>
                <p className="text-[10px] text-[#7d8e7e]">
                  Automatically coordinate private match rooms and servers with your opponents.
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
                  Gain access to referee support channels and official tournament voice rooms.
                </p>
              </div>
            </div>
          </div>

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

          {/* Real Discord OAuth2 Button */}
          <button
            type="button"
            onClick={handleOAuthConnect}
            disabled={isPending || isAwaitingOAuth}
            className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#5865F2] px-4 text-xs font-black text-white shadow-[0_0_20px_rgba(88,101,242,0.35)] transition hover:bg-[#4752c4] active:scale-[0.98] disabled:opacity-50"
          >
            {isPending || isAwaitingOAuth ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Gamepad2 className="h-4 w-4" />
            )}
            <span>
              {isAwaitingOAuth ? "Awaiting Discord Authorization..." : "Authorize with Discord (OAuth2)"}
            </span>
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </button>

          {isAwaitingOAuth && (
            <p className="text-center text-[10px] font-semibold text-[#809081]">
              Switch back to Telegram after clicking Authorize in your browser.
            </p>
          )}

          {/* Fallback Divider */}
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

      {/* Modern Disconnect Confirmation Modal */}
      <TelegramBottomSheet
        isOpen={isDisconnectModalOpen}
        onClose={() => setIsDisconnectModalOpen(false)}
        title="Disconnect Discord"
        maxWidthClass="max-w-md"
        showDragHandle
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#202d21] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-red-500/30 bg-red-500/15 text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Disconnect Discord?</h3>
              <p className="text-[11px] font-semibold text-[#809081]">
                Confirm unlinking your Discord account
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsDisconnectModalOpen(false)}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-xl border border-[#273628] bg-[#121c13] text-[#8e9f8f] transition hover:bg-[#1a281b] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
          {/* Warning Banner */}
          <div className="rounded-2xl border border-red-500/25 bg-red-950/20 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="text-xs font-black text-white">
                  Unlinking @{discordUsername}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-red-200/80">
                  Disconnecting will remove automated Discord lobby invitations and your Verified Competitor badge.
                </p>
              </div>
            </div>
          </div>

          {/* Consequences List */}
          <div className="space-y-2 rounded-xl border border-[#233125] bg-[#0e150f] p-3 text-[11px] text-[#8ea090]">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              <span>You will lose access to automated private match room coordination.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              <span>Opponents won’t be able to find your Discord handle.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              <span>Referee voice channel access will require re-verifying.</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleConfirmDisconnect}
              disabled={isPending}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-600 px-4 text-xs font-black text-white shadow-[0_0_20px_rgba(220,38,38,0.35)] transition hover:bg-red-500 active:scale-[0.98] disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4" />
              )}
              <span>Confirm & Disconnect Discord</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDisconnectModalOpen(false)}
              disabled={isPending}
              className="flex h-11 w-full items-center justify-center rounded-xl border border-[#273728] bg-[#121c13] text-xs font-bold text-[#b0c0b1] transition hover:bg-[#1a271b] hover:text-white"
            >
              Keep Connected
            </button>
          </div>
        </div>
      </TelegramBottomSheet>
    </>
  );
}
