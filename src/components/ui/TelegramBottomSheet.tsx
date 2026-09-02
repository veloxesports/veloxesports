"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export type TelegramBottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
  maxHeightClass?: string;
  className?: string;
  showDragHandle?: boolean;
};

const emptySubscribe = () => () => {};

export function TelegramBottomSheet({
  isOpen,
  onClose,
  title,
  children,
  maxWidthClass = "max-w-lg",
  maxHeightClass = "max-h-[min(72dvh,calc(var(--tg-viewport-stable-height,100dvh)-12.5rem))]",
  className = "",
  showDragHandle = true,
}: TelegramBottomSheetProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Manage body scroll, global modalOpen state, and ESC key
  useEffect(() => {
    if (!isOpen) return;

    document.body.dataset.modalOpen = "true";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      delete document.body.dataset.modalOpen;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[80] flex flex-col justify-end p-3 pb-[calc(5.75rem+max(12px,env(safe-area-inset-bottom,0px)))] sm:pb-28 sm:items-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      style={{ minHeight: "var(--tg-viewport-stable-height, 100dvh)" }}
      onClick={onClose}
    >
      <div
        className={`flex w-full ${maxWidthClass} ${maxHeightClass} flex-col rounded-[22px] sm:rounded-[24px] border border-[#2e422f] bg-[#0c130e] shadow-[0_16px_48px_rgba(0,0,0,0.95)] animate-in slide-in-from-bottom-5 duration-200 overflow-hidden ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        {showDragHandle && (
          <div
            className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-[#273729]"
            aria-hidden
          />
        )}

        {children}
      </div>
    </div>
  );

  return mounted && typeof document !== "undefined"
    ? createPortal(content, document.body)
    : content;
}
