export function sampleIndex(locationX: number, width: number, count: number): number {
 if (count < 2 || !Number.isFinite(width) || width <= 0 || !Number.isFinite(locationX)) return 0;
 return Math.max(0, Math.min(count - 1, Math.round(((locationX / width * 300 - 12) / 276) * (count - 1))));
}
