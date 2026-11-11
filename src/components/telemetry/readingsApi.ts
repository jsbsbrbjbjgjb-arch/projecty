import { supabase } from "@/lib/supabase";
import type { ChartPoint } from "@/components/telemetry/MoistureChart";

export const MAX_HISTORY_POINTS = 10_000;
const PAGE_SIZE = 1000;

export interface HistoryResult {
  points: ChartPoint[];
  truncated: boolean;
}

export function toChartPoint(row: Record<string, unknown>): ChartPoint | null {
  const { recorded_at, moisture_percent } = row;
  if (typeof recorded_at !== "string") return null;
  const t = Date.parse(recorded_at);
  const moisture = Number(moisture_percent);
  if (Number.isNaN(t) || !Number.isFinite(moisture)) return null;
  return { t, moisture };
}

export async function fetchReadingHistory(deviceId: string, sinceIso: string): Promise<HistoryResult> {
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; from < MAX_HISTORY_POINTS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("readings")
      .select("recorded_at, moisture_percent")
      .eq("device_id", deviceId)
      .gte("recorded_at", sinceIso)
      .order("recorded_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error || !Array.isArray(data)) {
      throw new Error("Could not load sensor history.");
    }

    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE_SIZE) {
      return { points: toPoints(rows), truncated: false };
    }
  }

  return { points: toPoints(rows), truncated: true };
}

function toPoints(rows: Record<string, unknown>[]): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const row of rows) {
    const point = toChartPoint(row);
    if (point) points.push(point);
  }
  return points.reverse();
}
