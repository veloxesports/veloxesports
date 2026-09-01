export type CheckInWindowPhase = "NOT_STARTED" | "OPEN" | "CLOSED";

export type CheckInWindow = {
  opensAt: Date;
  closesAt: Date;
  phase: CheckInWindowPhase;
};

const MIN_CHECK_IN_PERIOD_MINUTES = 5;

export function getCheckInWindow(
  startDate: Date,
  checkInPeriodMins: number,
  now = new Date(),
): CheckInWindow {
  const safePeriodMins = Math.max(MIN_CHECK_IN_PERIOD_MINUTES, Math.floor(checkInPeriodMins));
  const closesAt = new Date(startDate);
  const opensAt = new Date(closesAt.getTime() - safePeriodMins * 60_000);

  if (now < opensAt) return { opensAt, closesAt, phase: "NOT_STARTED" };
  if (now >= closesAt) return { opensAt, closesAt, phase: "CLOSED" };
  return { opensAt, closesAt, phase: "OPEN" };
}

export function canCheckIn(status: string, startDate: Date, checkInPeriodMins: number, now = new Date()) {
  return status === "CHECK_IN" && getCheckInWindow(startDate, checkInPeriodMins, now).phase === "OPEN";
}
