export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function formatDistanceKm(distanceMeters: number): string {
  return `${(distanceMeters / 1000).toFixed(2)} km`;
}

export function formatMetricValue(value: number | null | undefined, suffix: string): string {
  if (value === null || value === undefined) {
    return '--';
  }

  return `${value}${suffix}`;
}
