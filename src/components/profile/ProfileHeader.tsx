"use client";

/* eslint-disable @next/next/no-img-element -- Telegram and Supabase avatar URLs are intentionally rendered directly. */

import { useRef, useState, useTransition } from "react";
import { Camera, Check, LoaderCircle, Settings } from "lucide-react";
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
      <div className="relative h-48 overflow-hidden rounded-[28px] border border-[#3c5435] bg-[#101811] shadow-[0_22px_50px_rgba(0,0,0,0.28)] sm:h-56">
        <img src="/profile-esports-banner.svg" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080d09] via-[#080d09]/15 to-transparent" />
        <div className="absolute bottom-5 left-5">
          <p className="velox-eyebrow text-[#d4ff76]">PLAYER PROFILE</p>
          <p className="mt-2 max-w-[12rem] text-xl font-black leading-tight text-white">Built for the next match.</p>
        </div>
        <Link href="/settings" aria-label="Open settings" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-[#080d09]/60 text-white backdrop-blur transition hover:border-[#c5f94d] hover:text-[#c5f94d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c5f94d]">
          <Settings className="h-5 w-5" aria-hidden />
        </Link>
      </div>

      <div className="relative -mt-16 flex flex-col items-center px-4 text-center">
        <div className="relative">
          <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-[#c5f94d] bg-[#111811] text-gray-500 shadow-[0_0_30px_rgba(197,249,77,0.25)]">
            {imageUrl ? (
              <img src={imageUrl} alt={`${displayName} profile`} className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl font-black text-white">{fallbackInitial}</span>
            )}
          </div>
          <input ref={inputRef} type="file" accept={PROFILE_IMAGE_ACCEPT} onChange={handleImageChange} className="sr-only" tabIndex={-1} />
          <button
            type="button"
            onClick={selectImage}
            disabled={isPending}
            className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-[#080d09] bg-[#c5f94d] text-[#091009] shadow-lg transition hover:bg-[#d5ff70] disabled:cursor-not-allowed disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c5f94d]"
            aria-label="Upload profile image"
          >
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
          </button>
        </div>

        <button type="button" onClick={selectImage} disabled={isPending} className="mt-3 text-xs font-bold text-[#c5f94d] transition hover:text-[#d5ff70] disabled:cursor-not-allowed disabled:opacity-70">
          {isPending ? "Uploading image…" : "Change profile image"}
        </button>
        <p className="mt-1 text-[11px] text-[#93a293]">JPG, PNG, or WebP · up to 2 MB</p>
        {notice && (
          <p role="status" className={`mt-2 flex items-center gap-1 text-xs font-semibold ${notice === "Profile image updated." ? "text-emerald-300" : "text-red-300"}`}>
            {notice === "Profile image updated." && <Check className="h-3.5 w-3.5" aria-hidden />}
            {notice}
          </p>
        )}

        <h1 className="mt-3 text-2xl font-black text-white">{displayName}</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-full border border-[#4f703c] bg-[#263c1c] px-2 py-0.5 text-xs font-bold uppercase text-[#d4ff76]">{rank}</span>
          <span className="text-sm font-medium text-gray-400">Level {level}</span>
        </div>
      </div>
    </section>
  );
}
