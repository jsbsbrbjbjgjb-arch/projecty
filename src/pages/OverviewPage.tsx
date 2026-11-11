import { useState } from "react";
import { AlertTriangle, Droplets, Gauge } from "lucide-react";
import { DeviceSelector } from "@/components/telemetry/DeviceSelector";
import { ErrorPanel, LoadingPanel, NoDevicePanel } from "@/components/telemetry/DeviceStates";
import { FreshnessBadge } from "@/components/telemetry/FreshnessBadge";
import { useOwnerDevices } from "@/components/telemetry/useOwnerDevices";
import { formatAge, getFreshness, type Freshness } from "@/lib/telemetryStatus";

interface OverviewPageProps {
  onOpenSettings: () => void;
}

export function OverviewPage({ onOpenSettings }: OverviewPageProps) {
  const { devices, loading, error, now, reload } = useOwnerDevices();
  const [selectedId, setSelectedId] = useState("");

  if (loading) return <LoadingPanel label="Loading your plant..." />;
  if (error) return <ErrorPanel message={error} onRetry={() => void reload()} />;

  const activeDevices = devices.filter((d) => d.revoked_at === null);
  const device = activeDevices.find((d) => d.id === selectedId) ?? activeDevices[0] ?? null;
  if (!device) return <NoDevicePanel onOpenSettings={onOpenSettings} />;

  const state = device.state;
  const freshness = getFreshness(state?.reported_at, now);
  const isLive = freshness === "live";

  return (
    <div className="space-y-6">
      <section className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="truncate font-display text-xl font-semibold text-neutral-900">{device.name}</h2>
            <FreshnessBadge level={freshness} />
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {state
              ? `Last reading ${formatAge(state.reported_at, now)} at ${new Date(state.reported_at).toLocaleTimeString()}`
              : "Waiting for the first reading"}
          </p>
        </div>
        <DeviceSelector devices={activeDevices} selectedId={device.id} onChange={setSelectedId} />
      </section>

      {freshness === "never" && <StaleNotice level="never" />}
      {freshness !== "live" && freshness !== "never" && state && (
        <StaleNotice level={freshness} age={formatAge(state.reported_at, now)} />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-6 lg:col-span-2 lg:p-8">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-nature-700">
            <Droplets className="h-4 w-4" />
            Soil moisture
            {!isLive && state && <span className="text-xs font-normal text-neutral-500">(last known value)</span>}
          </div>
          <p
            className={`mt-4 font-display text-6xl font-semibold tabular-nums transition-colors ${
              isLive ? "text-neutral-900" : "text-neutral-500"
            }`}
          >
            {state ? `${state.moisture_percent.toFixed(1)}%` : "--"}
          </p>
          <MoistureBar value={state?.moisture_percent ?? null} live={isLive} />
          <div className="mt-2 flex justify-between text-xs text-neutral-400">
            <span>Dry</span>
            <span>Wet</span>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <section className="card p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-nature-700">
              <Gauge className="h-4 w-4" />
              Sensor reading
            </div>
            <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-neutral-900">
              {state ? state.raw_reading : "--"}
            </p>
            <p className="mt-1 text-xs text-neutral-500">Raw value from the soil sensor, 0 to 1024</p>
          </section>

          <section className="card p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-nature-700">
              <Droplets className="h-4 w-4" />
              Water pump
            </div>
            <p className="mt-3 font-display text-3xl font-semibold text-neutral-900">
              {state ? (state.pump_on ? "Running" : "Idle") : "--"}
            </p>
            <p className="mt-1 text-xs text-neutral-500">{isLive ? "Reported by the device" : "Last reported state"}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function MoistureBar({ value, live }: { value: number | null; live: boolean }) {
  const width = value === null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div
      className="mt-6 h-3 w-full overflow-hidden rounded-full bg-neutral-100"
      role="meter"
      aria-label="Soil moisture"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${
          live ? "bg-gradient-to-r from-nature-400 to-nature-600" : "bg-neutral-300"
        }`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function StaleNotice({ level, age = "" }: { level: Exclude<Freshness, "live">; age?: string }) {
  const message =
    level === "never"
      ? "No reading has arrived from this device yet. Check that it is powered, connected to Wi-Fi and registered with its current secret."
      : level === "delayed"
        ? `No new reading ${age}. The values below are the last ones received and are not live.`
        : `This device has not reported ${age}. The values below are from its last connection.`;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900 animate-fade-in">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
      <span>{message}</span>
    </div>
  );
}
