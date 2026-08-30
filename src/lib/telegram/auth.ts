import crypto from "crypto";

export function validateTelegramWebAppData(
  telegramInitData: string,
  botToken: string
): { isValid: boolean; data?: any } {
  try {
    const urlParams = new URLSearchParams(telegramInitData);
    const hash = urlParams.get("hash");
    if (!hash) {
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

    if (calculatedHash === hash) {
      const user = urlParams.get("user");
      return {
        isValid: true,
        data: user ? JSON.parse(decodeURIComponent(user)) : null,
      };
    }

    return { isValid: false };
  } catch (error) {
    console.error("Error validating Telegram initData", error);
    return { isValid: false };
  }
}
