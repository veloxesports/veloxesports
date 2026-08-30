import Link from "next/link";
import { getOpenDisputes } from "@/features/admin/actions";
import { DisputesClient } from "./DisputesClient";

export default async function DisputesPage() {
  const result = await getOpenDisputes();
  if (!result.success || !result.data) return <main className="min-h-screen bg-black p-6 text-center text-red-300"><Link href="/admin" className="text-violet-300">Back to command center</Link><p className="mt-5">{result.error ?? "Unable to load disputes."}</p></main>;
  return <DisputesClient disputes={result.data} />;
}
