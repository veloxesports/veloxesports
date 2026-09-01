import { getMyTeams } from "@/features/teams/actions";
import { TeamsClient } from "./TeamsClient";
import { TelegramAccessRequired } from "@/components/auth/TelegramAccessRequired";

export default async function TeamsPage() {
  const result = await getMyTeams();

  if (!result.success || !result.data) {
    return <TelegramAccessRequired title="Teams need Telegram" message={result.error ?? "Open VELOX in Telegram to create, join, and manage teams."} />;
  }

  return <TeamsClient initialTeams={result.data} />;
}
