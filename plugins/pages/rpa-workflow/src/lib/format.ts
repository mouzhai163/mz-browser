export function formatDuration(ms?: number | null): string {
  if (ms === undefined || ms === null) return '-';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}
