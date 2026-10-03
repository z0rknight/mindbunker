"use client";

import { useQuickCapture } from "@/components/quick-capture/QuickCaptureProvider";

export function WarRoomCaptureButton() {
  const { open } = useQuickCapture();
  return (
    <button
      type="button"
      onClick={() => open()}
      className="min-h-11 rounded-lg border border-violet-700/60 bg-violet-950/20 px-3 text-xs font-black text-violet-200 hover:border-violet-500"
    >
      + Capture
    </button>
  );
}
