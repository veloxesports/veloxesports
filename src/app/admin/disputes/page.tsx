import Link from "next/link";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { getOpenDisputes } from "@/features/admin/actions";
import { DisputesClient } from "./DisputesClient";

export default async function DisputesPage() {
  const result = await getOpenDisputes();
  if (!result.success || !result.data) return <main className="velox-page flex flex-col items-center justify-center text-center"><ShieldAlert className="h-11 w-11 text-[#526052]" aria-hidden /><h1 className="mt-4 text-2xl font-black text-white">Dispute desk unavailable</h1><p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8e998f]">{result.error ?? "Unable to load disputes."}</p><Link href="/admin" className="velox-muted-button mt-6"><ChevronLeft className="mr-1.5 h-4 w-4" aria-hidden />Back to Command Center</Link></main>;
  return <DisputesClient disputes={result.data} />;
}
