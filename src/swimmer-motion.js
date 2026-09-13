export function motionDuration(previous, next, racing) {
  if (!racing || previous == null || next < previous) return 0;
  return Math.min(660, Math.max(140, (next - previous) * 55 / 1.2));
}
