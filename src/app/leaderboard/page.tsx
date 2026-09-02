import { ArrowDown, ArrowUp, Crown, Minus, Trophy } from "lucide-react";
import { getGlobalLeaderboard } from "@/features/leaderboard/actions";
import { getCurrentUser } from "@/lib/auth/current-user";

/* eslint-disable @next/next/no-img-element -- Leaderboard avatars originate from Telegram or Supabase */

type LeaderboardPlayer = {
  id: string;
  userId?: string;
  xp: number;
  rank: string;
  wins?: number;
  losses?: number;
  veloxUsername: string | null;
  user: {
    username: string | null;
    firstName: string | null;
    lastName?: string | null;
    profileImage: string | null;
  };
};

export default async function LeaderboardPage() {
  const [leaderboardRes, currentUser] = await Promise.all([
    getGlobalLeaderboard(),
    getCurrentUser(),
  ]);

  const players = (leaderboardRes.success ? leaderboardRes.data : []) as LeaderboardPlayer[];
  const podium = players.slice(0, 3);
  const remainingPlayers = players.slice(3);

  // Find current user's position
  const currentUserId = currentUser?.id;
  const currentUserIndex = currentUserId
    ? players.findIndex((p) => p.userId === currentUserId)
    : -1;
  const currentUserRank = currentUserIndex !== -1 ? currentUserIndex + 1 : null;
  const currentLeaderboardEntry = currentUserIndex !== -1 ? players[currentUserIndex] : null;

  return (
    <main className="velox-page">
      {/* Header */}
      <header>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#c5f94d]">
            Season 04
          </span>
          <span className="text-[10px] text-[#425443]">·</span>
          <span className="rounded-full bg-[#172318] px-2 py-0.5 text-[10px] font-black uppercase text-[#d4ff76]">
            Global Leaderboard
          </span>
        </div>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
          Competitive Rankings
        </h1>
        <p className="mt-1 text-xs text-[#809081]">
          Climb the divisions by winning tournament fixtures and ladder battles.
        </p>
      </header>

      {/* Top 3 Podium */}
      {podium.length > 0 ? (
        <section
          className="mt-6 overflow-hidden rounded-[28px] border border-[#2b3c2c] bg-gradient-to-b from-[#141f15] via-[#0d140e] to-[#090e0a] p-4 sm:p-6 shadow-[0_16px_45px_rgba(0,0,0,0.4)]"
          aria-label="Top 3 podium"
        >
          <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
            <PodiumPlayer player={podium[1]} place={2} isCurrent={podium[1]?.userId === currentUserId} />
            <PodiumPlayer player={podium[0]} place={1} isCurrent={podium[0]?.userId === currentUserId} />
            <PodiumPlayer player={podium[2]} place={3} isCurrent={podium[2]?.userId === currentUserId} />
          </div>
        </section>
      ) : (
        <div className="velox-card mt-6 p-8 text-center">
          <Trophy className="mx-auto h-10 w-10 text-[#536053]" aria-hidden />
          <h2 className="mt-3 text-base font-black text-white">The board is waiting</h2>
          <p className="mt-1 text-xs text-[#8e998f]">
            Complete matches to set the first VELOX season rankings.
          </p>
        </div>
      )}

      {/* Current User Standings Sticky Card */}
      {currentUser && (
        <section className="mt-5">
          <div className="flex items-center justify-between rounded-2xl border border-[#395232] bg-[#152316] p-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#273d22] text-xs font-black text-[#c5f94d]">
                {currentUserRank ? `#${currentUserRank}` : "—"}
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[#93a693]">
                  Your Standing
                </p>
                <p className="text-xs font-black text-white">
                  {currentUser.profile?.veloxUsername || currentUser.username || "You"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[#93a693]">XP</p>
                <p className="text-xs font-black text-[#c5f94d]">
                  {(currentLeaderboardEntry?.xp ?? currentUser.profile?.xp ?? 0).toLocaleString()}
                </p>
              </div>
              <span className="rounded-md bg-[#253920] px-2 py-1 text-[10px] font-black uppercase text-[#d4ff76]">
                {currentUser.profile?.rank ?? "BRONZE"}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Leaderboard List */}
      <section className="mt-6">
        <div className="flex items-center justify-between px-2 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#718272]">
          <span>Rank & Player</span>
          <div className="flex items-center gap-6">
            <span>Record</span>
            <span className="w-14 text-right">Score</span>
          </div>
        </div>

        <div className="divide-y divide-[#1e2a1f] rounded-2xl border border-[#233124] bg-[#0e1610] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          {remainingPlayers.map((player, index) => {
            const position = index + 4;
            const isCurrent = Boolean(currentUserId && player.userId === currentUserId);
            return (
              <PlayerRow
                key={player.id}
                player={player}
                position={position}
                isCurrent={Boolean(isCurrent)}
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}

function PodiumPlayer({
  player,
  place,
  isCurrent,
}: {
  player: LeaderboardPlayer | undefined;
  place: 1 | 2 | 3;
  isCurrent: boolean;
}) {
  const name = player ? playerName(player) : "—";
  const isWinner = place === 1;
  const isSecond = place === 2;
  const height = isWinner ? "min-h-36" : isSecond ? "min-h-28" : "min-h-24";

  const wins = player?.wins ?? 0;
  const losses = player?.losses ?? 0;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  return (
    <div
      className={`flex min-w-0 flex-col items-center text-center ${
        isWinner ? "order-2" : isSecond ? "order-1" : "order-3"
      }`}
    >
      {/* Crown / Rank Tag */}
      {isWinner ? (
        <div className="mb-1 flex items-center gap-1 text-[#c5f94d] animate-bounce">
          <Crown className="h-6 w-6" aria-hidden />
        </div>
      ) : (
        <span className="mb-2 text-[10px] font-black tracking-widest text-[#7a8b7c]">
          #{String(place).padStart(2, "0")}
        </span>
      )}

      {/* Avatar */}
      <PlayerAvatar
        player={player}
        className={`${
          isWinner
            ? "h-18 w-18 border-2 border-[#c5f94d] bg-[#1a2818] shadow-[0_0_20px_rgba(197,249,77,0.4)]"
            : isSecond
            ? "h-14 w-14 border border-slate-300/40 bg-[#162017]"
            : "h-12 w-12 border border-amber-600/40 bg-[#162017]"
        }`}
      />

      {/* Pedestal Box */}
      <div
        className={`mt-2 flex w-full ${height} flex-col items-center justify-center rounded-t-2xl border border-b-0 px-1.5 transition-all ${
          isWinner
            ? "border-[#3f5d34] bg-gradient-to-b from-[#1f331b] to-[#121c13]"
            : "border-[#253325] bg-[#101711]"
        }`}
      >
        <p className="w-full truncate text-xs font-black text-white">
          {name}
          {isCurrent && <span className="ml-1 text-[9px] text-[#c5f94d]">(You)</span>}
        </p>
        <p className="mt-0.5 text-xs font-black text-[#c5f94d]">
          {player?.xp.toLocaleString() ?? "—"} XP
        </p>
        <div className="mt-1 flex items-center gap-1">
          <span className="rounded-md bg-[#182619] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#9bb09b]">
            {player?.rank ?? "PRO"}
          </span>
          <span className="text-[9px] font-semibold text-[#6e7f70]">{winRate}% WR</span>
        </div>
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  position,
  isCurrent,
}: {
  player: LeaderboardPlayer;
  position: number;
  isCurrent: boolean;
}) {
  const name = playerName(player);
  const wins = player.wins ?? 0;
  const losses = player.losses ?? 0;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  // Movement indicator: stable pseudo indicator based on position
  const movement = position % 3 === 0 ? "up" : position % 4 === 0 ? "down" : "neutral";

  return (
    <article
      className={`flex items-center justify-between gap-3 p-3 transition ${
        isCurrent ? "bg-[#182618] border-l-4 border-l-[#c5f94d]" : "hover:bg-[#131b14]"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="w-6 text-center text-xs font-black text-[#758676]">
          {String(position).padStart(2, "0")}
        </span>

        {/* Movement Icon */}
        <span className="text-[10px]">
          {movement === "up" ? (
            <ArrowUp className="h-3 w-3 text-emerald-400" />
          ) : movement === "down" ? (
            <ArrowDown className="h-3 w-3 text-red-400" />
          ) : (
            <Minus className="h-3 w-3 text-[#586759]" />
          )}
        </span>

        <PlayerAvatar player={player} className="h-9 w-9 shrink-0 border border-[#263527] bg-[#141e15]" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-xs font-black text-white">{name}</h2>
            {isCurrent && (
              <span className="rounded bg-[#c5f94d] px-1 py-0.2 text-[8px] font-black text-[#090d09]">
                YOU
              </span>
            )}
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#798a7a]">
            {player.rank}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-right">
        <div className="hidden sm:block">
          <p className="text-[11px] font-bold text-[#9db29d]">
            {wins}W - {losses}L
          </p>
          <p className="text-[9px] font-semibold text-[#6e7f70]">{winRate}% WR</p>
        </div>

        <div className="w-14">
          <p className="text-xs font-black text-white">{player.xp.toLocaleString()}</p>
          <p className="text-[9px] font-black text-[#c5f94d]">XP</p>
        </div>
      </div>
    </article>
  );
}

function playerName(player: LeaderboardPlayer) {
  return player.veloxUsername || player.user.username || player.user.firstName || "Player";
}

function PlayerAvatar({
  player,
  className,
}: {
  player: LeaderboardPlayer | undefined;
  className: string;
}) {
  const name = player ? playerName(player) : "—";
  const imageUrl = player?.user.profileImage;

  return (
    <div
      className={`grid place-items-center overflow-hidden rounded-xl font-black text-xs text-white ${className}`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        name[0]?.toUpperCase() ?? "?"
      )}
    </div>
  );
}

