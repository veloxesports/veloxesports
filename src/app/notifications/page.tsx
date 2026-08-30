import { Bell, Trophy, Wallet, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotificationsPage() {
  const notifications = [
    { id: "1", type: "MATCH", title: "Match Starting Soon!", message: "Your FC26 Quarter Final starts in 15 minutes.", time: "15m ago", isRead: false, icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20" },
    { id: "2", type: "PAYMENT", title: "Payment Successful", message: "⭐ 100 has been added to your wallet for tournament entry.", time: "2h ago", isRead: true, icon: Wallet, color: "text-green-500", bg: "bg-green-500/10 border-green-500/20" },
    { id: "3", type: "SYSTEM", title: "Profile Verified", message: "Your account is now verified.", time: "1d ago", isRead: true, icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" },
    { id: "4", type: "DISPUTE", title: "Dispute Resolved", message: "Admin has ruled in your favor. Match result updated.", time: "2d ago", isRead: true, icon: ShieldAlert, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-black p-4 pb-24">
      <header className="mb-6 pt-2 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Alerts</h1>
          <p className="text-gray-400 mt-1">Stay updated</p>
        </div>
        <button className="text-xs text-purple-400 font-bold hover:text-purple-300">Mark all read</button>
      </header>

      <div className="flex flex-col gap-3">
        {notifications.map(n => {
          const Icon = n.icon;
          return (
            <div key={n.id} className={`p-4 rounded-2xl border flex gap-4 transition-colors ${n.isRead ? 'bg-gray-900 border-white/5 opacity-70' : `bg-gray-900 ${n.bg}`}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${n.isRead ? 'bg-black border border-white/10 text-gray-500' : 'bg-black border border-white/10 ' + n.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1 w-full">
                <div className="flex justify-between items-start">
                  <h3 className={`font-bold text-sm ${n.isRead ? 'text-gray-300' : 'text-white'}`}>{n.title}</h3>
                  <span className="text-[10px] font-bold text-gray-500">{n.time}</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{n.message}</p>
                {!n.isRead && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white h-7 text-xs">View</Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
