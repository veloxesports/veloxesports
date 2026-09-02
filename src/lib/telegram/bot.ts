type TelegramApiResponse<T> =
  | { ok: true; result: T }
  | { ok: false; description?: string; error_code?: number };

async function telegramApi<T>(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_NOT_CONFIGURED");

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = (await response.json()) as TelegramApiResponse<T>;
  if (!response.ok || !data.ok) {
    console.error("Telegram Bot API request failed", { method, status: response.status, code: data.ok ? undefined : data.error_code });
    throw new Error("TELEGRAM_API_ERROR");
  }

  return data.result;
}

export function createTournamentInvoice(input: {
  paymentId: string;
  title: string;
  amount: number;
}) {
  const title = input.title.slice(0, 32);
  const description = `Tournament entry for ${input.title}`.slice(0, 255);

  return telegramApi<string>("createInvoiceLink", {
    title,
    description,
    payload: `velox:${input.paymentId}`,
    provider_token: "",
    currency: "XTR",
    prices: [{ label: "Tournament entry", amount: input.amount }],
  });
}

export async function answerPreCheckoutQuery(input: {
  preCheckoutQueryId: string;
  ok: boolean;
  errorMessage?: string;
}) {
  await telegramApi<boolean>("answerPreCheckoutQuery", {
    pre_checkout_query_id: input.preCheckoutQueryId,
    ok: input.ok,
    ...(input.errorMessage ? { error_message: input.errorMessage } : {}),
  });
}

export async function refundTelegramStarsPayment(input: {
  telegramUserId: string;
  telegramPaymentChargeId: string;
}) {
  await telegramApi<boolean>("refundStarPayment", {
    user_id: Number(input.telegramUserId),
    telegram_payment_charge_id: input.telegramPaymentChargeId,
  });
}

export async function sendTelegramMiniAppNotification(input: {
  telegramUserId: string;
  title: string;
  message: string;
  actionLabel: string;
  webAppUrl: string | null;
}) {
  const chatId = Number(input.telegramUserId);
  if (!Number.isSafeInteger(chatId) || chatId <= 0) throw new Error("TELEGRAM_INVALID_CHAT");

  const text = `🔔 VELOX\n\n${input.title}\n${input.message}`.slice(0, 4_096);
  await telegramApi<boolean>("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(input.webAppUrl ? {
      reply_markup: {
        inline_keyboard: [[{
          text: input.actionLabel,
          web_app: { url: input.webAppUrl },
        }]],
      },
    } : {}),
  });
}
