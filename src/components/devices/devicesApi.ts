import { supabase } from "@/lib/supabase";

export interface DeviceState {
  reported_at: string;
  raw_reading: number;
  moisture_percent: number;
  pump_on: boolean;
}

export interface DeviceRow {
  id: string;
  name: string;
  created_at: string;
  revoked_at: string | null;
  state: DeviceState | null;
}

interface RawDeviceRow {
  id: string;
  name: string;
  created_at: string;
  revoked_at: string | null;
  device_states: DeviceState | DeviceState[] | null;
}

const GENERIC_ERROR = "Something went wrong. Please try again.";

async function readFunctionError(error: unknown): Promise<string> {
  const response = (error as { context?: unknown }).context;
  if (response instanceof Response) {
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string") return body.error;
    } catch {
      return GENERIC_ERROR;
    }
  }
  return GENERIC_ERROR;
}

export async function fetchDevices(): Promise<DeviceRow[]> {
  const { data, error } = await supabase
    .from("devices")
    .select("id, name, created_at, revoked_at, device_states(reported_at, raw_reading, moisture_percent, pump_on)")
    .order("created_at", { ascending: false });

  if (error || !Array.isArray(data)) {
    throw new Error("Could not load your devices.");
  }

  return (data as unknown as RawDeviceRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    revoked_at: row.revoked_at,
    state: Array.isArray(row.device_states) ? (row.device_states[0] ?? null) : row.device_states,
  }));
}

type OwnerDevicesBody =
  | { action: "register"; name: string }
  | { action: "rotate" | "revoke"; deviceId: string };

async function invokeOwnerDevices(body: OwnerDevicesBody): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke("owner-devices", { body });
  if (error) throw new Error(await readFunctionError(error));
  if (typeof data !== "object" || data === null) throw new Error(GENERIC_ERROR);
  return data as Record<string, unknown>;
}

function readString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value !== "string") throw new Error(GENERIC_ERROR);
  return value;
}

export async function registerDevice(name: string): Promise<{ deviceId: string; secret: string }> {
  const data = await invokeOwnerDevices({ action: "register", name });
  return { deviceId: readString(data, "device_id"), secret: readString(data, "secret") };
}

export async function rotateDeviceSecret(deviceId: string): Promise<string> {
  const data = await invokeOwnerDevices({ action: "rotate", deviceId });
  return readString(data, "secret");
}

export async function revokeDevice(deviceId: string): Promise<void> {
  await invokeOwnerDevices({ action: "revoke", deviceId });
}
