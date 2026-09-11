export const DAILY_FREE_USES = 3;

export interface DailyUsageState {
  freeUsesDay: string;
  freeUsesUsed: number;
}

export function localDayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resetDailyUsageIfNeeded(state: DailyUsageState, date = new Date()): DailyUsageState {
  const day = localDayKey(date);
  return state.freeUsesDay === day ? state : { freeUsesDay: day, freeUsesUsed: 0 };
}

export function consumeFreeUse(state: DailyUsageState): DailyUsageState | null {
  if (state.freeUsesUsed >= DAILY_FREE_USES) return null;
  return { ...state, freeUsesUsed: state.freeUsesUsed + 1 };
}

export function refundFreeUse(state: DailyUsageState): DailyUsageState {
  return { ...state, freeUsesUsed: Math.max(0, state.freeUsesUsed - 1) };
}

export function remainingFreeUses(state: DailyUsageState, date = new Date()): number {
  const normalized = resetDailyUsageIfNeeded(state, date);
  return Math.max(0, DAILY_FREE_USES - normalized.freeUsesUsed);
}
