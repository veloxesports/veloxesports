"use client";

/* eslint-disable @next/next/no-img-element -- Telegram and Supabase avatar URLs are intentionally rendered directly. */

import { useRef, useState, useTransition } from "react";
import { Camera, Check, LoaderCircle, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { uploadCurrentProfileImage } from "@/features/profile/actions";
import { PROFILE_IMAGE_ACCEPT, PROFILE_IMAGE_MAX_BYTES } from "@/lib/validation/profile-image";

type ProfileHeaderProps = {
  initialImageUrl: string | null;
  displayName: string;
  fallbackInitial: string;
  rank: string;
  level: number;
};

export function ProfileHeader({ initialImageUrl, displayName, fallbackInitial, rank, level }: ProfileHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function selectImage() {
    inputRef.current?.click();
  }

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    if (!PROFILE_IMAGE_ACCEPT.split(",").includes(file.type) || file.size > PROFILE_IMAGE_MAX_BYTES) {
      setNotice("Choose a JPG, PNG, or WebP image smaller than 2 MB.");
      return;
    }

    setNotice(null);
    const formData = new FormData();
    formData.set("profileImage", file);
    startTransition(async () => {
      const result = await uploadCurrentProfileImage(formData);
      if (!result.success || !result.data) {
        setNotice(result.error ?? "We couldn't upload that image.");
        return;
      }
      setImageUrl(result.data.profileImage);
      setNotice("Profile image updated.");
    });
  }

  return (
    <section className="relative">
      {/* Stadium Banner */}
      <div className="relative h-44 overflow-hidden rounded-[28px] border border-[#2e422f] bg-gradient-to-r from-[#121c13] via-[#1a2c1b] to-[#0c140d] shadow-[0_20px_50px_rgba(0,0,0,0.35)] sm:h-52">
        <img src="/profile-esports-banner.svg" alt="" className="h-full w-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080d09] via-[#080d09]/30 to-transparent" />
        
        <div className="absolute bottom-4 left-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c5f94d]">
            VELOX Competitor
          </p>
          <p className="mt-0.5 text-lg font-black tracking-tight text-white sm:text-xl">
            Pro Circuit Season 04
          </p>
        </div>

        <Link
          href="/settings"
          aria-label="Open settings"
          className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-[#080d09]/75 text-[#c8d4c7] backdrop-blur transition hover:border-[#c5f94d] hover:text-[#c5f94d]"
        >
          <Settings className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {/* Avatar & Player Identity */}
      <div className="relative -mt-14 flex flex-col items-center px-4 text-center">
        <div className="relative">
          <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full border-4 border-[#c5f94d] bg-[#111811] shadow-[0_0_30px_rgba(197,249,77,0.3)] sm:h-32 sm:w-32">
            {imageUrl ? (
              <img src={imageUrl} alt={`${displayName} profile`} className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-black text-white">{fallbackInitial}</span>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={PROFILE_IMAGE_ACCEPT}
            onChange={handleImageChange}
            className="sr-only"
            tabIndex={-1}
          />
          <button
            type="button"
            onClick={selectImage}
            disabled={isPending}
            className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-2xl border-2 border-[#080d09] bg-[#c5f94d] text-[#091009] shadow-lg transition hover:bg-[#d5ff70] disabled:cursor-not-allowed disabled:opacity-70"
            aria-label="Upload profile image"
          >
            {isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Camera className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={selectImage}
          disabled={isPending}
          className="mt-2.5 text-[11px] font-bold text-[#c5f94d] hover:text-[#d5ff70] disabled:opacity-60"
        >
          {isPending ? "Uploading image…" : "Change profile image"}
        </button>

        {notice && (
          <p
            role="status"
            className={`mt-1.5 flex items-center gap-1 text-xs font-semibold ${
              notice === "Profile image updated." ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {notice === "Profile image updated." && <Check className="h-3.5 w-3.5" aria-hidden />}
            {notice}
          </p>
        )}

        <div className="mt-2 flex items-center gap-1.5">
          <h1 className="text-2xl font-black text-white">{displayName}</h1>
          <ShieldCheck className="h-5 w-5 text-[#c5f94d]" aria-hidden />
        </div>

        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-full border border-[#3e5932] bg-[#1a2d18] px-2.5 py-0.5 text-[10px] font-black uppercase text-[#d4ff76]">
            {rank} Tier
          </span>
          <span className="text-xs font-semibold text-[#8a9b8b]">Level {level} Competitor</span>
        </div>
      </div>
    </section>
  );
}

