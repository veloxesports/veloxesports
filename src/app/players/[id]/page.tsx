import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, UserX } from "lucide-react";
import { getHeadToHeadRecord, getPublicPlayerProfile } from "@/features/players/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PublicProfileView } from "@/components/players/PublicProfileView";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const res = await getPublicPlayerProfile(id);
  if (!res.success || !res.data) {
    return {
      title: "Player Profile Not Found | VELOX",
    };
  }

  const p = res.data;
  return {
    title: `${p.displayName} (@${p.telegramUsername || p.veloxUsername || "player"}) | VELOX`,
    description: `View ${p.displayName}'s rank (${p.rank}), tournament statistics, and match history on VELOX.`,
  };
}

export default async function PlayerProfilePage({ params }: PageProps) {
  const { id } = await params;
  const [profileRes, viewer] = await Promise.all([
    getPublicPlayerProfile(id),
    getCurrentUser(),
  ]);

  if (!profileRes.success || !profileRes.data) {
    return (
      <main className="velox-page">
        <div className="mb-4">
          <Link
            href="/players"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#869985] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Player Search</span>
          </Link>
        </div>

        <div className="velox-card flex flex-col items-center justify-center p-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[#2b3d2b] bg-[#121c13] text-[#718570]">
            <UserX className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-base font-black text-white">Player Not Found</h2>
          <p className="mt-1 text-xs text-[#879986] max-w-xs">
            We couldn&apos;t find a player with the identifier &ldquo;{id}&rdquo;. They may have changed their username or the profile does not exist.
          </p>
          <Link
            href="/players"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#c5f94d] px-4 py-2 text-xs font-black text-[#080d09]"
          >
            Browse All Competitors
          </Link>
        </div>
      </main>
    );
  }

  const profile = profileRes.data;
  const isViewerProfile = Boolean(viewer?.id && viewer.id === profile.id);

  let headToHead = null;
  if (!isViewerProfile && viewer?.id) {
    const h2hRes = await getHeadToHeadRecord(profile.id, viewer.id);
    if (h2hRes.success) {
      headToHead = h2hRes.data;
    }
  }

  return (
    <main className="velox-page">
      {/* Back to search navigation */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/players"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#869985] hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Player Search</span>
        </Link>
      </div>

      <PublicProfileView
        profile={profile}
        headToHead={headToHead}
        isViewerProfile={isViewerProfile}
      />
    </main>
  );
}
