import Link from "next/link";
import { getAdminFinance } from "@/features/admin/actions";
import { FinanceClient } from "./FinanceClient";

export default async function FinancePage() {
  const result = await getAdminFinance();
  if (!result.success || !result.data) return <main className="min-h-screen bg-black p-6 text-center text-red-300"><Link href="/admin" className="text-violet-300">Back to command center</Link><p className="mt-5">{result.error ?? "Unable to load financial activity."}</p></main>;
  return <FinanceClient initialData={result.data} />;
}
