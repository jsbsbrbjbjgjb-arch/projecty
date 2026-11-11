import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchDevices, type DeviceRow, type DeviceState } from "@/components/devices/devicesApi";

const CLOCK_TICK_MS = 5_000;

interface StateUpdate {
  deviceId: string;
  state: DeviceState;
}

function toStateUpdate(row: Record<string, unknown>): StateUpdate | null {
  const { device_id, reported_at, raw_reading, moisture_percent, pump_on } = row;
  if (
    typeof device_id !== "string" ||
    typeof reported_at !== "string" ||
    typeof raw_reading !== "number" ||
    typeof moisture_percent !== "number" ||
    typeof pump_on !== "boolean"
  ) {
    return null;
  }
  return {
    deviceId: device_id,
    state: { reported_at, raw_reading, moisture_percent, pump_on },
  };
}

export function useOwnerDevices() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const devicesRef = useRef<DeviceRow[]>([]);

  const reload = useCallback(async () => {
    try {
      const rows = await fetchDevices();
      devicesRef.current = rows;
      setDevices(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your devices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("owner-device-states")
      .on("postgres_changes", { event: "*", schema: "public", table: "device_states" }, (payload) => {
        if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE") return;
        const update = toStateUpdate(payload.new as Record<string, unknown>);
        if (!update) return;

        if (!devicesRef.current.some((d) => d.id === update.deviceId)) {
          void reload();
          return;
        }
        setDevices((prev) => {
          const next = prev.map((d) => (d.id === update.deviceId ? { ...d, state: update.state } : d));
          devicesRef.current = next;
          return next;
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload]);

  return { devices, loading, error, now, reload };
}
