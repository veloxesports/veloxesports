import Link from "next/link";
import { ChevronLeft, Settings } from "lucide-react";
import { getAdminSettings } from "@/features/admin/actions";
import { AdminSettingsClient } from "./AdminSettingsClient";

export default async function AdminSettingsPage() {
  const result = await getAdminSettings();
  if (!result.success || !result.data) {
    return (
      <main className="velox-page flex flex-col items-center justify-center text-center">
        <Settings className="h-11 w-11 text-[#526052]" aria-hidden />
        <h1 className="mt-4 text-2xl font-black text-white">Settings desk unavailable</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8e998f]">
          {result.error ?? "Unable to load settings."}
        </p>
        <Link href="/admin" className="velox-muted-button mt-6">
          <ChevronLeft className="mr-1.5 h-4 w-4" aria-hidden />
          Back to Command Center
        </Link>
      </main>
    );
  }

  return <AdminSettingsClient initialData={result.data} />;
}
