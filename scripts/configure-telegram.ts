type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

function required(name: "TELEGRAM_BOT_TOKEN" | "TELEGRAM_WEBHOOK_SECRET" | "NEXT_PUBLIC_APP_URL") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function telegram<T>(method: string, body: Record<string, unknown>, token: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as TelegramResponse<T>;
  if (!response.ok || !payload.ok || !payload.result) {
    throw new Error(payload.description || `${method} failed.`);
  }
  return payload.result;
}

async function main() {
  const token = required("TELEGRAM_BOT_TOKEN");
  const webhookSecret = required("TELEGRAM_WEBHOOK_SECRET");
  const appUrl = new URL(required("NEXT_PUBLIC_APP_URL"));
  if (appUrl.protocol !== "https:") throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS for Telegram Mini Apps.");

  const bot = await telegram<{ username: string }>("getMe", {}, token);
  await telegram("setWebhook", {
    url: new URL("/api/telegram/webhook", appUrl).toString(),
    secret_token: webhookSecret,
    allowed_updates: ["message", "pre_checkout_query", "callback_query"],
  }, token);
  await telegram("setMyCommands", {
    commands: [
      { command: "start", description: "Open Khemora Esports Arena" },
      { command: "onboarding", description: "Tour & How it works" },
    ],
  }, token);
  await telegram("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Open Khemora",
      web_app: { url: appUrl.toString() },
    },
  }, token);

  console.log(`Configured @${bot.username}: webhook, commands, and Open Khemora menu button are ready.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Telegram configuration failed.");
  process.exitCode = 1;
});
