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
          {result.success && result.data && result.data.unreadCount > 0 && <span className="rounded-full bg-[#c5f94d] px-2 py-0.5 text-xs font-black text-[#090d09]">{result.data.unreadCount > 99 ? "99+" : result.data.unreadCount}</span>}
        </div>
        <p className="mt-1 text-gray-400">Stay updated on your competitions</p>
      </header>

      {result.success && result.data ? (
        <NotificationsList initialNotifications={result.data.notifications} initialUnreadCount={result.data.unreadCount} />
      ) : (
        <div className="velox-card p-8 text-center text-sm text-[#8e998f]">
          {result.error || "We couldn't load your alerts."}
        </div>
      )}
    </div>
  );
}
