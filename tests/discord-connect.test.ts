import { describe, expect, it } from "vitest";
import {
  createSignedDiscordState,
  verifySignedDiscordState,
  isDiscordOAuthConfigured,
  appBaseUrl,
  getDiscordAvatarUrl,
} from "../src/lib/discord/oauth";

describe("Discord OAuth & State Cryptography", () => {
  it("creates and verifies a signed Discord OAuth state token", () => {
    const signedState = createSignedDiscordState({
      userId: "user-123-uuid",
      telegramId: "tg-999",
      returnTo: "profile",
    });

    expect(typeof signedState).toBe("string");
    expect(signedState.includes(".")).toBe(true);

    const verified = verifySignedDiscordState(signedState);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe("user-123-uuid");
    expect(verified?.telegramId).toBe("tg-999");
    expect(verified?.returnTo).toBe("profile");
    expect(verified?.exp).toBeGreaterThan(Date.now());
  });

  it("rejects a tampered Discord OAuth state token", () => {
    const signedState = createSignedDiscordState({
      userId: "user-legit",
      telegramId: "tg-legit",
    });

    const [, sig] = signedState.split(".");
    // Tamper with the payload data
    const tamperedData = Buffer.from(
      JSON.stringify({ userId: "attacker-id", exp: Date.now() + 100000 })
    ).toString("base64url");
    const tamperedState = `${tamperedData}.${sig}`;

    const verified = verifySignedDiscordState(tamperedState);
    expect(verified).toBeNull();
  });

  it("rejects an invalid or malformed state string", () => {
    expect(verifySignedDiscordState("")).toBeNull();
    expect(verifySignedDiscordState("not-a-token")).toBeNull();
    expect(verifySignedDiscordState("part1.part2.part3.part4")).toBeNull();
  });

  it("determines OAuth configuration state", () => {
    const configured = isDiscordOAuthConfigured();
    expect(typeof configured).toBe("boolean");
  });

  it("resolves appBaseUrl without crashing", () => {
    const url = appBaseUrl();
    expect(url.startsWith("http")).toBe(true);
  });

  it("generates correct Discord avatar CDN URLs", () => {
    const userWithAvatar = {
      id: "80351110224678912",
      avatar: "8342729096ea368616304b57f424c63b",
    };
    const avatarUrl = getDiscordAvatarUrl(userWithAvatar);
    expect(avatarUrl).toBe(
      "https://cdn.discordapp.com/avatars/80351110224678912/8342729096ea368616304b57f424c63b.png?size=128"
    );

    const userWithoutAvatar = {
      id: "80351110224678912",
      avatar: null,
    };
    const defaultAvatarUrl = getDiscordAvatarUrl(userWithoutAvatar);
    expect(defaultAvatarUrl.startsWith("https://cdn.discordapp.com/embed/avatars/")).toBe(true);
  });
});
