export const LIVE_WINDOW_MS = 30_000;
export const DELAYED_WINDOW_MS = 5 * 60_000;

export type Freshness = "live" | "delayed" | "offline" | "never";

export function getFreshness(reportedAt: string | null | undefined, now: number): Freshness {
  if (!reportedAt) return "never";
  const age = now - new Date(reportedAt).getTime();
  if (age <= LIVE_WINDOW_MS) return "live";
  if (age <= DELAYED_WINDOW_MS) return "delayed";
  return "offline";
}

export function formatAge(reportedAt: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(reportedAt).getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(reportedAt).toLocaleString();
}

export const FRESHNESS_LABEL: Record<Freshness, string> = {
  live: "Live",
  delayed: "Delayed",
  offline: "Offline",
  never: "No data",
};
