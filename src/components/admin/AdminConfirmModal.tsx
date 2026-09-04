"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Info, LoaderCircle, X } from "lucide-react";

export type AdminConfirmModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export function AdminConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  pending = false,
  onConfirm,
  onClose,
}: AdminConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, pending, onClose]);

  if (!isOpen) return null;

  const isDanger = variant === "danger";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020503]/85 p-4 backdrop-blur-[6px]"
    >
      <div
        ref={dialogRef}
        className={`w-full max-w-md rounded-[24px] border p-6 shadow-[0_25px_80px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-150 ${
          isDanger
            ? "border-[#68372f] bg-[#140d0c]"
            : "border-[#384f33] bg-[#0d140e]"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                isDanger
                  ? "bg-[#351a17] text-[#ffad9a]"
                  : "bg-[#1c291c] text-[#c5f94d]"
              }`}
            >
              {isDanger ? (
                <AlertTriangle className="h-5 w-5" aria-hidden />
              ) : (
                <Info className="h-5 w-5" aria-hidden />
              )}
            </span>
            <div>
              <h2
                id="confirm-modal-title"
                className="text-lg font-black tracking-tight text-white"
              >
                {title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl p-1 text-[#8e998f] transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-[#b5c2b3]">
          {message}
        </p>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border border-[#344335] bg-[#0e1610] px-4 py-2.5 text-xs font-bold text-[#b5c2b3] transition hover:bg-[#152217] hover:text-white disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={pending}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black transition disabled:opacity-50 ${
              isDanger
                ? "border border-[#8a4237] bg-[#ffad9a] text-[#2b1411] hover:bg-[#ffbead]"
                : "border border-[#384f33] bg-[#c5f94d] text-[#090d09] hover:bg-[#d5ff70]"
            }`}
          >
            {pending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
