"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  Gamepad2,
  Globe,
  HelpCircle,
  Loader2,
  Lock,
  LogOut,
  ShieldAlert,
  Sparkles,
  Unlink,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  disconnectDiscord,
  getDiscordConnectInfo,
  getPlayerProfile,
  updateCurrentProfile,
} from "@/features/profile/actions";
import { getPlayerPrivacy, updatePlayerPrivacy } from "@/features/players/actions";
import type { PlayerPrivacySettings } from "@/features/players/types";
import { logout } from "@/features/auth/actions";
import { TelegramBottomSheet } from "@/components/ui/TelegramBottomSheet";

export default function SettingsPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Discord State
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [discordDisplayName, setDiscordDisplayName] = useState<string | null>(null);
  const [discordAvatarUrl, setDiscordAvatarUrl] = useState<string | null>(null);
  const [discordConnectedAt, setDiscordConnectedAt] = useState<Date | string | null>(null);

  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [disconnectingDiscord, setDisconnectingDiscord] = useState(false);

  // Privacy Settings State
  const [privacy, setPrivacy] = useState<PlayerPrivacySettings>({
    showHistory: true,
    showStats: true,
    showDiscord: true,
    showTeam: true,
  });

  useEffect(() => {
    void getPlayerPrivacy().then((p) => {
      setPrivacy(p);
    });

    void getPlayerProfile().then((result) => {
      if (result.success && result.data) {
        setSignedIn(true);
        setUsername(result.data.profile.khemoraUsername || "");
        setCountry(result.data.profile.country || "");
        setDiscordUsername(result.data.profile.discordUsername || null);
        setDiscordDisplayName(
          result.data.profile.discordDisplayName || result.data.profile.discordUsername || null
        );
        setDiscordAvatarUrl(result.data.profile.discordAvatarUrl || null);
        setDiscordConnectedAt(result.data.profile.discordConnectedAt || null);
      } else {
        setSignedIn(false);
        setMessage(result.error || "We couldn't load your profile.");
      }
      const discordStatus = new URLSearchParams(window.location.search).get("discord");
      if (discordStatus === "connected") setMessage("Discord connected.");
      if (discordStatus === "already_connected") setMessage("That Discord account is already linked to another Khemora account.");
      if (discordStatus === "unavailable") setMessage("Discord connection is not configured yet.");
      if (discordStatus === "failed") setMessage("Discord connection failed. Please try again.");
      if (discordStatus === "cancelled") setMessage("Discord connection was cancelled or expired.");
      if (discordStatus === "auth_required") setMessage("Sign in with Telegram before connecting Discord.");
      setLoading(false);
    });
  }, []);

  const handleTogglePrivacy = async (key: keyof PlayerPrivacySettings) => {
    const updated = { ...privacy, [key]: !privacy[key] };
    setPrivacy(updated);
    await updatePlayerPrivacy(updated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    void updateCurrentProfile({ khemoraUsername: username, country }).then((res) => {
      setSaving(false);
      if (res.success) {
        setMessage("Profile updated successfully!");
      } else {
        setMessage(res.error || "Failed to update profile");
      }
    });
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/");
    router.refresh();
  };

  const handleDiscordClick = async () => {
    if (!discordUsername) {
      const info = await getDiscordConnectInfo("settings");
      if (info.success && info.data?.isConfigured && info.data.oauthUrl) {
        if (typeof window !== "undefined" && window.Telegram?.WebApp?.openLink) {
          window.Telegram.WebApp.openLink(info.data.oauthUrl);
        } else {
          window.location.href = info.data.oauthUrl;
        }
      } else {
        router.push("/profile");
      }
      return;
    }

    setIsDisconnectModalOpen(true);
  };

  const handleConfirmDisconnect = async () => {
    setDisconnectingDiscord(true);
    setMessage(null);
    const result = await disconnectDiscord();
    setDisconnectingDiscord(false);
    if (result.success) {
      setDiscordUsername(null);
      setDiscordDisplayName(null);
      setDiscordAvatarUrl(null);
      setDiscordConnectedAt(null);
      setIsDisconnectModalOpen(false);
      setMessage("Discord disconnected.");
    } else {
      setMessage(result.error || "We couldn't disconnect Discord.");
    }
  };

  const formattedDate = discordConnectedAt
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(discordConnectedAt))
    : null;

  return (
    <div className="min-h-screen bg-[#080d09]">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-[#2a352b] bg-[#080d09]/95 p-4 backdrop-blur">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-[#111811] flex items-center justify-center text-white border border-[#2a352b] hover:border-[#c5f94d]"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-white text-lg">Settings</h1>
      </header>

      <div className="p-4 flex flex-col gap-6 pb-24">
        {/* Profile Settings */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4" /> Profile
          </h2>

          <form onSubmit={handleSave} className="velox-card p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400">Khemora Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading || !signedIn}
                placeholder="Your Khemora username"
                className="bg-[#090d09] border border-[#2a352b] text-white p-3 rounded-xl focus:border-[#c5f94d] outline-none text-sm font-bold placeholder:text-gray-600 transition"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={loading || !signedIn}
                placeholder="Your country"
                className="bg-[#090d09] border border-[#2a352b] text-white p-3 rounded-xl focus:border-[#c5f94d] outline-none text-sm font-bold placeholder:text-gray-600 transition"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || saving || !signedIn}
              className="bg-[#c5f94d] hover:bg-[#b2e83d] text-black font-black mt-2"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>

            {message && <p className="text-sm text-gray-400 text-center" role="status">{message}</p>}
          </form>
        </section>

        {/* Connections */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4" /> Connections
          </h2>

          <div className="velox-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {discordAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={discordAvatarUrl}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-[#5865F2]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#5865F2]/20 flex items-center justify-center text-[#5865F2]">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm truncate">
                      {discordDisplayName || "Discord"}
                    </span>
                    {discordUsername && (
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-black uppercase text-emerald-400">
                        Connected
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 truncate">
                    {discordUsername ? `@${discordUsername}` : "Not connected"}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleDiscordClick}
                disabled={loading || !signedIn}
                size="sm"
                variant="outline"
                className={
                  discordUsername
                    ? "border-red-500/40 text-red-400 hover:bg-red-500/20"
                    : "border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2] hover:text-white"
                }
              >
                {discordUsername ? "Disconnect" : "Connect"}
              </Button>
            </div>

            {discordUsername && (
              <div className="grid grid-cols-2 gap-2 border-t border-[#1e2a20] pt-2 text-[10px]">
                <div className="rounded-lg bg-[#0a100b] p-2 border border-[#1d2b1f]">
                  <span className="block text-[8px] font-bold text-gray-500 uppercase">Status</span>
                  <span className="block font-bold text-[#c5f94d] truncate">Verified & Synced</span>
                </div>
                {formattedDate && (
                  <div className="rounded-lg bg-[#0a100b] p-2 border border-[#1d2b1f]">
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">Connected Date</span>
                    <span className="flex items-center gap-1 font-bold text-gray-300 truncate">
                      <Calendar className="h-2.5 w-2.5 text-[#c5f94d]" />
                      {formattedDate}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Profile Privacy & Visibility */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Lock className="w-4 h-4" /> Profile Privacy & Visibility
          </h2>

          <div className="velox-card p-4 flex flex-col gap-3.5 divide-y divide-[#1e2a1f]">
            {/* Match History Toggle */}
            <div className="flex items-center justify-between gap-3 pt-1 first:pt-0">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-white">Public Match History</span>
                <span className="text-xs text-gray-400">
                  Allow other players to view your recent tournament matches, placements, and scores.
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleTogglePrivacy("showHistory")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  privacy.showHistory ? "bg-[#c5f94d]" : "bg-[#253326]"
                }`}
                role="switch"
                aria-checked={privacy.showHistory}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#0a0e0a] shadow ring-0 transition duration-200 ease-in-out ${
                    privacy.showHistory ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Career Stats Toggle */}
            <div className="flex items-center justify-between gap-3 pt-3">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-white">Public Career Statistics</span>
                <span className="text-xs text-gray-400">
                  Show your win rate, championships won, total fixtures, and active win streak.
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleTogglePrivacy("showStats")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  privacy.showStats ? "bg-[#c5f94d]" : "bg-[#253326]"
                }`}
                role="switch"
                aria-checked={privacy.showStats}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#0a0e0a] shadow ring-0 transition duration-200 ease-in-out ${
                    privacy.showStats ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Discord Tag Toggle */}
            <div className="flex items-center justify-between gap-3 pt-3">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-white">Show Discord Connection</span>
                <span className="text-xs text-gray-400">
                  Display your linked Discord username on your public profile badge.
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleTogglePrivacy("showDiscord")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  privacy.showDiscord ? "bg-[#c5f94d]" : "bg-[#253326]"
                }`}
                role="switch"
                aria-checked={privacy.showDiscord}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#0a0e0a] shadow ring-0 transition duration-200 ease-in-out ${
                    privacy.showDiscord ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Team Membership Toggle */}
            <div className="flex items-center justify-between gap-3 pt-3">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-white">Show Squad & Team</span>
                <span className="text-xs text-gray-400">
                  Allow other players to view your active competitive squad and teammates.
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleTogglePrivacy("showTeam")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  privacy.showTeam ? "bg-[#c5f94d]" : "bg-[#253326]"
                }`}
                role="switch"
                aria-checked={privacy.showTeam}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#0a0e0a] shadow ring-0 transition duration-200 ease-in-out ${
                    privacy.showTeam ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Help & Guide: How Khemora Works */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <HelpCircle className="w-4 h-4" /> Help & Platform Guide
          </h2>

          <div className="velox-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#3b5438] bg-[#162317] text-[#c5f94d]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">How Khemora Works</h3>
                  <p className="text-xs text-gray-400 line-clamp-2">
                    Tournaments, squads, Discord sync, check-ins, and brackets.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => router.push("/onboarding?replay=true")}
                className="bg-[#c5f94d] text-black font-black hover:bg-[#b2e83d] text-xs px-3.5 shrink-0"
              >
                Replay Guide →
              </Button>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="flex flex-col gap-4 mt-2">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full border-red-500/20 text-red-500 hover:bg-red-500/10 font-bold flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </section>
      </div>

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
          <div className="rounded-2xl border border-red-500/25 bg-red-950/20 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="text-xs font-black text-white">
                  Unlinking @{discordUsername}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-red-200/80">
                  Disconnecting will remove automated Discord lobby invitations and your Verified Competitor status.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleConfirmDisconnect}
              disabled={disconnectingDiscord}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-600 px-4 text-xs font-black text-white shadow-[0_0_20px_rgba(220,38,38,0.35)] transition hover:bg-red-500 active:scale-[0.98] disabled:opacity-50"
            >
              {disconnectingDiscord ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4" />
              )}
              <span>Confirm & Disconnect Discord</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDisconnectModalOpen(false)}
              disabled={disconnectingDiscord}
              className="flex h-11 w-full items-center justify-center rounded-xl border border-[#273728] bg-[#121c13] text-xs font-bold text-[#b0c0b1] transition hover:bg-[#1a271b] hover:text-white"
            >
              Keep Connected
            </button>
          </div>
        </div>
      </TelegramBottomSheet>
    </div>
  );
}
