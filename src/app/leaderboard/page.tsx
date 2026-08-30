import { Crown, Trophy } from "lucide-react";
import { getGlobalLeaderboard } from "@/features/leaderboard/actions";

/* eslint-disable @next/next/no-img-element -- Leaderboard avatars can originate from Telegram or Supabase. */

type LeaderboardPlayer = {
  id: string;
  xp: number;
  rank: string;
  veloxUsername: string | null;
  user: { username: string | null; firstName: string | null; profileImage: string | null };
};

export default async function LeaderboardPage() {
  const res = await getGlobalLeaderboard();
  const players = (res.success ? res.data : []) as LeaderboardPlayer[];
  const podium = players.slice(0, 3);

  return (
    <main className="velox-page">
      <header>
        <p className="velox-eyebrow">Season 04 · Global</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">Rankings</h1>
      </header>

      {podium.length ? (
        <section className="velox-card mt-8 grid min-h-60 grid-cols-3 items-end gap-2 overflow-hidden p-4 sm:gap-4 sm:p-6" aria-label="Top players">
          <PodiumPlayer player={podium[1]} place={2} />
          <PodiumPlayer player={podium[0]} place={1} />
          <PodiumPlayer player={podium[2]} place={3} />
        </section>
      ) : (
        <div className="velox-card mt-8 p-9 text-center"><Trophy className="mx-auto h-11 w-11 text-[#536053]" aria-hidden /><h2 className="mt-3 font-black text-white">The board is waiting</h2><p className="mt-1 text-sm text-[#8e998f]">Complete matches to set the first VELOX rankings.</p></div>
      )}

      <div className="mt-8 flex rounded-2xl bg-[#111811] p-1.5" role="presentation">
        <span className="flex-1 rounded-xl bg-[#c5f94d] px-4 py-3 text-center text-sm font-black text-[#090d09]">Players</span>
        <span className="flex-1 px-4 py-3 text-center text-sm font-black text-[#7f897f]">Global XP</span>
      </div>

      <section className="mt-5 overflow-hidden border-t border-[#2a352b]">
        {players.map((player, index) => <PlayerRow key={player.id} player={player} position={index + 1} />)}
      </section>
    </main>
  );
}

function PodiumPlayer({ player, place }: { player: LeaderboardPlayer | undefined; place: 1 | 2 | 3 }) {
  const name = player ? playerName(player) : "—";
  const isWinner = place === 1;
  const height = place === 1 ? "min-h-40" : place === 2 ? "min-h-32" : "min-h-28";

  return (
    <div className={`flex min-w-0 flex-col items-center text-center ${place === 1 ? "order-2" : place === 2 ? "order-1" : "order-3"}`}>
      {isWinner ? <Crown className="mb-1 h-6 w-6 text-[#c5f94d]" aria-hidden /> : <span className="mb-7 text-[10px] font-black tracking-[0.12em] text-[#8e998f]">RANK {String(place).padStart(2, "0")}</span>}
      <PlayerAvatar
        player={player}
        className={`${isWinner ? "h-20 w-20 border-2 border-[#d9ff82] bg-[#c5f94d] text-[#090d09]" : "h-14 w-14 border border-[#344235] bg-[#1a231b] text-white"} text-xl shadow-[0_12px_25px_rgba(0,0,0,0.2)]`}
      />
      <div className={`mt-3 flex w-full ${height} flex-col items-center justify-center rounded-t-2xl border border-b-0 border-[#2a352b] px-1 ${isWinner ? "bg-[#192917]" : "bg-[#121912]"}`}>
        <p className="w-full truncate text-sm font-black text-white">{name}</p>
        <p className="mt-1 text-base font-black text-[#c5f94d]">{player?.xp.toLocaleString() ?? "—"}</p>
        <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#899489]">Rank {String(place).padStart(2, "0")}</p>
      </div>
    </div>
  );
}

function PlayerRow({ player, position }: { player: LeaderboardPlayer; position: number }) {
  const name = playerName(player);
  const active = position <= 3;
  return (
    <article className="flex items-center gap-3 border-b border-[#2a352b] py-4 sm:px-2">
      <span className={`w-7 text-xs font-black ${active ? "text-[#c5f94d]" : "text-[#7f897f]"}`}>{String(position).padStart(2, "0")}</span>
      <PlayerAvatar
        player={player}
        className={`h-12 w-12 shrink-0 text-sm ${active ? "border border-[#d9ff82] bg-[#c5f94d] text-[#090d09]" : "border border-[#2d3c2f] bg-[#182019] text-[#dce3d6]"}`}
      />
      <div className="min-w-0 flex-1"><h2 className="truncate font-black text-white">{name}</h2><p className="mt-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">{player.rank} division</p></div>
      <div className="text-right"><p className="text-base font-black text-white">{player.xp.toLocaleString()}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#8e998f]">XP</p></div>
    </article>
  );
}

function playerName(player: LeaderboardPlayer) {
  return player.veloxUsername || player.user.username || player.user.firstName || "Player";
}

function PlayerAvatar({ player, className }: { player: LeaderboardPlayer | undefined; className: string }) {
  const name = player ? playerName(player) : "—";
  const imageUrl = player?.user.profileImage;

  return (
    <div className={`grid place-items-center overflow-hidden rounded-2xl font-black ${className}`}>
      {imageUrl ? <img src={imageUrl} alt={`${name} profile`} className="h-full w-full object-cover" /> : name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}
