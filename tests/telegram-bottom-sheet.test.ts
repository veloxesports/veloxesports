import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/notifications/actions", () => ({
  getNotifications: vi.fn().mockResolvedValue({ success: true, data: { notifications: [], unreadCount: 0 } }),
  markAllNotificationsRead: vi.fn().mockResolvedValue({ success: true }),
  markNotificationRead: vi.fn().mockResolvedValue({ success: true }),
}));

import { TelegramBottomSheet } from "../src/components/ui/TelegramBottomSheet";
import { TournamentFilterSelector } from "../src/components/tournaments/TournamentFilterSelector";
import { NotificationSheet } from "../src/components/notifications/NotificationSheet";

describe("Shared Telegram Bottom Sheet System", () => {
  it("exports TelegramBottomSheet component", () => {
    expect(TelegramBottomSheet).toBeDefined();
    expect(typeof TelegramBottomSheet).toBe("function");
  });

  it("exports TournamentFilterSelector component", () => {
    expect(TournamentFilterSelector).toBeDefined();
    expect(typeof TournamentFilterSelector).toBe("function");
  });

  it("exports NotificationSheet component", () => {
    expect(NotificationSheet).toBeDefined();
    expect(typeof NotificationSheet).toBe("function");
  });
});
