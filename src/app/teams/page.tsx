import { Shield } from "lucide-react";
import { getMyTeams } from "@/features/teams/actions";
import { TeamsClient } from "./TeamsClient";

export default async function TeamsPage() {
  const result = await getMyTeams();

  if (!result.success || !result.data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black p-6 text-center">
        <Shield className="mb-4 h-14 w-14 text-slate-700" aria-hidden />
        <h1 className="text-xl font-bold text-white">Teams need Telegram sign-in</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-400">{result.error ?? "Open VELOX inside Telegram to create, join, and manage teams."}</p>
      </main>
    );
  }

  return <TeamsClient initialTeams={result.data} />;
}
