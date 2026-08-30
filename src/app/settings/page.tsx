"use client";

import { useState } from "react";
import { User, Shield, Gamepad2, Globe, LogOut, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [username, setUsername] = useState("Alex_Pro");
  const [country, setCountry] = useState("United States");
  const [saving, setSaving] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => setSaving(false), 1000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-black">
      <header className="p-4 flex items-center gap-4 bg-gray-900 border-b border-white/10 sticky top-0 z-10">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white border border-white/10 hover:bg-gray-800">
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
          
          <form onSubmit={handleSave} className="bg-gray-900 border border-white/5 rounded-2xl p-4 flex flex-col gap-4 shadow-lg">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400">VELOX Username</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-400">Country / Region</label>
              <input 
                type="text" 
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <Button type="submit" disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white font-bold w-full mt-2">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </section>

        {/* Connections */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4" /> Connections
          </h2>
          
          <div className="bg-gray-900 border border-white/5 rounded-2xl p-4 flex flex-col gap-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#5865F2]/20 flex items-center justify-center text-[#5865F2]">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-white text-sm">Discord</span>
                  <span className="text-xs text-gray-400">Not connected</span>
                </div>
              </div>
              <Button size="sm" variant="outline" className="border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2] hover:text-white">
                Connect
              </Button>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="flex flex-col gap-4 mt-4">
          <Button variant="outline" className="w-full border-red-500/20 text-red-500 hover:bg-red-500/10 font-bold flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </section>

      </div>
    </div>
  );
}
