export const DAY = 24 * 60 * 60 * 1000;

export function nowIso(): string {
  return new Date().toISOString();
}
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
export function addDays(base: Date | string, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function daysFromNow(days: number, hour = 9, minute = 0): string {
  const d = addDays(new Date(), days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
export function dateFromNow(days: number): string {
  return isoDate(addDays(new Date(), days));
}
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return Math.floor((target.getTime() - Date.now()) / DAY);
}
export function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / (60 * 60 * 1000);
}
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
export function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
export function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
export function fmtCountdown(iso: string): string {
  const h = hoursUntil(iso);
  if (h <= 0) return 'Expired';
  const days = Math.floor(h / 24);
  const hrs = Math.floor(h % 24);
  if (days > 0) return `${days}d ${hrs}h`;
  const mins = Math.floor((h * 60) % 60);
  return `${hrs}h ${mins}m`;
}
export function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}
export function fmtMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
