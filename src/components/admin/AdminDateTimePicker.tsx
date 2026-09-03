"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  X,
} from "lucide-react";

export type AdminDateTimePickerProps = {
  name: string;
  label?: string;
  defaultValue?: Date | string | null;
  value?: Date | string | null;
  onChange?: (date: Date | null) => void;
  error?: string;
  required?: boolean;
  minDate?: Date;
  placeholder?: string;
  helperText?: string;
  disabled?: boolean;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const COMMON_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function parseInitialDate(val?: Date | string | null): Date | null {
  if (!val) return null;
  const d = typeof val === "string" ? new Date(val) : val;
  return Number.isNaN(d.getTime()) ? null : d;
}

export function AdminDateTimePicker({
  name,
  label,
  defaultValue,
  value: controlledValue,
  onChange,
  error,
  required,
  minDate,
  placeholder = "Choose date and time...",
  helperText = "Choose a date and time with the calendar picker.",
  disabled = false,
}: AdminDateTimePickerProps) {
  const isControlled = controlledValue !== undefined;
  const initial = parseInitialDate(isControlled ? controlledValue : defaultValue);

  // Selected date state (supports both controlled and uncontrolled usage)
  const [uncontrolledDate, setUncontrolledDate] = useState<Date | null>(() => parseInitialDate(defaultValue));
  const selectedDate = isControlled ? parseInitialDate(controlledValue) : uncontrolledDate;

  const updateSelectedDate = useCallback(
    (newDate: Date | null) => {
      if (!isControlled) {
        setUncontrolledDate(newDate);
      }
      if (onChange) {
        onChange(newDate);
      }
    },
    [isControlled, onChange]
  );

  // Calendar display state
  const [viewYear, setViewYear] = useState(() => (initial ? initial.getFullYear() : new Date().getFullYear()));
  const [viewMonth, setViewMonth] = useState(() => (initial ? initial.getMonth() : new Date().getMonth()));

  // Time picker state
  const [hour12, setHour12] = useState<number>(() => {
    if (!initial) return 12;
    const h = initial.getHours() % 12;
    return h === 0 ? 12 : h;
  });
  const [minute, setMinute] = useState<number>(() => (initial ? initial.getMinutes() : 0));
  const [period, setPeriod] = useState<"AM" | "PM">(() => (initial && initial.getHours() >= 12 ? "PM" : "AM"));

  // Open / Close Popover
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<"date" | "time">("date");
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; isUpwards: boolean }>({
    top: 0,
    left: 0,
    isUpwards: false,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 680);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Compute position relative to trigger
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || isMobile) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const pickerHeight = 440;
    const pickerWidth = 560;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpwards = spaceBelow < pickerHeight && spaceAbove > spaceBelow;

    const top = openUpwards ? Math.max(10, rect.top - pickerHeight - 8) : rect.bottom + 8;
    let left = rect.left;
    if (left + pickerWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - pickerWidth - 16);
    }

    setPopoverPos({ top, left, isUpwards: openUpwards });
  }, [isMobile]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const onScrollOrResize = () => updatePosition();
      window.addEventListener("scroll", onScrollOrResize, true);
      window.addEventListener("resize", onScrollOrResize);
      return () => {
        window.removeEventListener("scroll", onScrollOrResize, true);
        window.removeEventListener("resize", onScrollOrResize);
      };
    }
  }, [isOpen, updatePosition]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Sync internal view when popover opens
  function handleOpen() {
    if (disabled) return;
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
      const h = selectedDate.getHours() % 12;
      setHour12(h === 0 ? 12 : h);
      setMinute(selectedDate.getMinutes());
      setPeriod(selectedDate.getHours() >= 12 ? "PM" : "AM");
    } else {
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
      const h = now.getHours() % 12;
      setHour12(h === 0 ? 12 : h);
      setMinute(Math.ceil(now.getMinutes() / 5) * 5 % 60);
      setPeriod(now.getHours() >= 12 ? "PM" : "AM");
    }
    setIsOpen(true);
  }

  // Month navigation
  function handlePrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  // Construct final Date from year, month, day, hour12, minute, period
  function constructDate(year: number, month: number, day: number, h12: number, min: number, ampm: "AM" | "PM"): Date {
    let hours = h12 % 12;
    if (ampm === "PM") hours += 12;
    return new Date(year, month, day, hours, min, 0, 0);
  }

  function handleSelectDay(day: number) {
    const updated = constructDate(viewYear, viewMonth, day, hour12, minute, period);
    updateSelectedDate(updated);
  }

  function handleApplyTime(newHour: number, newMin: number, newPeriod: "AM" | "PM") {
    setHour12(newHour);
    setMinute(newMin);
    setPeriod(newPeriod);

    if (selectedDate) {
      const updated = constructDate(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        newHour,
        newMin,
        newPeriod
      );
      updateSelectedDate(updated);
    }
  }

  // Presets
  function applyPreset(presetType: "now" | "plus1h" | "tomorrow" | "plus1w") {
    const now = new Date();
    let target = new Date();

    if (presetType === "now") {
      target = new Date();
    } else if (presetType === "plus1h") {
      target = new Date(now.getTime() + 60 * 60 * 1000);
    } else if (presetType === "tomorrow") {
      target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 18, 0, 0);
    } else if (presetType === "plus1w") {
      target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 18, 0, 0);
    }

    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
    const h = target.getHours() % 12;
    setHour12(h === 0 ? 12 : h);
    setMinute(target.getMinutes());
    setPeriod(target.getHours() >= 12 ? "PM" : "AM");
    updateSelectedDate(target);
  }

  function handleClear(e?: ReactMouseEvent) {
    e?.stopPropagation();
    updateSelectedDate(null);
  }

  function handleClose() {
    setIsOpen(false);
  }

  // Calendar Day Grid Calculation
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayWeekday = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const today = new Date();
  const isCurrentMonthToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth;

  // Render trigger display text
  const formattedDisplay = selectedDate
    ? formatDateTimeDisplay(selectedDate)
    : "";

  // Hidden input value for form submission
  const formValue = selectedDate ? toLocalIso(selectedDate) : "";

  const errorId = `datetime-${name}-error`;

  return (
    <div className="relative grid gap-1.5 text-sm font-bold text-[#dce8d7]">
      {label && (
        <span className="flex items-center justify-between">
          <span>{label}</span>
          {required && <span className="text-[11px] font-black text-[#c5f94d]">* Required</span>}
        </span>
      )}

      {/* Hidden input to ensure standard HTML form serialization */}
      <input
        type="hidden"
        name={name}
        value={formValue}
        required={required}
      />

      {/* Custom Input Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-describedby={error ? errorId : undefined}
        className={`group relative flex w-full items-center justify-between rounded-2xl border bg-[#080d09] px-3.5 py-3 text-left text-sm text-white transition outline-none ${
          error
            ? "border-[#c76a56] focus:border-[#ff9e87] focus:ring-2 focus:ring-[#ff9e87]/20"
            : isOpen
            ? "border-[#c5f94d] ring-2 ring-[#c5f94d]/20 shadow-[0_0_20px_rgba(197,249,77,0.15)]"
            : "border-[#344335] hover:border-[#4d664e] focus:border-[#c5f94d] focus:ring-2 focus:ring-[#c5f94d]/15"
        } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[#142014] text-[#c5f94d] transition group-hover:bg-[#1d2d1d]">
            <CalendarDays className="h-4 w-4" aria-hidden />
          </span>
          {selectedDate ? (
            <span className="truncate font-black tracking-[-0.01em] text-white">
              {formattedDisplay}
            </span>
          ) : (
            <span className="truncate font-medium text-[#6f796f]">{placeholder}</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 pl-2 text-[#8e998f]">
          {selectedDate && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleClear();
              }}
              className="rounded-lg p-1 text-[#788877] transition hover:bg-[#1a251b] hover:text-white"
              title="Clear date"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180 text-[#c5f94d]" : "text-[#586b57]"}`}
            aria-hidden
          />
        </div>
      </button>

      {error ? (
        <span id={errorId} className="text-xs font-bold text-[#ffad9a]">
          {error}
        </span>
      ) : helperText ? (
        <span className="text-xs font-medium text-[#748173]">{helperText}</span>
      ) : null}

      {/* Render Portal Picker Popover */}
      {isOpen && typeof document !== "undefined" && createPortal(
        <>
          {/* Mobile backdrop */}
          {isMobile ? (
            <div
              className="fixed inset-0 z-[99] bg-[#020503]/85 backdrop-blur-[6px]"
              onClick={handleClose}
              aria-hidden
            />
          ) : null}

          <div
            ref={popoverRef}
            role="dialog"
            aria-modal="true"
            aria-label="Select date and time"
            style={
              isMobile
                ? {
                    position: "fixed",
                    bottom: "16px",
                    left: "12px",
                    right: "12px",
                    zIndex: 100,
                  }
                : {
                    position: "fixed",
                    top: `${popoverPos.top}px`,
                    left: `${popoverPos.left}px`,
                    zIndex: 100,
                    width: "560px",
                  }
            }
            className="overflow-hidden rounded-[24px] border border-[#3c5438] bg-[#0d140e] p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.85)] ring-1 ring-[#c5f94d]/20 backdrop-blur-xl sm:p-5"
          >
            {/* Quick Presets Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#233124] pb-3 text-xs">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#8e998f]">
                <Sparkles className="h-3.5 w-3.5 text-[#c5f94d]" />
                <span>Quick match presets:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => applyPreset("now")}
                  className="rounded-lg border border-[#273628] bg-[#121a13] px-2.5 py-1 text-[11px] font-bold text-[#c2d4bf] transition hover:border-[#48633c] hover:bg-[#1a261a] hover:text-[#c5f94d]"
                >
                  Now
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("plus1h")}
                  className="rounded-lg border border-[#273628] bg-[#121a13] px-2.5 py-1 text-[11px] font-bold text-[#c2d4bf] transition hover:border-[#48633c] hover:bg-[#1a261a] hover:text-[#c5f94d]"
                >
                  +1 Hour
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("tomorrow")}
                  className="rounded-lg border border-[#273628] bg-[#121a13] px-2.5 py-1 text-[11px] font-bold text-[#c2d4bf] transition hover:border-[#48633c] hover:bg-[#1a261a] hover:text-[#c5f94d]"
                >
                  Tomorrow 18:00
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("plus1w")}
                  className="rounded-lg border border-[#273628] bg-[#121a13] px-2.5 py-1 text-[11px] font-bold text-[#c2d4bf] transition hover:border-[#48633c] hover:bg-[#1a261a] hover:text-[#c5f94d]"
                >
                  In 1 Week
                </button>
              </div>
            </div>

            {/* Mobile Segmented Toggle (Date vs Time) */}
            {isMobile && (
              <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-[#273628] bg-[#121a13] p-1 text-xs font-black">
                <button
                  type="button"
                  onClick={() => setMobileTab("date")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition ${
                    mobileTab === "date"
                      ? "bg-[#c5f94d] text-[#0a0e0a] shadow-[0_2px_8px_rgba(197,249,77,0.3)]"
                      : "text-[#8e998f] hover:text-white"
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>
                    {selectedDate
                      ? selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "Select Date"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab("time")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition ${
                    mobileTab === "time"
                      ? "bg-[#c5f94d] text-[#0a0e0a] shadow-[0_2px_8px_rgba(197,249,77,0.3)]"
                      : "text-[#8e998f] hover:text-white"
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>{`${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`}</span>
                </button>
              </div>
            )}

            {/* Main Dual Panels: Calendar (Left) + Time (Right) */}
            <div className="mt-3.5 grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_1px_minmax(0,1.1fr)]">
              {/* Calendar Section */}
              <div className={`space-y-3 ${isMobile && mobileTab !== "date" ? "hidden" : "block"}`}>
                {/* Month / Year Navigation Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <select
                      value={viewMonth}
                      onChange={(e) => setViewMonth(Number(e.target.value))}
                      className="cursor-pointer rounded-xl border border-[#273628] bg-[#121a13] px-2.5 py-1.5 text-xs font-black text-white outline-none transition hover:border-[#48633c] focus:border-[#c5f94d]"
                    >
                      {MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx} className="bg-[#0e150f] text-white">
                          {m}
                        </option>
                      ))}
                    </select>

                    <select
                      value={viewYear}
                      onChange={(e) => setViewYear(Number(e.target.value))}
                      className="cursor-pointer rounded-xl border border-[#273628] bg-[#121a13] px-2.5 py-1.5 text-xs font-black text-white outline-none transition hover:border-[#48633c] focus:border-[#c5f94d]"
                    >
                      {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - 1 + i).map((yr) => (
                        <option key={yr} value={yr} className="bg-[#0e150f] text-white">
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="grid h-7 w-7 place-items-center rounded-xl border border-[#273628] bg-[#121a13] text-[#a4b5a2] transition hover:border-[#48633c] hover:bg-[#1a261a] hover:text-white"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="grid h-7 w-7 place-items-center rounded-xl border border-[#273628] bg-[#121a13] text-[#a4b5a2] transition hover:border-[#48633c] hover:bg-[#1a261a] hover:text-white"
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Weekdays Header */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-[0.1em] text-[#6b7d6a]">
                  {WEEKDAY_NAMES.map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar Days Matrix */}
                <div className="grid grid-cols-7 gap-1 text-xs">
                  {/* Days from previous month */}
                  {Array.from({ length: firstDayWeekday }).map((_, i) => {
                    const prevDayNum = daysInPrevMonth - firstDayWeekday + 1 + i;
                    return (
                      <div
                        key={`prev-${i}`}
                        className="grid h-8 place-items-center rounded-xl text-[11px] font-medium text-[#465345] opacity-40 select-none"
                      >
                        {prevDayNum}
                      </div>
                    );
                  })}

                  {/* Days in current month */}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const isSelected =
                      selectedDate &&
                      selectedDate.getFullYear() === viewYear &&
                      selectedDate.getMonth() === viewMonth &&
                      selectedDate.getDate() === day;

                    const isToday = isCurrentMonthToday && today.getDate() === day;

                    const dayDate = new Date(viewYear, viewMonth, day, 23, 59, 59);
                    const isDisabled = minDate && dayDate < minDate;

                    return (
                      <button
                        key={`curr-${day}`}
                        type="button"
                        disabled={Boolean(isDisabled)}
                        onClick={() => handleSelectDay(day)}
                        className={`group relative grid h-8 w-full place-items-center rounded-xl font-bold transition ${
                          isSelected
                            ? "bg-[#c5f94d] text-[#0a0e0a] font-black shadow-[0_0_15px_rgba(197,249,77,0.5)] ring-2 ring-[#c5f94d]"
                            : isToday
                            ? "border border-[#55783e] bg-[#162316] text-[#e8ffd0] hover:bg-[#203320]"
                            : isDisabled
                            ? "text-[#475446] opacity-35 cursor-not-allowed"
                            : "text-[#c2d4bf] hover:bg-[#1a271b] hover:text-white"
                        }`}
                      >
                        <span>{day}</span>
                        {isToday && !isSelected && (
                          <span
                            className="absolute bottom-1 h-1 w-1 rounded-full bg-[#c5f94d]"
                            aria-hidden
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vertical divider */}
              <div className="hidden bg-[#243325] sm:block" aria-hidden />

              {/* Time Section */}
              <div className={`flex flex-col justify-between space-y-3 pt-2 sm:pt-0 ${isMobile && mobileTab !== "time" ? "hidden sm:flex" : "flex"}`}>
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-black uppercase tracking-[0.08em] text-[#8e998f]">
                      <Clock className="h-3.5 w-3.5 text-[#c5f94d]" />
                      <span>Kickoff time</span>
                    </span>
                    {/* AM / PM Toggle */}
                    <div className="flex items-center rounded-xl border border-[#273628] bg-[#121a13] p-0.5 text-xs font-black">
                      <button
                        type="button"
                        onClick={() => handleApplyTime(hour12, minute, "AM")}
                        className={`rounded-lg px-2.5 py-1 transition ${
                          period === "AM"
                            ? "bg-[#c5f94d] text-[#0a0e0a] shadow-[0_2px_8px_rgba(197,249,77,0.3)]"
                            : "text-[#8e998f] hover:text-white"
                        }`}
                      >
                        AM
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyTime(hour12, minute, "PM")}
                        className={`rounded-lg px-2.5 py-1 transition ${
                          period === "PM"
                            ? "bg-[#c5f94d] text-[#0a0e0a] shadow-[0_2px_8px_rgba(197,249,77,0.3)]"
                            : "text-[#8e998f] hover:text-white"
                        }`}
                      >
                        PM
                      </button>
                    </div>
                  </div>

                  {/* Digital Clock Readout Display */}
                  <div className="mt-2.5 flex items-center justify-center gap-2 rounded-2xl border border-[#2c3d2c] bg-[#111911] py-2.5 shadow-inner">
                    <span className="font-mono text-2xl font-black text-white">
                      {String(hour12).padStart(2, "0")}
                    </span>
                    <span className="font-mono text-xl font-bold text-[#c5f94d] animate-pulse">:</span>
                    <span className="font-mono text-2xl font-black text-white">
                      {String(minute).padStart(2, "0")}
                    </span>
                    <span className="ml-1 rounded-md bg-[#1f311c] px-2 py-0.5 text-xs font-black text-[#c5f94d]">
                      {period}
                    </span>
                  </div>

                  {/* Hour Selection Grid */}
                  <div className="mt-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#6b7d6a]">
                      Hour (1–12)
                    </span>
                    <div className="mt-1.5 grid grid-cols-6 gap-1 text-xs">
                      {HOURS_12.map((h) => (
                        <button
                          key={`hour-${h}`}
                          type="button"
                          onClick={() => handleApplyTime(h, minute, period)}
                          className={`grid h-7 place-items-center rounded-lg font-bold transition ${
                            hour12 === h
                              ? "bg-[#1f311c] text-[#c5f94d] border border-[#486b3e] shadow-[0_0_10px_rgba(197,249,77,0.2)]"
                              : "text-[#a2b5a0] hover:bg-[#182319] hover:text-white"
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Minute Selection Grid */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.1em] text-[#6b7d6a]">
                      <span>Minute</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-medium text-[#5c6e5b]">Custom:</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={minute}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(59, Number(e.target.value) || 0));
                            handleApplyTime(hour12, val, period);
                          }}
                          className="w-10 rounded border border-[#273628] bg-[#0c120d] px-1 py-0.5 text-center font-mono text-[11px] font-bold text-white outline-none focus:border-[#c5f94d]"
                        />
                      </div>
                    </div>
                    <div className="mt-1.5 grid grid-cols-6 gap-1 text-xs">
                      {COMMON_MINUTES.map((m) => (
                        <button
                          key={`min-${m}`}
                          type="button"
                          onClick={() => handleApplyTime(hour12, m, period)}
                          className={`grid h-7 place-items-center rounded-lg font-bold transition ${
                            minute === m
                              ? "bg-[#1f311c] text-[#c5f94d] border border-[#486b3e] shadow-[0_0_10px_rgba(197,249,77,0.2)]"
                              : "text-[#a2b5a0] hover:bg-[#182319] hover:text-white"
                          }`}
                        >
                          :{String(m).padStart(2, "0")}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Selected Preview Pill */}
                {selectedDate && (
                  <div className="rounded-xl border border-[#233124] bg-[#0a0f0a] px-3 py-2 text-[11px] text-[#9eb19a]">
                    <span className="text-[#6d7e6c]">Selected: </span>
                    <strong className="text-white">{formatDateTimeDisplay(selectedDate)}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Action Bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#233124] pt-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset("now")}
                  className="rounded-xl border border-[#273628] bg-[#121a13] px-3 py-2 font-bold text-[#b6c7b3] transition hover:bg-[#1a251a] hover:text-white"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-xl border border-[#273628] bg-transparent px-3 py-2 font-bold text-[#8e998f] transition hover:bg-[#1a251a] hover:text-[#ff9e87]"
                >
                  Clear
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl border border-[#273628] bg-transparent px-3.5 py-2 font-bold text-[#b6c7b3] transition hover:bg-[#1a251a] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#c5f94d] px-4 py-2 font-black text-[#0a0e0a] shadow-[0_6px_16px_rgba(197,249,77,0.25)] transition hover:bg-[#d5ff70]"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Apply date</span>
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function formatDateTimeDisplay(date: Date): string {
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dateStr} · ${timeStr}`;
}

function toLocalIso(date: Date): string {
  // Format as YYYY-MM-DDTHH:mm:ss for seamless parsing by new Date(...)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}
