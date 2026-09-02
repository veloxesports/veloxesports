"use client";

import { useEffect, useState } from "react";
import { User, Gamepad2, Globe, LogOut, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { disconnectDiscord, getDiscordConnectInfo, getPlayerProfile, updateCurrentProfile } from "@/features/profile/actions";
import { logout } from "@/features/auth/actions";

export default function SettingsPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [disconnectingDiscord, setDisconnectingDiscord] = useState(false);

  useEffect(() => {
    void getPlayerProfile().then((result) => {
      if (result.success && result.data) {
        setSignedIn(true);
        setUsername(result.data.profile.veloxUsername || "");
        setCountry(result.data.profile.country || "");
        setDiscordUsername(result.data.profile.discordUsername || null);
      } else {
        setSignedIn(false);
        setMessage(result.error || "We couldn't load your profile.");
      }
      const discordStatus = new URLSearchParams(window.location.search).get("discord");
      if (discordStatus === "connected") setMessage("Discord connected.");
      if (discordStatus === "already_connected") setMessage("That Discord account is already linked to another VELOX account.");
      if (discordStatus === "unavailable") setMessage("Discord connection is not configured yet.");
      if (discordStatus === "failed") setMessage("Discord connection failed. Please try again.");
      if (discordStatus === "cancelled") setMessage("Discord connection was cancelled or expired.");
      if (discordStatus === "auth_required") setMessage("Sign in with Telegram before connecting Discord.");
      setLoading(false);
    });
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    void updateCurrentProfile({ veloxUsername: username, country }).then((result) => {
      setSaving(false);
      setMessage(result.success ? "Profile saved." : result.error || "We couldn't save your profile.");
    });
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/");
    router.refresh();
  };

  const handleDiscord = async () => {
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

    setDisconnectingDiscord(true);
    setMessage(null);
    const result = await disconnectDiscord();
    setDisconnectingDiscord(false);
    if (result.success) {
      setDiscordUsername(null);
      setMessage("Discord disconnected.");
    } else {
      setMessage(result.error || "We couldn't disconnect Discord.");
    }
  };

  return (
    <div className="min-h-screen bg-[#080d09]">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-[#2a352b] bg-[#080d09]/95 p-4 backdrop-blur">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-[#111811] flex items-center justify-center text-white border border-[#2a352b] hover:border-[#c5f94d]">
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
              <label className="text-xs font-bold text-gray-400">VELOX Username</label>
              <input
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading || !signedIn}
                placeholder="Your VELOX username"
                className="bg-[#090d09] border border-[#2a352b] rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-[#c5f94d] transition-colors"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400">Country / Region</label>
              <input 
                type="text" 
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={loading || !signedIn}
                placeholder="Country or region"
                className="bg-[#090d09] border border-[#2a352b] rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-[#c5f94d] transition-colors"
              />
            </div>

            <Button type="submit" disabled={saving || loading || !signedIn} className="bg-[#c5f94d] hover:bg-[#d5ff70] text-[#090d09] font-bold w-full mt-2">
              {saving ? "Saving..." : loading ? "Loading..." : "Save Changes"}
            </Button>
            {message && <p className="text-sm text-gray-400 text-center" role="status">{message}</p>}
          </form>
        </section>

        {/* Connections */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4" /> Connections
          </h2>
          
          <div className="velox-card p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#5865F2]/20 flex items-center justify-center text-[#5865F2]">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-white text-sm">Discord</span>
                  <span className="text-xs text-gray-400">{discordUsername ? `Connected as ${discordUsername}` : "Not connected"}</span>
                </div>
              </div>
              <Button onClick={handleDiscord} disabled={loading || !signedIn || disconnectingDiscord} size="sm" variant="outline" className="border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2] hover:text-white">
                {disconnectingDiscord ? "Disconnecting..." : discordUsername ? "Disconnect" : "Connect"}
              </Button>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="flex flex-col gap-4 mt-4">
          <Button onClick={handleLogout} variant="outline" className="w-full border-red-500/20 text-red-500 hover:bg-red-500/10 font-bold flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </section>

      </div>
    </div>
  );
}
