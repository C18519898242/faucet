export function getClaimDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
