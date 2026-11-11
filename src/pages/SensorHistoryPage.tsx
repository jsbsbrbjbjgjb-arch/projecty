import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { DeviceSelector } from "@/components/telemetry/DeviceSelector";
import { ErrorPanel, LoadingPanel, NoDevicePanel } from "@/components/telemetry/DeviceStates";
import { FreshnessBadge } from "@/components/telemetry/FreshnessBadge";
import { MAX_HISTORY_POINTS, fetchReadingHistory, toChartPoint } from "@/components/telemetry/readingsApi";
import { MoistureChart, type ChartPoint } from "@/components/telemetry/MoistureChart";
import { useOwnerDevices } from "@/components/telemetry/useOwnerDevices";
import { supabase } from "@/lib/supabase";
import { formatAge, getFreshness } from "@/lib/telemetryStatus";

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

const RANGES = [
  { id: "1h", label: "1 hour", ms: HOUR_MS },
  { id: "6h", label: "6 hours", ms: 6 * HOUR_MS },
  { id: "24h", label: "24 hours", ms: DAY_MS },
  { id: "7d", label: "7 days", ms: 7 * DAY_MS },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

interface SensorHistoryPageProps {
  onOpenSettings: () => void;
}

export function SensorHistoryPage({ onOpenSettings }: SensorHistoryPageProps) {
  const { devices, loading, error, now, reload } = useOwnerDevices();
  const [selectedId, setSelectedId] = useState("");
  const [rangeId, setRangeId] = useState<RangeId>("24h");
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [attempt, setAttempt] = useState(0);

  const activeDevices = devices.filter((d) => d.revoked_at === null);
  const device = activeDevices.find((d) => d.id === selectedId) ?? activeDevices[0] ?? null;
  const deviceId = device?.id ?? null;
  const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[2];

  useEffect(() => {
    if (!deviceId) return;
    let cancelled = false;
    const sinceIso = new Date(Date.now() - range.ms).toISOString();

    async function load() {
      setHistoryStatus("loading");
      try {
        const result = await fetchReadingHistory(deviceId as string, sinceIso);
        if (cancelled) return;
        setPoints(result.points);
        setTruncated(result.truncated);
        setHistoryStatus("ready");
      } catch {
        if (!cancelled) setHistoryStatus("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [deviceId, range.ms, attempt]);

  useEffect(() => {
    if (!deviceId) return;
    const channel = supabase
      .channel(`readings-${deviceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "readings", filter: `device_id=eq.${deviceId}` },
        (payload) => {
          const point = toChartPoint(payload.new as Record<string, unknown>);
          if (!point) return;
          setPoints((prev) => {
            if (prev.some((p) => p.t === point.t)) return prev;
            return [...prev, point].slice(-MAX_HISTORY_POINTS);
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [deviceId]);

  const rangeStart = now - range.ms;
  const visible = useMemo(() => points.filter((p) => p.t >= rangeStart && p.t <= now), [points, rangeStart, now]);
  const stats = useMemo(() => summarize(visible), [visible]);

  if (loading) return <LoadingPanel label="Loading your history..." />;
  if (error) return <ErrorPanel message={error} onRetry={() => void reload()} />;
  if (!device) return <NoDevicePanel onOpenSettings={onOpenSettings} />;

  const freshness = getFreshness(device.state?.reported_at, now);
  const newest = visible[visible.length - 1];

  return (
    <div className="space-y-6">
      <section className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="truncate font-display text-xl font-semibold text-neutral-900">{device.name}</h2>
            <FreshnessBadge level={freshness} />
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {device.state ? `Newest reading ${formatAge(device.state.reported_at, now)}` : "No readings received yet"}
          </p>
        </div>
        <DeviceSelector devices={activeDevices} selectedId={device.id} onChange={setSelectedId} />
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Latest" value={newest ? `${newest.moisture.toFixed(1)}%` : "--"} />
        <StatCard label="Average" value={stats ? `${stats.avg.toFixed(1)}%` : "--"} />
        <StatCard label="Lowest" value={stats ? `${stats.min.toFixed(1)}%` : "--"} />
        <StatCard label="Highest" value={stats ? `${stats.max.toFixed(1)}%` : "--"} />
      </div>

      <section className="card p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-neutral-900">Soil moisture</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Gaps in the line mean the device was not reporting during that time.
            </p>
          </div>
          <div role="group" aria-label="Time range" className="inline-flex self-start rounded-lg bg-neutral-100 p-1">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={r.id === rangeId}
                onClick={() => setRangeId(r.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  r.id === rangeId ? "bg-white text-nature-800 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {r.id}
              </button>
            ))}
          </div>
        </div>

        {historyStatus === "loading" || historyStatus === "idle" ? (
          <div className="flex h-72 items-center justify-center gap-2 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading readings...
          </div>
        ) : historyStatus === "error" ? (
          <ErrorPanel message="Could not load sensor history." onRetry={() => setAttempt((n) => n + 1)} />
        ) : visible.length === 0 ? (
          <div className="flex h-72 flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-neutral-700">No readings in the last {range.label}</p>
            <p className="mt-1 text-xs text-neutral-400">Choose a longer range or check that the device is reporting.</p>
          </div>
        ) : (
          <MoistureChart points={visible} rangeStart={rangeStart} rangeEnd={now} rangeMs={range.ms} />
        )}

        {truncated && historyStatus === "ready" && (
          <p className="mt-4 text-xs text-amber-700">
            This range has more readings than can be shown. Showing the most recent {MAX_HISTORY_POINTS.toLocaleString()}.
          </p>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-nature-600">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}

function summarize(points: ChartPoint[]): { min: number; max: number; avg: number } | null {
  if (points.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const p of points) {
    min = Math.min(min, p.moisture);
    max = Math.max(max, p.moisture);
    sum += p.moisture;
  }
  return { min, max, avg: sum / points.length };
}
