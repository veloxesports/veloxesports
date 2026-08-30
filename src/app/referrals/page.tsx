import { Gift } from "lucide-react";
import { getMyReferral } from "@/features/referrals/actions";
import { ReferralsClient } from "./ReferralsClient";

export default async function ReferralsPage() {
  const result = await getMyReferral();
  if (!result.success || !result.data) {
    return <main className="flex min-h-screen flex-col items-center justify-center bg-black p-6 text-center"><Gift className="mb-4 h-14 w-14 text-slate-700" aria-hidden /><h1 className="text-xl font-bold text-white">Referrals need Telegram sign-in</h1><p className="mt-2 text-sm text-slate-400">{result.error ?? "Open VELOX inside Telegram to invite friends."}</p></main>;
  }
  return <ReferralsClient initialData={result.data} />;
}
