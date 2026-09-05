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

async function telegramMultipartApi<T>(method: string, formData: FormData) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_NOT_CONFIGURED");

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  const data = (await response.json()) as TelegramApiResponse<T>;
  if (!response.ok || !data.ok) {
    console.error("Telegram Bot API multipart request failed", {
      method,
      status: response.status,
      code: data.ok ? undefined : data.error_code,
      description: data.ok ? undefined : data.description,
    });
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
    payload: `khemora:${input.paymentId}`,
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

  const text = `🔔 KHEMORA ESPORTS\n\n${input.title}\n${input.message}`.slice(0, 4_096);
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

export async function sendTelegramPhoto(input: {
  chatId: number | string;
  photo: Buffer | string;
  caption: string;
  parseMode?: "HTML" | "MarkdownV2";
  replyMarkup?: Record<string, unknown>;
}): Promise<{ message_id: number }> {
  const targetChatId = Number(input.chatId);
  if (!Number.isSafeInteger(targetChatId) || targetChatId === 0) throw new Error("TELEGRAM_INVALID_CHAT");

  if (typeof input.photo === "string" && (input.photo.startsWith("http://") || input.photo.startsWith("https://"))) {
    return telegramApi<{ message_id: number }>("sendPhoto", {
      chat_id: targetChatId,
      photo: input.photo,
      caption: input.caption,
      parse_mode: input.parseMode ?? "HTML",
      ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
    });
  }

  const form = new FormData();
  form.append("chat_id", String(targetChatId));
  form.append("caption", input.caption);
  form.append("parse_mode", input.parseMode ?? "HTML");
  if (input.replyMarkup) {
    form.append("reply_markup", JSON.stringify(input.replyMarkup));
  }

  const buffer = typeof input.photo === "string" ? Buffer.from(input.photo) : input.photo;
  form.append("photo", new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }), "photo.jpg");

  return telegramMultipartApi<{ message_id: number }>("sendPhoto", form);
}

export async function editTelegramMessageMedia(input: {
  chatId: number | string;
  messageId: number;
  photo: Buffer | string;
  caption: string;
  parseMode?: "HTML" | "MarkdownV2";
  replyMarkup?: Record<string, unknown>;
}): Promise<{ message_id: number }> {
  const targetChatId = Number(input.chatId);
  if (!Number.isSafeInteger(targetChatId) || targetChatId === 0) throw new Error("TELEGRAM_INVALID_CHAT");

  if (typeof input.photo === "string" && (input.photo.startsWith("http://") || input.photo.startsWith("https://"))) {
    return telegramApi<{ message_id: number }>("editMessageMedia", {
      chat_id: targetChatId,
      message_id: input.messageId,
      media: {
        type: "photo",
        media: input.photo,
        caption: input.caption,
        parse_mode: input.parseMode ?? "HTML",
      },
      ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
    });
  }

  const form = new FormData();
  form.append("chat_id", String(targetChatId));
  form.append("message_id", String(input.messageId));
  form.append(
    "media",
    JSON.stringify({
      type: "photo",
      media: "attach://photo_update",
      caption: input.caption,
      parse_mode: input.parseMode ?? "HTML",
    }),
  );
  if (input.replyMarkup) {
    form.append("reply_markup", JSON.stringify(input.replyMarkup));
  }

  const buffer = typeof input.photo === "string" ? Buffer.from(input.photo) : input.photo;
  form.append("photo_update", new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }), "photo.jpg");

  return telegramMultipartApi<{ message_id: number }>("editMessageMedia", form);
}

export async function answerCallbackQuery(input: {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
}): Promise<boolean> {
  return telegramApi<boolean>("answerCallbackQuery", {
    callback_query_id: input.callbackQueryId,
    ...(input.text ? { text: input.text } : {}),
    ...(input.showAlert !== undefined ? { show_alert: input.showAlert } : {}),
  });
}

