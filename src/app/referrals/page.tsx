import { getMyReferral } from "@/features/referrals/actions";
import { ReferralsClient } from "./ReferralsClient";
import { TelegramAccessRequired } from "@/components/auth/TelegramAccessRequired";

export default async function ReferralsPage() {
  const result = await getMyReferral();
  if (!result.success || !result.data) {
    return <TelegramAccessRequired title="Referrals need Telegram" message={result.error ?? "Open Khemora in Telegram to invite friends."} />;
  }
  return <ReferralsClient initialData={result.data} />;
}
