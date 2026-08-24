"use client";

import { createSensorDevice, revokeSensorDevice, rotateSensorDevice } from "@/modules/sensor/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Device = {
  id: number;
  publicId: string;
  name: string;
  scopes: string;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
};

export function SensorDeviceManager({ devices }: { devices: Device[] }) {
  const router = useRouter();
  const [name, setName] = useState("Emmanuel's Mac");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function create() {
    setError("");
    startTransition(async () => {
      const result = await createSensorDevice(name);
      if (!result.success) return setError(result.error);
      setToken(result.token);
      router.refresh();
    });
  }

  function revoke(id: number) {
    startTransition(async () => {
      const result = await revokeSensorDevice(id);
      if (!result.success) setError(result.error);
      router.refresh();
    });
  }

  function rotate(id: number) {
    startTransition(async () => {
      const result = await rotateSensorDevice(id);
      if (!result.success) return setError(result.error);
      setToken(result.token);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h2 className="font-bold text-white">Sensor devices</h2>
      <p className="mt-1 text-xs leading-5 text-zinc-500">
        Credentials are shown once. Paste into Sensor Preferences; the server stores only SHA-256.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80}
          className="min-h-11 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" />
        <button type="button" disabled={pending} onClick={create}
          className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-black text-white disabled:opacity-50">
          Create credential
        </button>
      </div>
      {token && (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs font-bold text-amber-200">Copy now — it will not be shown again.</p>
          <code className="mt-2 block break-all rounded bg-black/40 p-2 text-xs text-amber-100">{token}</code>
          <button type="button" onClick={() => navigator.clipboard.writeText(token)}
            className="mt-2 text-xs font-bold text-cyan-300">Copy credential</button>
        </div>
      )}
      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
      <div className="mt-4 space-y-2">
        {devices.map((device) => (
          <div key={device.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-black/20 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-zinc-200">{device.name}</p>
              <p className="truncate text-[10px] text-zinc-600">{device.publicId} · {device.scopes}</p>
              <p className="mt-1 text-[10px] text-zinc-500">
                {device.revokedAt ? "Revoked" : device.lastSeenAt ? `Last sync ${new Date(device.lastSeenAt).toLocaleString()}` : "Never synced"}
              </p>
            </div>
            <button type="button" disabled={pending} onClick={() => rotate(device.id)} className="text-xs font-bold text-cyan-400">Rotate</button>
            {!device.revokedAt && <button type="button" disabled={pending} onClick={() => revoke(device.id)} className="text-xs font-bold text-red-400">Revoke</button>}
          </div>
        ))}
      </div>
    </section>
  );
}
