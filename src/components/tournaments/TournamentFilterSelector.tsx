"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";

export type FilterOption = {
  value: string;
  label: string;
};

export type TournamentFilterSelectorProps = {
  label: string;
  title: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
};

const emptySubscribe = () => () => {};

export function TournamentFilterSelector({
  label,
  title,
  value,
  onChange,
  options,
}: TournamentFilterSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Find currently selected option
  const selectedOption = options.find((opt) => opt.value === value) || options[0];
  const isFiltered = value !== "all";

  // Manage body scroll, modalOpen state, and ESC key
  useEffect(() => {
    if (!isOpen) return;

    document.body.dataset.modalOpen = "true";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      delete document.body.dataset.modalOpen;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const triggerHaptic = () => {
    try {
      if (typeof window !== "undefined" && window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
      }
    } catch {
      // Ignore in browser
    }
  };

  const handleSelect = (optionValue: string) => {
    triggerHaptic();
    onChange(optionValue);
    setIsOpen(false);
  };

  const handleOpen = () => {
    try {
      if (typeof window !== "undefined" && window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred("light");
      }
    } catch {
      // Ignore
    }
    setIsOpen(true);
  };

  const modalContent = isOpen ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[80] flex flex-col justify-end p-3 pb-[calc(5.75rem+max(12px,env(safe-area-inset-bottom,0px)))] sm:pb-28 sm:items-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      style={{ minHeight: "var(--tg-viewport-stable-height, 100dvh)" }}
      onClick={() => setIsOpen(false)}
    >
      <div
        className="flex max-h-[min(65dvh,calc(var(--tg-viewport-stable-height,100dvh)-13rem))] w-full max-w-lg flex-col rounded-[22px] border border-[#2e422f] bg-[#0c130e] shadow-[0_16px_48px_rgba(0,0,0,0.95)] animate-in slide-in-from-bottom-5 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-[#273729]" aria-hidden />

        {/* Sheet Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#1f2d21] px-5 py-3.5">
          <div>
            <h3 className="text-base font-black text-white">{title}</h3>
            <p className="text-[11px] font-semibold text-[#7c8e7e]">
              {options.length} {options.length === 1 ? "option" : "options"} available
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-xl border border-[#233124] bg-[#121a13] text-[#869687] transition hover:bg-[#1a251b] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Options List */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-2.5 pb-3 space-y-1.5">
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`flex w-full min-h-[48px] items-center justify-between rounded-xl px-4 py-3 text-left transition active:scale-[0.99] ${
                  isSelected
                    ? "border border-[#3d5934] bg-[#162417] text-white shadow-[0_2px_12px_rgba(197,249,77,0.12)]"
                    : "border border-[#1e2a1f] bg-[#0e1610] text-[#b5c5b5] hover:border-[#2a3c2c] hover:bg-[#121c13]"
                }`}
              >
                <span
                  className={`text-sm tracking-tight ${
                    isSelected ? "font-black text-white" : "font-semibold"
                  }`}
                >
                  {option.label}
                </span>

                {isSelected ? (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#c5f94d] text-[#090d09] shadow-[0_0_10px_rgba(197,249,77,0.5)]">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                ) : (
                  <span className="h-5 w-5 rounded-full border border-[#2b3a2c]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Compact Trigger Button */}
      <button
        type="button"
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`${label}: ${selectedOption?.label ?? label}`}
        className={`group relative flex h-10 w-full min-w-0 items-center justify-between rounded-xl border px-2.5 text-left transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#c5f94d] ${
          isFiltered
            ? "border-[#3e5934] bg-[#121c13] text-[#c5f94d] shadow-[0_0_10px_rgba(197,249,77,0.15)]"
            : "border-[#233124] bg-[#0d140e] text-[#c8d4c6] hover:border-[#384c39] hover:bg-[#101911]"
        }`}
      >
        <span className="truncate text-[11px] font-bold tracking-tight">
          {selectedOption?.label ?? label}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#c5f94d]" : isFiltered ? "text-[#c5f94d]" : "text-[#798a7a]"
          }`}
          aria-hidden
        />
      </button>

      {/* Render via Portal directly onto document.body */}
      {mounted && typeof document !== "undefined"
        ? createPortal(modalContent, document.body)
        : modalContent}
    </>
  );
}

