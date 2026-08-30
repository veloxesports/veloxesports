import crypto from "crypto";

export type TelegramMiniAppUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
};

export function validateTelegramWebAppData(
  telegramInitData: string,
  botToken: string,
  maxAgeSeconds = 24 * 60 * 60,
): { isValid: boolean; data?: TelegramMiniAppUser } {
  try {
    if (!telegramInitData || !botToken) return { isValid: false };

    const urlParams = new URLSearchParams(telegramInitData);
    const hash = urlParams.get("hash");
    const authDate = Number(urlParams.get("auth_date"));
    if (!hash) {
      return { isValid: false };
    }

    const now = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(authDate) || authDate <= 0 || now - authDate > maxAgeSeconds || authDate > now + 60) {
      return { isValid: false };
    }

    urlParams.delete("hash");

    // Sort parameters alphabetically
    const keys = Array.from(urlParams.keys()).sort();
    const dataCheckString = keys
      .map((key) => `${key}=${urlParams.get(key)}`)
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    const hashBuffer = Buffer.from(hash, "hex");
    const calculatedHashBuffer = Buffer.from(calculatedHash, "hex");

    if (
      hashBuffer.length === calculatedHashBuffer.length &&
      crypto.timingSafeEqual(hashBuffer, calculatedHashBuffer)
    ) {
      const user = urlParams.get("user");
      return {
        isValid: true,
        data: user ? (JSON.parse(user) as TelegramMiniAppUser) : undefined,
      };
    }

    return { isValid: false };
  } catch (error) {
    console.error("Error validating Telegram initData", error);
    return { isValid: false };
  }
}
