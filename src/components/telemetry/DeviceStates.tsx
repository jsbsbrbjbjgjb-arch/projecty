import { AlertCircle, Cpu, Loader2, Plus } from "lucide-react";

export function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="card flex items-center justify-center gap-2 px-6 py-20 text-sm text-neutral-500">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card flex flex-col items-start gap-3 px-6 py-10 text-sm text-red-700">
      <span className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" /> {message}
      </span>
      <button type="button" className="btn-secondary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function NoDevicePanel({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-nature-50 text-nature-600">
        <Cpu className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-neutral-800">No device connected yet</p>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">
        Register your ESP8266 in Settings to start seeing soil moisture here.
      </p>
      <button type="button" className="btn-primary mt-6" onClick={onOpenSettings}>
        <Plus className="h-4 w-4" />
        Register a device
      </button>
    </div>
  );
}
