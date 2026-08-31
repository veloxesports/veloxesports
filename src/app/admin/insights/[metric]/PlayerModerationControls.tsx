"use client";

import { useState } from "react";
import { Ban, CircleAlert, LockKeyhole, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { moderatePlayerStatus } from "@/features/admin/actions";

type ModerationAction = "BAN" | "UNBAN" | "FREEZE" | "UNFREEZE" | "RESTRICT";

const details: Record<ModerationAction, { label: string; confirmation: string; icon: typeof Ban; className: string }> = {
  BAN: { label: "Ban", confirmation: "Ban this player? They will no longer be able to access VELOX until a Super Admin unbans them.", icon: Ban, className: "border-[#87493d] bg-[#2b1d19] text-[#ffad9a] hover:border-[#b9624f]" },
  UNBAN: { label: "Unban", confirmation: "Restore this banned player to active access?", icon: UserRoundCheck, className: "border-[#496b38] bg-[#182716] text-[#d8f5b3] hover:border-[#6c9b50]" },
  FREEZE: { label: "Freeze", confirmation: "Freeze this player? Their VELOX access will be suspended until a Super Admin restores it.", icon: LockKeyhole, className: "border-[#715f37] bg-[#2d291a] text-[#f0d88e] hover:border-[#9d864c]" },
  UNFREEZE: { label: "Restore", confirmation: "Restore this player's normal VELOX access?", icon: ShieldCheck, className: "border-[#496b38] bg-[#182716] text-[#d8f5b3] hover:border-[#6c9b50]" },
  RESTRICT: { label: "Restrict", confirmation: "Restrict this player? This changes their platform access until a Super Admin restores it.", icon: LockKeyhole, className: "border-[#715f37] bg-[#2d291a] text-[#f0d88e] hover:border-[#9d864c]" },
};

export function PlayerModerationControls({ playerId, playerName, status }: { playerId: string; playerName: string; status: string }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<ModerationAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const actions = actionsFor(status);

  async function run(action: ModerationAction) {
    const detail = details[action];
    if (!window.confirm(detail.confirmation)) return;

    setPendingAction(action);
    setMessage(null);
    const result = await moderatePlayerStatus({ userId: playerId, action });
    setPendingAction(null);
    setMessage(result.success ? result.message ?? "Player access updated." : result.error ?? "Player access could not be updated.");
    if (result.success) router.refresh();
  }

  return (
    <div className="mt-4 border-t border-[#29342a] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#aeb8ad]">Super Admin controls</p><p className="text-[11px] text-[#718071]">Changes are permanently audit logged.</p></div>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => {
          const detail = details[action];
          const Icon = detail.icon;
          return <button key={action} type="button" onClick={() => void run(action)} disabled={pendingAction !== null} className={`inline-flex items-center rounded-xl border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${detail.className}`}><Icon className="mr-1.5 h-3.5 w-3.5" aria-hidden />{pendingAction === action ? "Updating…" : detail.label}</button>;
        })}
      </div>
      {message && <p role="status" className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[#d8e6d2]"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c5f94d]" aria-hidden />{message.replace("this player", playerName)}</p>}
    </div>
  );
}

function actionsFor(status: string): ModerationAction[] {
  if (status === "BANNED") return ["UNBAN"];
  if (status === "SUSPENDED") return ["UNFREEZE", "BAN"];
  if (status === "RESTRICTED") return ["UNFREEZE", "FREEZE", "BAN"];
  if (status === "UNDER_REVIEW") return ["UNFREEZE", "FREEZE", "RESTRICT", "BAN"];
  return ["FREEZE", "RESTRICT", "BAN"];
}
