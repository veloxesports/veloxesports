export function splitPrizeAmount(amount: number, recipientIds: string[]) {
  if (!Number.isInteger(amount) || amount < 0) throw new Error("INVALID_PRIZE_AMOUNT");
  if (recipientIds.length === 0) return [];

  const baseAmount = Math.floor(amount / recipientIds.length);
  const remainder = amount % recipientIds.length;
  return recipientIds.map((userId, index) => ({ userId, amount: baseAmount + (index < remainder ? 1 : 0) }));
}

/** Splits a placement award evenly if several entities share that placement. */
export function splitPlacementPrize(amount: number, entityIds: string[]) {
  if (!Number.isInteger(amount) || amount < 0) throw new Error("INVALID_PRIZE_AMOUNT");
  if (entityIds.length === 0) return [];

  const baseAmount = Math.floor(amount / entityIds.length);
  const remainder = amount % entityIds.length;
  return entityIds.map((entityId, index) => ({ entityId, amount: baseAmount + (index < remainder ? 1 : 0) }));
}
