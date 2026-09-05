"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronLeft, X } from "lucide-react";
import { Screen1Welcome } from "./screens/Screen1Welcome";
import { Screen2Discovery } from "./screens/Screen2Discovery";
import { Screen3Discord } from "./screens/Screen3Discord";
import { Screen4Squad } from "./screens/Screen4Squad";
import { Screen5CheckIn } from "./screens/Screen5CheckIn";
import { Screen6Matches } from "./screens/Screen6Matches";
import { Screen7StayUpdated } from "./screens/Screen7StayUpdated";
import { markOnboardingCompleted } from "@/features/profile/actions";

const TOTAL_SCREENS = 7;

export function OnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReplay = searchParams.get("replay") === "true";

  const [currentStep, setCurrentStep] = useState(0);

  // Swipe gesture tracking
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  const triggerHaptic = useCallback((type: "step" | "success" = "step") => {
    try {
      if (typeof window !== "undefined" && window.Telegram?.WebApp?.HapticFeedback) {
        if (type === "step") {
          window.Telegram.WebApp.HapticFeedback.selectionChanged();
        } else {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred("success");
        }
      }
    } catch {
      // Ignored if haptics unavailable
    }
  }, []);

  const handleFinish = useCallback(async () => {
    triggerHaptic("success");

    try {
      localStorage.setItem("khemora_onboarding_completed_v1", "true");
      document.cookie = "khemora_onboarding_completed_v1=true; path=/; max-age=31536000; SameSite=Lax";
    } catch {
      // Ignore storage errors in restricted webviews
    }

    // Attempt profile sync asynchronously
    void markOnboardingCompleted();

    if (isReplay) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [isReplay, router, triggerHaptic]);

  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_SCREENS - 1) {
      triggerHaptic("step");
      setCurrentStep((prev) => prev + 1);
    } else {
      void handleFinish();
    }
  }, [currentStep, handleFinish, triggerHaptic]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      triggerHaptic("step");
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep, triggerHaptic]);

  // Touch gesture listeners
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchEndXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null || touchEndXRef.current === null) return;
    const diffX = touchStartXRef.current - touchEndXRef.current;
    const SWIPE_THRESHOLD = 50;

    if (diffX > SWIPE_THRESHOLD) {
      // Swiped Left -> Next
      handleNext();
    } else if (diffX < -SWIPE_THRESHOLD) {
      // Swiped Right -> Back
      handleBack();
    }

    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  // Keyboard navigation for desktop accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handleBack();
      if (e.key === "Escape") void handleFinish();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handleBack, handleFinish]);

  const screens = [
    <Screen1Welcome key="step-1" />,
    <Screen2Discovery key="step-2" />,
    <Screen3Discord key="step-3" />,
    <Screen4Squad key="step-4" />,
    <Screen5CheckIn key="step-5" />,
    <Screen6Matches key="step-6" />,
    <Screen7StayUpdated key="step-7" />,
  ];

  const isFinalStep = currentStep === TOTAL_SCREENS - 1;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative flex h-[100dvh] w-full flex-col justify-between overflow-hidden bg-[#080d09] text-white pt-[max(12px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))] px-4 sm:px-6"
    >
      {/* Top Header Bar */}
      <header className="flex shrink-0 items-center justify-between gap-3 pt-2">
        {/* Brand indicator */}
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-xl border border-[#2e422f] bg-[#0c140e] shadow-[0_0_15px_rgba(197,249,77,0.3)]">
            <Image
              src="/images/khemora-logo.png"
              alt="Khemora Esports"
              fill
              className="object-contain p-1"
              priority
            />
          </div>
          <span className="text-sm font-black tracking-wider text-white">
            KHEMORA
          </span>
        </div>

        {/* Skip / Exit Button */}
        <button
          type="button"
          onClick={() => void handleFinish()}
          className="flex items-center gap-1 rounded-xl border border-[#273827] bg-[#101911]/90 px-3 py-1.5 text-xs font-black text-[#96ab93] transition hover:bg-[#18261a] hover:text-white active:scale-95"
          aria-label={isReplay ? "Close Guide" : "Skip Onboarding"}
        >
          {isReplay ? (
            <>
              <X className="h-3.5 w-3.5" />
              <span>Close</span>
            </>
          ) : (
            <span>Skip</span>
          )}
        </button>
      </header>

      {/* Progress Indicators: 7 Animated Bars */}
      <div className="mt-3 flex shrink-0 items-center gap-1.5 px-1" aria-label="Onboarding Progress">
        {Array.from({ length: TOTAL_SCREENS }).map((_, index) => {
          const isActive = index === currentStep;
          const isPassed = index < currentStep;

          return (
            <button
              key={`progress-${index}`}
              type="button"
              onClick={() => {
                triggerHaptic("step");
                setCurrentStep(index);
              }}
              title={`Jump to step ${index + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                isActive
                  ? "flex-1 bg-[#c5f94d] shadow-[0_0_12px_rgba(197,249,77,0.6)]"
                  : isPassed
                  ? "w-4 sm:w-6 bg-[#4c6347]"
                  : "w-2 sm:w-3 bg-[#1d281e]"
              }`}
            />
          );
        })}
      </div>

      {/* Active Screen Slide Canvas */}
      <main className="relative flex flex-1 w-full min-h-0 flex-col items-center justify-center overflow-hidden py-1">
        <div
          key={currentStep}
          className="flex h-full w-full max-w-md flex-col justify-between animate-in fade-in zoom-in-95 duration-300"
        >
          {screens[currentStep]}
        </div>
      </main>

      {/* Bottom Navigation Toolbar */}
      <footer className="shrink-0 pt-2 pb-1">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
          {/* Back Button (Hidden on First Screen) */}
          {currentStep > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#273827] bg-[#111c12] text-[#a1b59f] transition hover:bg-[#1a2b1b] hover:text-white active:scale-95"
              aria-label="Previous step"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="w-12 h-12" aria-hidden />
          )}

          {/* Primary Action Button: Next vs Get Started */}
          <button
            type="button"
            onClick={handleNext}
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl font-black text-sm transition-all active:scale-[0.98] ${
              isFinalStep
                ? "bg-gradient-to-r from-[#c5f94d] via-[#d5ff70] to-[#c5f94d] text-[#080d09] shadow-[0_0_25px_rgba(197,249,77,0.45)] hover:shadow-[0_0_35px_rgba(197,249,77,0.6)] animate-pulse"
                : "bg-[#c5f94d] text-[#080d09] shadow-[0_0_20px_rgba(197,249,77,0.3)] hover:bg-[#d5ff70]"
            }`}
          >
            <span>{isFinalStep ? (isReplay ? "Back to Khemora →" : "Get Started →") : "Next"}</span>
            {!isFinalStep && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>

        {/* Sub-label under CTA on final step */}
        {isFinalStep && (
          <p className="mt-2 text-center text-[11px] font-bold text-[#728570]">
            Your next tournament starts here.
          </p>
        )}
      </footer>
    </div>
  );
}
