export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function formatDistanceKm(distanceMeters: number): string {
  return `${(distanceMeters / 1000).toFixed(2)} km`;
}

/** One-decimal kilometers for compact rows, e.g. `18.4 km`. */
export function formatDistanceKmShort(distanceMeters: number): string {
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

/** Human-readable duration for history rows + aggregates, e.g. `1h 2m`, `38m`. */
export function formatCompactDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

export function formatMetricValue(value: number | null | undefined, suffix: string): string {
  if (value === null || value === undefined) {
    return '--';
  }

  return `${value}${suffix}`;
}

/** Compact ride date for history rows, e.g. `Sat, May 30`. */
export function formatHistoryDate(timestampMs: number): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(
    new Date(timestampMs),
  );
}

export function formatSessionDate(timestampMs: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(new Date(timestampMs));
}
