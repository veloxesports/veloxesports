import Link from "next/link";
import { ChevronLeft, ReceiptText } from "lucide-react";
import { getAdminFinance } from "@/features/admin/actions";
import { FinanceClient } from "./FinanceClient";

export default async function FinancePage() {
  const result = await getAdminFinance();
  if (!result.success || !result.data) return <main className="velox-page flex flex-col items-center justify-center text-center"><ReceiptText className="h-11 w-11 text-[#526052]" aria-hidden /><h1 className="mt-4 text-2xl font-black text-white">Finance desk unavailable</h1><p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8e998f]">{result.error ?? "Unable to load financial activity."}</p><Link href="/admin" className="velox-muted-button mt-6"><ChevronLeft className="mr-1.5 h-4 w-4" aria-hidden />Back to Command Center</Link></main>;
  return <FinanceClient initialData={result.data} />;
}
