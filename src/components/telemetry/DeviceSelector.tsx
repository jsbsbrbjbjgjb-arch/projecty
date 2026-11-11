import { ChevronDown } from "lucide-react";
import type { DeviceRow } from "@/components/devices/devicesApi";

interface DeviceSelectorProps {
  devices: DeviceRow[];
  selectedId: string;
  onChange: (id: string) => void;
}

export function DeviceSelector({ devices, selectedId, onChange }: DeviceSelectorProps) {
  if (devices.length < 2) return null;

  return (
    <div className="relative">
      <label className="sr-only" htmlFor="device-selector">Device</label>
      <select
        id="device-selector"
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="input appearance-none py-2 pr-9 sm:w-64"
      >
        {devices.map((device) => (
          <option key={device.id} value={device.id}>
            {device.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
    </div>
  );
}
