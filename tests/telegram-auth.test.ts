import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateTelegramWebAppData } from "../src/lib/telegram/auth";

function signedInitData(token: string, fields: Record<string, string>) {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.keys()].sort().map((key) => `${key}=${params.get(key)}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  params.set("hash", crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex"));
  return params.toString();
}

describe("Telegram Mini App authentication", () => {
  const token = "test-bot-token";
  const freshFields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "AAH-test",
    user: JSON.stringify({ id: 12345, first_name: "Alex", username: "alex" }),
  };

  it("accepts a correctly signed, fresh initData payload", () => {
    const result = validateTelegramWebAppData(signedInitData(token, freshFields), token);
    expect(result).toEqual(expect.objectContaining({ isValid: true, data: expect.objectContaining({ id: 12345, first_name: "Alex" }) }));
  });

  it("rejects a tampered frontend user payload", () => {
    const value = signedInitData(token, freshFields).replace("Alex", "Mallory");
    expect(validateTelegramWebAppData(value, token).isValid).toBe(false);
  });

  it("rejects expired initData even when the signature is valid", () => {
    const old = { ...freshFields, auth_date: String(Math.floor(Date.now() / 1000) - 86_401) };
    expect(validateTelegramWebAppData(signedInitData(token, old), token).isValid).toBe(false);
  });
});
