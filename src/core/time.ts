// Lightweight time utilities

export function nowMs(): number {
  return Date.now();
}

export function elapsedSeconds(startMs: number, endMs?: number): number {
  const end = endMs ?? nowMs();
  return Math.floor((end - startMs) / 1000);
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
