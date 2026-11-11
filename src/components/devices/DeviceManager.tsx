import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Cpu, Plus, RotateCw, Ban, Loader2, AlertCircle } from "lucide-react";
import {
  fetchDevices,
  registerDevice,
  revokeDevice,
  rotateDeviceSecret,
  type DeviceRow,
} from "@/components/devices/devicesApi";
import { SecretRevealDialog } from "@/components/devices/SecretRevealDialog";
import { FreshnessBadge } from "@/components/telemetry/FreshnessBadge";
import { formatAge, getFreshness } from "@/lib/telemetryStatus";

const MAX_NAME_LENGTH = 60;

interface RevealedSecret {
  deviceName: string;
  secret: string;
}

export function DeviceManager() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<RevealedSecret | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      setDevices(await fetchDevices());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load your devices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setActionError("Give your device a name first.");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const result = await registerDevice(trimmed);
      setRevealed({ deviceName: trimmed, secret: result.secret });
      setName("");
      await loadDevices();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not register the device.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRotate(device: DeviceRow) {
    if (!window.confirm(`Generate a new secret for "${device.name}"? The current secret will stop working immediately.`)) return;
    setBusyDeviceId(device.id);
    setActionError(null);
    try {
      const secret = await rotateDeviceSecret(device.id);
      setRevealed({ deviceName: device.name, secret });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not generate a new secret.");
    } finally {
      setBusyDeviceId(null);
    }
  }

  async function handleRevoke(device: DeviceRow) {
    if (!window.confirm(`Revoke "${device.name}"? It will no longer be able to send data or receive commands.`)) return;
    setBusyDeviceId(device.id);
    setActionError(null);
    try {
      await revokeDevice(device.id);
      await loadDevices();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not revoke the device.");
    } finally {
      setBusyDeviceId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-6 lg:p-8">
        <h2 className="font-display text-lg font-semibold text-neutral-900">Register a device</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Each device gets its own secret. You will see the secret once, so copy it straight into the device.
        </p>
        <form onSubmit={handleRegister} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label" htmlFor="device-name">Device name</label>
            <input
              id="device-name"
              className="input"
              placeholder="Balcony tomato plant"
              maxLength={MAX_NAME_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <button type="submit" className="btn-primary sm:w-auto" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Register device
          </button>
        </form>
        {actionError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 animate-fade-in">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-neutral-200/70 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-neutral-900">Your devices</h2>
        </div>

        {loading && (
          <div className="flex items-center gap-2 px-6 py-10 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading devices...
          </div>
        )}

        {!loading && loadError && (
          <div className="flex flex-col items-start gap-3 px-6 py-10 text-sm text-red-700">
            <span>{loadError}</span>
            <button type="button" className="btn-secondary" onClick={() => void loadDevices()}>
              Try again
            </button>
          </div>
        )}

        {!loading && !loadError && devices.length === 0 && (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <Cpu className="mb-3 h-8 w-8 text-nature-500" />
            <p className="text-sm font-medium text-neutral-700">No devices yet</p>
            <p className="mt-1 text-xs text-neutral-400">Register your ESP8266 above to start receiving readings.</p>
          </div>
        )}

        {!loading && !loadError && devices.length > 0 && (
          <ul className="divide-y divide-neutral-200/70">
            {devices.map((device) => {
              const revoked = device.revoked_at !== null;
              const lastReported = device.state?.reported_at ?? null;
              const freshness = getFreshness(lastReported, Date.now());
              const busy = busyDeviceId === device.id;

              return (
                <li key={device.id} className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-neutral-900">{device.name}</p>
                      {revoked ? (
                        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                          Revoked
                        </span>
                      ) : (
                        <FreshnessBadge level={freshness} />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {revoked
                        ? "This device can no longer connect."
                        : lastReported
                          ? `Last reading: ${formatAge(lastReported, Date.now())}`
                          : "No readings yet"}
                      {!revoked && device.state && (
                        <>
                          {" · "}Moisture {Number(device.state.moisture_percent).toFixed(1)}%
                          {" · "}Pump {device.state.pump_on ? "on" : "off"}
                        </>
                      )}
                    </p>
                  </div>

                  {!revoked && (
                    <div className="flex flex-shrink-0 gap-2">
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => void handleRotate(device)}
                        disabled={busy}
                      >
                        <RotateCw className="h-4 w-4" />
                        New secret
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => void handleRevoke(device)}
                        disabled={busy}
                      >
                        <Ban className="h-4 w-4" />
                        Revoke
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {revealed && (
        <SecretRevealDialog
          deviceName={revealed.deviceName}
          secret={revealed.secret}
          onClose={() => setRevealed(null)}
        />
      )}
    </div>
  );
}
