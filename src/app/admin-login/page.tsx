import { LockKeyhole, ShieldCheck } from "lucide-react";
import { AdminLoginForm } from "./AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl items-center px-5 py-10 sm:px-8">
      <section className="relative mx-auto w-full max-w-md overflow-hidden rounded-[30px] border border-[#3d5832] bg-[#101811] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.4)] sm:p-8">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full border-[36px] border-[#2e4821]" aria-hidden />
        <div className="relative">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c5f94d] text-[#091009] shadow-[0_0_30px_rgba(197,249,77,0.26)]"><ShieldCheck className="h-6 w-6" aria-hidden /></span>
          <p className="velox-eyebrow mt-7">Restricted access</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-white">VELOX Command Center</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#aeb8ad]">Sign in with your website administrator credentials. This area is reserved for authorized platform operators.</p>
          <AdminLoginForm />
          <p className="mt-5 flex items-center gap-2 text-xs leading-relaxed text-[#718071]"><LockKeyhole className="h-3.5 w-3.5 shrink-0 text-[#c5f94d]" aria-hidden />Protected with an encrypted, HTTP-only session.</p>
        </div>
      </section>
    </main>
  );
}
