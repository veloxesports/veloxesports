"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  LoaderCircle,
  Megaphone,
  RefreshCw,
  Send,
  Smartphone,
  X,
} from "lucide-react";
import type { AdminNotificationsData } from "@/features/admin/actions";
import { retryFailedNotifications, sendAdminBroadcastNotification } from "@/features/admin/actions";

type NotificationsData = AdminNotificationsData;

type TournamentOption = {
  id: string;
  title: string;
  gameName: string;
};

export function AdminNotificationsClient({
  data,
  tournaments,
}: {
  data: NotificationsData;
  tournaments: TournamentOption[];
}) {
  const router = useRouter();
  const [filterStatus, setFilterStatus] = useState<"all" | "sent" | "failed" | "pending">("all");
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isRetrying, startRetrying] = useTransition();

  const filteredNotifications = data.notifications.filter((n) => {
    if (filterStatus === "sent" && !n.telegramSentAt) return false;
    if (filterStatus === "failed" && !n.telegramDeliveryError) return false;
    if (filterStatus === "pending" && (!n.telegramDeliveryEligible || n.telegramSentAt || n.telegramDeliveryError)) return false;
    return true;
  });

  const sentCount = data.notifications.filter((n) => n.telegramSentAt).length;

  function handleRetryAll() {
    startRetrying(async () => {
      const result = await retryFailedNotifications();
      if (result.success) {
        setToast({ message: result.message ?? "Queued failed notifications for re-delivery.", type: "success" });
        router.refresh();
      } else {
        setToast({ message: result.error ?? "Failed to retry notifications.", type: "error" });
      }
    });
  }

  function handleRetrySingle(id: string) {
    startRetrying(async () => {
      const result = await retryFailedNotifications([id]);
      if (result.success) {
        setToast({ message: "Notification queued for retry.", type: "success" });
        router.refresh();
      } else {
        setToast({ message: result.error ?? "Failed to retry notification.", type: "error" });
      }
    });
  }

  return (
    <main className="velox-page">
      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed right-4 top-20 z-[90] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold shadow-[0_18px_55px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:right-6 ${
            toast.type === "success"
              ? "border-[#55783e] bg-[#172417]/95 text-[#e8ffd0]"
              : "border-[#8a4237] bg-[#291715]/95 text-[#ffd5ce]"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 className="h-5 w-5 text-[#c5f94d]" /> : <AlertCircle className="h-5 w-5 text-[#ff8e7d]" />}
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="ml-2 text-current opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="velox-eyebrow">Communication & Alerts</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-white sm:text-3xl">
            Notifications & Broadcasts
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#8e998f]">
            Dispatch platform announcements, tournament updates, match alerts, and monitor Telegram bot delivery logs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.failedCount > 0 && (
            <button
              type="button"
              onClick={handleRetryAll}
              disabled={isRetrying}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#7a3830] bg-[#241413] px-3.5 py-2 text-xs font-bold text-[#ffad97] transition hover:bg-[#331c1a] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
              <span>Retry all failed ({data.failedCount})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowBroadcastModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#c5f94d] px-3.5 py-2 text-xs font-black text-[#0a0e0a] transition hover:bg-[#d5ff70]"
          >
            <Megaphone className="h-4 w-4" aria-hidden />
            <span>New announcement</span>
          </button>
        </div>
      </header>

      {/* KPI Counters */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-white">{data.totalCount}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Total alerts generated</p>
        </div>
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-[#c5f94d]">{sentCount}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Telegram delivered</p>
        </div>
        <div className={`rounded-2xl border p-4 ${data.failedCount > 0 ? "border-[#964738]/70 bg-[#2b1916]" : "border-[#2f4530] bg-[#121b12]"}`}>
          <p className={`text-2xl font-black ${data.failedCount > 0 ? "text-[#ffad97]" : "text-white"}`}>{data.failedCount}</p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Failed delivery</p>
        </div>
        <div className="rounded-2xl border border-[#2f4530] bg-[#121b12] p-4">
          <p className="text-2xl font-black text-[#84d8ff]">
            {data.notifications.filter((n) => n.telegramDeliveryEligible).length}
          </p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">Push eligible</p>
        </div>
      </section>

      {/* Filter Tabs */}
      <section className="mt-5 flex items-center justify-between rounded-2xl border border-[#273628] bg-[#0e150f] p-4">
        <div className="flex flex-wrap gap-1 text-xs">
          {[
            { id: "all", label: "All alerts" },
            { id: "sent", label: `Sent to Telegram (${sentCount})` },
            { id: "failed", label: `Failed (${data.failedCount})` },
            { id: "pending", label: "Queued" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id as "all" | "sent" | "failed" | "pending")}
              className={`rounded-lg px-3 py-1.5 font-bold transition ${
                filterStatus === tab.id
                  ? "bg-[#1f311c] text-[#c5f94d]"
                  : "text-[#8e998f] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-[#8e998f]">
          Showing <strong>{filteredNotifications.length}</strong> record{filteredNotifications.length === 1 ? "" : "s"}
        </span>
      </section>

      {/* Notifications Table */}
      <section className="velox-card mt-5 overflow-hidden">
        {filteredNotifications.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="mx-auto h-10 w-10 text-[#4c5b4c]" aria-hidden />
            <p className="mt-3 font-bold text-white">No notifications found</p>
            <p className="mt-1 text-xs text-[#8e998f]">Notifications and broadcast history will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#232f24] bg-[#0c130d] text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">
                <tr>
                  <th className="px-5 py-3">Alert</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Telegram Delivery</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b20]">
                {filteredNotifications.map((n) => (
                  <tr key={n.id} className="transition hover:bg-[#131d14]">
                    <td className="px-5 py-3.5">
                      <div className="max-w-md">
                        <p className="font-bold text-white">{n.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-[#9eb09b]">{n.message}</p>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-xs">
                        <p className="font-bold text-white">{n.user.name}</p>
                        <p className="text-[10px] text-[#788877]">TG: {n.user.telegramId}</p>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="rounded-lg bg-[#141e15] px-2 py-0.5 text-[10px] font-bold text-[#c5f94d]">
                        {n.type}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      {n.telegramSentAt ? (
                        <div className="flex items-center gap-1.5 text-xs text-[#c5f94d]">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>Delivered</span>
                        </div>
                      ) : n.telegramDeliveryError ? (
                        <div className="max-w-xs text-xs">
                          <span className="inline-flex items-center gap-1 text-[#ffad97]">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>Failed</span>
                          </span>
                          <p className="truncate text-[10px] text-[#cca29d]">{n.telegramDeliveryError}</p>
                        </div>
                      ) : n.telegramDeliveryEligible ? (
                        <span className="text-xs text-[#f5c66b]">Queued for bot</span>
                      ) : (
                        <span className="text-xs text-[#627362]">In-app only</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-xs text-[#8e998f]">
                      {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(n.createdAt))}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      {n.telegramDeliveryError ? (
                        <button
                          type="button"
                          onClick={() => handleRetrySingle(n.id)}
                          disabled={isRetrying}
                          className="rounded-lg border border-[#7a3830] bg-[#221312] px-2.5 py-1 text-xs font-bold text-[#ffad97] transition hover:bg-[#301b19]"
                        >
                          Retry
                        </button>
                      ) : (
                        <span className="text-xs text-[#526352]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <BroadcastAnnouncementModal
          tournaments={tournaments}
          onClose={() => setShowBroadcastModal(false)}
          onSuccess={(msg) => {
            setShowBroadcastModal(false);
            setToast({ message: msg, type: "success" });
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

function BroadcastAnnouncementModal({
  tournaments,
  onClose,
  onSuccess,
}: {
  tournaments: TournamentOption[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<"ALL" | "TOURNAMENT">("ALL");
  const [tournamentId, setTournamentId] = useState(tournaments[0]?.id ?? "");
  const [sendTelegram, setSendTelegram] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setError("Please fill in both title and message.");
      return;
    }
    setPending(true);
    setError(null);

    const result = await sendAdminBroadcastNotification({
      title: title.trim(),
      message: message.trim(),
      target,
      tournamentId: target === "TOURNAMENT" ? tournamentId : undefined,
      sendTelegram,
    });

    setPending(false);
    if (result.success) {
      onSuccess(result.message ?? "Broadcast delivered successfully.");
    } else {
      setError(result.error ?? "Failed to send broadcast.");
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#020503]/80 p-4 backdrop-blur-[6px]">
      <div className="w-full max-w-2xl rounded-[24px] border border-[#40563a] bg-[#0d140e] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between border-b border-[#232f24] pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#1c291c] text-[#c5f94d]">
              <Megaphone className="h-5 w-5" />
            </span>
            <div>
              <p className="velox-eyebrow">Platform Dispatch</p>
              <h2 className="mt-0.5 text-lg font-black text-white">Broadcast Announcement</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-[#8e998f] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-[#8a4237] bg-[#291715] p-3 text-xs text-[#ffd5ce]">
            {error}
          </div>
        )}

        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#b6c5b2]">Announcement Title</label>
              <input
                type="text"
                placeholder="e.g., Weekend Major Registration Open!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={120}
                className="mt-1 w-full rounded-xl border border-[#2d3e2e] bg-[#121a13] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-[#5f6f5f] focus:border-[#c5f94d]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#b6c5b2]">Target Audience</label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as "ALL" | "TOURNAMENT")}
                className="mt-1 w-full rounded-xl border border-[#2d3e2e] bg-[#121a13] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#c5f94d]"
              >
                <option value="ALL">All platform players</option>
                <option value="TOURNAMENT">Tournament participants only</option>
              </select>
            </div>

            {target === "TOURNAMENT" && (
              <div>
                <label className="block text-xs font-bold text-[#b6c5b2]">Select Tournament</label>
                <select
                  value={tournamentId}
                  onChange={(e) => setTournamentId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#2d3e2e] bg-[#121a13] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#c5f94d]"
                >
                  {tournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.gameName})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#b6c5b2]">Message Body</label>
              <textarea
                rows={4}
                placeholder="State your announcement clearly. This will be sent to the Telegram Mini App inbox..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                maxLength={1000}
                className="mt-1 w-full rounded-xl border border-[#2d3e2e] bg-[#121a13] p-3 text-sm text-white outline-none placeholder:text-[#5f6f5f] focus:border-[#c5f94d]"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
              <input
                type="checkbox"
                checked={sendTelegram}
                onChange={(e) => setSendTelegram(e.target.checked)}
                className="h-4 w-4 rounded accent-[#c5f94d]"
              />
              <span>Send Telegram Bot push notification to eligible players</span>
            </label>

            <div className="flex items-center justify-end gap-3 border-t border-[#232f24] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#2d3e2e] bg-transparent px-4 py-2 text-xs font-bold text-[#9eb09b] transition hover:bg-[#1a251b] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-xl bg-[#c5f94d] px-4 py-2 text-xs font-black text-[#0a0e0a] transition hover:bg-[#d5ff70] disabled:opacity-50"
              >
                {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span>Send announcement</span>
              </button>
            </div>
          </form>

          {/* Live Mobile Card Preview */}
          <div className="flex flex-col rounded-2xl border border-[#273628] bg-[#080d09] p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#8e998f]">
              <Smartphone className="h-4 w-4 text-[#c5f94d]" />
              <span>Telegram Mini App Preview</span>
            </div>

            <div className="mt-4 flex-1 rounded-2xl border border-[#2f4030] bg-[#121a13] p-4 shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md bg-[#1f311c] px-2 py-0.5 text-[9px] font-black uppercase text-[#c5f94d]">
                  SYSTEM ANNOUNCEMENT
                </span>
                <span className="text-[10px] text-[#718071]">Just now</span>
              </div>
              <p className="mt-2 text-sm font-black text-white">
                {title.trim() || "Announcement Title"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#b6c5b2]">
                {message.trim() || "Your announcement message body will appear here for players in their alerts panel."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
