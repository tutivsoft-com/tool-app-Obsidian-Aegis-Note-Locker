export function assertNoConflict(expected: string, current: string): void {
  if (expected !== current) throw new Error("The note changed on disk; resolve the sync conflict before retrying.");
}

export function temporaryPath(path: string): string {
  return `${path}.aegis-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`;
}
