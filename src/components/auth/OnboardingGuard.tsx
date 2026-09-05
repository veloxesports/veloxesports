"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function OnboardingGuard() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const hasCompletedStorage =
        localStorage.getItem("khemora_onboarding_completed_v1") ||
        localStorage.getItem("velox_onboarding_completed_v1");
      const hasCompletedCookie =
        document.cookie.includes("khemora_onboarding_completed_v1=true") ||
        document.cookie.includes("velox_onboarding_completed_v1=true");

      if (!hasCompletedStorage && !hasCompletedCookie) {
        router.replace("/onboarding");
      }
    } catch {
      // In restricted webview / incognito environments where localStorage is blocked
    }
  }, [router]);

  return null;
}
