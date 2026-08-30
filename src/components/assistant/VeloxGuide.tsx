"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, SendHorizontal, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

const SUGGESTED_QUESTIONS = [
  "Which tournaments can I join?",
  "How do Telegram Stars payments work?",
  "How do I report a match result?",
  "How do I join a team?",
];

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hey, I’m the VELOX Guide. Ask me about tournaments, payments, matches, teams, or how VELOX works.",
};

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  };
}

export function VeloxGuide() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isSending, setIsSending] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 150);
    return () => window.clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  if (pathname.startsWith("/admin") || pathname === "/admin-login") return null;

  async function askGuide(question: string) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isSending) return;

    const userMessage = createMessage("user", trimmedQuestion);
    const history = messages.slice(-6).map(({ role, content }) => ({ role, content }));

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedQuestion, history }),
      });
      const result: unknown = await response.json();
      const answer =
        typeof result === "object" &&
        result !== null &&
        "answer" in result &&
        typeof result.answer === "string"
          ? result.answer
          : null;

      if (!response.ok || !answer) {
        throw new Error("The VELOX Guide could not answer right now.");
      }

      setMessages((current) => [...current, createMessage("assistant", answer)]);
    } catch {
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          "I can’t reach the guide right now. You can still browse open events in Tournaments or manage your next game in Match Center. Please try again in a moment.",
        ),
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askGuide(input);
  }

  return (
    <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-3 z-50 sm:bottom-7 sm:right-6">
      {isOpen && (
        <section
          id="velox-guide"
          aria-label="VELOX Guide chat"
          aria-modal="true"
          role="dialog"
          className="absolute bottom-16 right-0 flex max-h-[min(42rem,calc(100dvh-10rem))] w-[calc(100vw-1.5rem)] max-w-[25rem] flex-col overflow-hidden rounded-[28px] border border-[#45623a] bg-[#0e1510] shadow-[0_24px_80px_rgba(0,0,0,0.6)] sm:bottom-[4.5rem]"
        >
          <header className="relative flex items-center justify-between border-b border-[#2a352b] bg-[radial-gradient(circle_at_15%_0%,rgba(197,249,77,0.18),transparent_38%)] px-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#c5f94d] text-[#091009] shadow-[0_0_30px_rgba(197,249,77,0.28)]">
                <Bot className="h-6 w-6" aria-hidden />
                <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#0e1510] bg-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-black text-white">
                  VELOX Guide <Sparkles className="h-3.5 w-3.5 text-[#c5f94d]" aria-hidden />
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-[#aeb8ad]">Online · tournament support</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#344335] bg-[#131c14] text-[#aeb8ad] transition hover:border-[#c5f94d] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c5f94d]"
              aria-label="Close VELOX Guide"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4" aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <p
                  className={`max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "rounded-br-md bg-[#c5f94d] font-medium text-[#091009]"
                      : "rounded-bl-md border border-[#2d3c2f] bg-[#151f16] text-[#e6ece6]"
                  }`}
                >
                  {message.content}
                </p>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-[#2d3c2f] bg-[#151f16] px-3.5 py-3 text-sm text-[#aeb8ad]">
                  <LoaderCircle className="h-4 w-4 animate-spin text-[#c5f94d]" aria-hidden />
                  Looking that up…
                </div>
              </div>
            )}
            <div ref={endOfMessagesRef} />
          </div>

          <div className="border-t border-[#2a352b] bg-[#101811] px-3 pb-3 pt-3">
            {messages.length === 1 && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void askGuide(question)}
                    disabled={isSending}
                    className="shrink-0 rounded-full border border-[#3a4d38] bg-[#172217] px-3 py-2 text-left text-[11px] font-bold text-[#dce8d7] transition hover:border-[#c5f94d] hover:text-[#c5f94d] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <label className="sr-only" htmlFor="velox-guide-question">Ask the VELOX Guide</label>
              <input
                ref={inputRef}
                id="velox-guide-question"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={600}
                disabled={isSending}
                placeholder="Ask about VELOX…"
                className="min-w-0 flex-1 rounded-2xl border border-[#344335] bg-[#080d09] px-3.5 py-3 text-sm text-white outline-none placeholder:text-[#6f796f] focus:border-[#c5f94d] disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#c5f94d] text-[#091009] transition hover:bg-[#d6ff71] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c5f94d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101811]"
                aria-label="Send question"
              >
                <SendHorizontal className="h-5 w-5" aria-hidden />
              </button>
            </form>
            <p className="mt-2 text-center text-[10px] font-medium text-[#718071]">Never share passwords, payment details, or private codes.</p>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="velox-guide"
        aria-label={isOpen ? "Close VELOX Guide" : "Open VELOX Guide"}
        className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d9ff82]/70 bg-[#c5f94d] text-[#091009] shadow-[0_14px_38px_rgba(76,118,26,0.35)] transition hover:scale-[1.03] hover:bg-[#d6ff71] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c5f94d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080d09]"
      >
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#080d09] bg-emerald-500" />
        <Bot className="h-6 w-6" aria-hidden />
      </button>
    </div>
  );
}
