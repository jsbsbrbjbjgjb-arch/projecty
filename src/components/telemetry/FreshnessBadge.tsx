import { FRESHNESS_LABEL, type Freshness } from "@/lib/telemetryStatus";

const STYLES: Record<Freshness, string> = {
  live: "bg-nature-100 text-nature-800",
  delayed: "bg-amber-50 text-amber-800",
  offline: "bg-neutral-100 text-neutral-700",
  never: "bg-neutral-100 text-neutral-500",
};

export function FreshnessBadge({ level }: { level: Freshness }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[level]}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${level === "live" ? "animate-pulse bg-nature-600" : "bg-current opacity-60"}`}
      />
      {FRESHNESS_LABEL[level]}
    </span>
  );
}
