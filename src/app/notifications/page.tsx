import { Bell } from "lucide-react";
import { getNotifications } from "@/features/notifications/actions";
import { NotificationsList } from "@/features/notifications/NotificationsList";

export default async function NotificationsPage() {
  const result = await getNotifications();

  return (
    <div className="velox-page">
      <header className="mb-7">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6 text-[#c5f94d]" />
          <h1 className="text-4xl font-black tracking-[-0.05em] text-white">Alerts</h1>
        </div>
        <p className="mt-1 text-gray-400">Stay updated on your competitions</p>
      </header>

      {result.success && result.data ? (
        <NotificationsList initialNotifications={result.data} />
      ) : (
        <div className="rounded-2xl border border-white/5 bg-gray-900 p-8 text-center text-sm text-gray-400">
          {result.error || "We couldn't load your alerts."}
        </div>
      )}
    </div>
  );
}
