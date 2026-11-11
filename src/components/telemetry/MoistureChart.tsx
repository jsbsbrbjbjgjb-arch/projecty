import { useState, type PointerEvent } from "react";

export interface ChartPoint {
  t: number;
  moisture: number;
}

interface MoistureChartProps {
  points: ChartPoint[];
  rangeStart: number;
  rangeEnd: number;
  rangeMs: number;
}

const WIDTH = 800;
const HEIGHT = 300;
const PAD = { top: 16, right: 16, bottom: 32, left: 44 };
const INNER_W = WIDTH - PAD.left - PAD.right;
const INNER_H = HEIGHT - PAD.top - PAD.bottom;
const BASELINE_Y = PAD.top + INNER_H;
const GAP_MS = 2 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const GRID_LINES = [0, 25, 50, 75, 100];
const X_TICKS = 4;

function xFor(t: number, start: number, end: number): number {
  return PAD.left + ((t - start) / (end - start)) * INNER_W;
}

function yFor(moisture: number): number {
  return PAD.top + (1 - moisture / 100) * INNER_H;
}

function splitOnGaps(points: ChartPoint[]): ChartPoint[][] {
  const segments: ChartPoint[][] = [];
  let current: ChartPoint[] = [];
  for (const point of points) {
    const prev = current[current.length - 1];
    if (prev && point.t - prev.t > GAP_MS) {
      segments.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

function linePath(segment: ChartPoint[], start: number, end: number): string {
  return segment
    .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(p.t, start, end).toFixed(1)} ${yFor(p.moisture).toFixed(1)}`)
    .join(" ");
}

function areaPath(segment: ChartPoint[], start: number, end: number): string {
  const first = segment[0];
  const last = segment[segment.length - 1];
  return `${linePath(segment, start, end)} L${xFor(last.t, start, end).toFixed(1)} ${BASELINE_Y} L${xFor(first.t, start, end).toFixed(1)} ${BASELINE_Y} Z`;
}

function formatTick(t: number, rangeMs: number): string {
  const options: Intl.DateTimeFormatOptions =
    rangeMs > DAY_MS
      ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
      : { hour: "2-digit", minute: "2-digit" };
  return new Date(t).toLocaleString([], options);
}

export function formatReadingTime(t: number): string {
  return new Date(t).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function MoistureChart({ points, rangeStart, rangeEnd, rangeMs }: MoistureChartProps) {
  const [hover, setHover] = useState<ChartPoint | null>(null);
  const segments = splitOnGaps(points);

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const t = rangeStart + ((svgX - PAD.left) / INNER_W) * (rangeEnd - rangeStart);
    let nearest = points[0];
    for (const p of points) {
      if (Math.abs(p.t - t) < Math.abs(nearest.t - t)) nearest = p;
    }
    setHover(nearest);
  }

  return (
    <div>
      <div className="mb-2 flex h-5 items-center text-xs text-neutral-500">
        {hover ? (
          <span className="tabular-nums">
            <span className="font-medium text-neutral-800">{hover.moisture.toFixed(1)}%</span> at {formatReadingTime(hover.t)}
          </span>
        ) : (
          <span>Move the pointer over the chart to see exact values.</span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-72 w-full touch-none select-none"
        role="img"
        aria-label="Soil moisture over time"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="moisture-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#4f9a6b" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#4f9a6b" stopOpacity="0" />
          </linearGradient>
        </defs>

        {GRID_LINES.map((value) => (
          <g key={value}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yFor(value)}
              y2={yFor(value)}
              className="stroke-neutral-200"
              strokeDasharray={value === 0 ? undefined : "4 6"}
            />
            <text x={PAD.left - 8} y={yFor(value) + 4} textAnchor="end" className="fill-neutral-400 text-[11px]">
              {value}%
            </text>
          </g>
        ))}

        {Array.from({ length: X_TICKS + 1 }, (_, i) => {
          const t = rangeStart + (i / X_TICKS) * (rangeEnd - rangeStart);
          const anchor = i === 0 ? "start" : i === X_TICKS ? "end" : "middle";
          return (
            <text key={i} x={xFor(t, rangeStart, rangeEnd)} y={HEIGHT - 8} textAnchor={anchor} className="fill-neutral-400 text-[11px]">
              {formatTick(t, rangeMs)}
            </text>
          );
        })}

        {segments.map((segment, i) => (
          <g key={i}>
            <path d={areaPath(segment, rangeStart, rangeEnd)} fill="url(#moisture-area)" />
            <path
              d={linePath(segment, rangeStart, rangeEnd)}
              fill="none"
              className="stroke-nature-600"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        ))}

        {hover && (
          <circle
            cx={xFor(hover.t, rangeStart, rangeEnd)}
            cy={yFor(hover.moisture)}
            r={5}
            className="fill-white stroke-nature-700"
            strokeWidth={2.5}
          />
        )}
      </svg>
    </div>
  );
}
