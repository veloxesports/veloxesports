import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const metadata: Metadata = {
  title: "Welcome to VELOX | How It Works",
  description: "Learn how to discover, join, and compete in esports tournaments on VELOX.",
};

export const viewport: Viewport = {
  themeColor: "#080d09",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

function OnboardingFallback() {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-[#080d09] text-[#c5f94d]">
      <div className="flex flex-col items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-[#c5f94d] bg-[#111912] shadow-[0_0_20px_rgba(197,249,77,0.3)] animate-pulse">
          <span className="text-base font-black text-white">V</span>
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-[#728570]">
          Loading Velox...
        </span>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingFlow />
    </Suspense>
  );
}
