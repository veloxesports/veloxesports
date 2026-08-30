"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const result: unknown = await response.json();
      const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string" ? result.error : "We couldn’t sign you in right now.";

      if (!response.ok) {
        setError(message);
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("We couldn’t sign you in right now. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-4">
      <label className="block text-sm font-bold text-[#dce8d7]">Username
        <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={64} className="mt-2 w-full rounded-2xl border border-[#344335] bg-[#080d09] px-4 py-3.5 text-white outline-none transition placeholder:text-[#6f796f] focus:border-[#c5f94d] focus:ring-2 focus:ring-[#c5f94d]/15" placeholder="super_admin" />
      </label>
      <label className="block text-sm font-bold text-[#dce8d7]">Password
        <input name="password" type="password" autoComplete="current-password" required minLength={12} maxLength={128} className="mt-2 w-full rounded-2xl border border-[#344335] bg-[#080d09] px-4 py-3.5 text-white outline-none transition placeholder:text-[#6f796f] focus:border-[#c5f94d] focus:ring-2 focus:ring-[#c5f94d]/15" placeholder="Enter your password" />
      </label>
      {error && <p role="alert" className="rounded-2xl border border-[#87493d] bg-[#2b1d19] px-4 py-3 text-sm font-medium text-[#ffb1a0]">{error}</p>}
      <button type="submit" disabled={pending} className="velox-action w-full py-3.5">
        {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
        {pending ? "Signing in…" : "Enter Command Center"}
        {!pending && <ArrowRight className="ml-2 h-4 w-4" aria-hidden />}
      </button>
    </form>
  );
}
