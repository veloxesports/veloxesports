import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { getAdminDiscordStats } from "@/features/admin/actions";
import { AdminDiscordClient } from "./AdminDiscordClient";

export default async function AdminDiscordPage() {
  const result = await getAdminDiscordStats({ limit: 100 });

  if (!result.success) {
    return (
      <main className="velox-page flex flex-col items-center justify-center text-center">
        <ShieldAlert className="h-11 w-11 text-[#ffad9a]" aria-hidden />
        <h1 className="mt-4 text-2xl font-black text-white">Discord desk unavailable</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8e998f]">
          {result.error ?? "Failed to load Discord integration data."}
        </p>
        <Link href="/admin" className="velox-muted-button mt-6">
          Command Center
        </Link>
      </main>
    );
  }

  return <AdminDiscordClient data={result.data} />;
}
