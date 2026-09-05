import { describe, expect, it } from "vitest";
import {
  getCommunityUrl,
  getCompeteCardCaption,
  getCompeteCardKeyboard,
  getMiniAppUrl,
  getWelcomeCardCaption,
  getWelcomeCardKeyboard,
  isFirstTimeUser,
} from "../src/lib/telegram/onboarding";

describe("telegram bot onboarding experience", () => {
  describe("welcome card (Card 1)", () => {
    it("formats the welcome card with the requested esports copy, features, and 5-step guide", () => {
      const caption = getWelcomeCardCaption();

      // Heading & branding
      expect(caption).toContain("Welcome to KHEMORA ESPORTS 🎮🏆");
      expect(caption).toContain("Premier Esports Arena on Telegram");

      // Features
      expect(caption).toContain("Discover Tournaments");
      expect(caption).toContain("Register &amp; Compete");
      expect(caption).toContain("Follow Brackets");
      expect(caption).toContain("Submit Results");
      expect(caption).toContain("Track Progress");
      expect(caption).toContain("Win Prizes");

      // 5-step How It Works
      expect(caption).toContain("How It Works:");
      expect(caption).toContain("1️⃣ <b>Join or register</b>");
      expect(caption).toContain("2️⃣ <b>Check your scheduled matches</b>");
      expect(caption).toContain("3️⃣ <b>Play against your opponent</b>");
      expect(caption).toContain("4️⃣ <b>Submit/confirm the result</b>");
      expect(caption).toContain("5️⃣ <b>Advance through the bracket</b>");

      // Telegram caption length constraint (1024 max for photos)
      expect(caption.length).toBeLessThanOrEqual(1024);
    });

    it("presents a prominent 🚀 START inline button", () => {
      const keyboard = getWelcomeCardKeyboard();
      expect(keyboard.inline_keyboard).toHaveLength(1);
      expect(keyboard.inline_keyboard[0]).toHaveLength(1);
      expect(keyboard.inline_keyboard[0][0].text).toBe("🚀 START");
      expect(keyboard.inline_keyboard[0][0].callback_data).toBe("onboarding_start");
    });
  });

  describe("compete card (Card 2)", () => {
    it("formats the ready-to-compete marketing card within Telegram limits", () => {
      const caption = getCompeteCardCaption();

      expect(caption).toContain("🔥 Ready to Compete?");
      expect(caption).toContain("Join competitive tournaments, challenge other players, climb the brackets, and prove yourself.");
      expect(caption.length).toBeLessThanOrEqual(1024);
    });

    it("places 🎮 OPEN THE APP as the primary CTA and 👥 JOIN COMMUNITY as secondary", () => {
      const keyboard = getCompeteCardKeyboard();
      expect(keyboard.inline_keyboard).toHaveLength(2);

      // Primary CTA: Open Mini App
      const primaryBtn = keyboard.inline_keyboard[0][0];
      expect(primaryBtn.text).toBe("🎮 OPEN THE APP");
      if ("web_app" in primaryBtn) {
        expect(primaryBtn.web_app).toBeDefined();
        expect(primaryBtn.web_app.url).toMatch(/^https:\/\//);
      } else {
        throw new Error("Expected primary button to have web_app");
      }

      // Secondary CTA: Telegram Community
      const secondaryBtn = keyboard.inline_keyboard[1][0];
      expect(secondaryBtn.text).toBe("👥 JOIN COMMUNITY");
      if ("url" in secondaryBtn) {
        expect(secondaryBtn.url).toMatch(/^https?:\/\//);
      } else {
        throw new Error("Expected secondary button to have url");
      }
    });
  });

  describe("user first-time detection", () => {
    it("identifies a brand-new user without lastLogin or with botOnboarded=false as first-time", () => {
      expect(
        isFirstTimeUser({
          createdAt: new Date(),
          lastLogin: null,
          profile: { gamerIds: { botOnboarded: false } },
        })
      ).toBe(true);

      expect(
        isFirstTimeUser({
          createdAt: new Date(),
          lastLogin: null,
          profile: null,
        })
      ).toBe(true);
    });

    it("identifies returning users who have completed onboarding as NOT first-time", () => {
      expect(
        isFirstTimeUser({
          createdAt: new Date(),
          lastLogin: null,
          profile: { gamerIds: { botOnboarded: true, botOnboardedAt: new Date().toISOString() } },
        })
      ).toBe(false);
    });

    it("identifies existing players who have logged into the app before as NOT first-time", () => {
      expect(
        isFirstTimeUser({
          createdAt: new Date(Date.now() - 100000),
          lastLogin: new Date(),
          profile: { gamerIds: {} },
        })
      ).toBe(false);
    });
  });

  describe("URL resolution and graceful fallbacks", () => {
    it("resolves configured HTTPS app URL or falls back safely", () => {
      const original = process.env.NEXT_PUBLIC_APP_URL;
      try {
        process.env.NEXT_PUBLIC_APP_URL = "https://play.velox.gg";
        expect(getMiniAppUrl()).toBe("https://play.velox.gg/");

        process.env.NEXT_PUBLIC_APP_URL = "not-a-valid-url";
        expect(getMiniAppUrl()).toBe("https://khemoraesports.com");
      } finally {
        if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
        else process.env.NEXT_PUBLIC_APP_URL = original;
      }
    });

    it("resolves configured community URL or falls back safely", () => {
      const original = process.env.TELEGRAM_COMMUNITY_URL;
      try {
        process.env.TELEGRAM_COMMUNITY_URL = "https://t.me/my_khemora_squad";
        expect(getCommunityUrl()).toBe("https://t.me/my_khemora_squad");

        process.env.TELEGRAM_COMMUNITY_URL = "";
        expect(getCommunityUrl()).toBe("https://t.me/khemoraesports");
      } finally {
        if (original === undefined) delete process.env.TELEGRAM_COMMUNITY_URL;
        else process.env.TELEGRAM_COMMUNITY_URL = original;
      }
    });
  });
});
