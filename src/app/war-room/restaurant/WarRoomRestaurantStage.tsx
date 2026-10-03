"use client";

import { formatCurrency } from "@/utils/date";
import { PixelIcon, LiveIndicator } from "@/components/ui/PixelVisuals";
import { ArrivalScope, NewBadge, StatusTransition, useIsNew, useUpdateFlash } from "@/components/os";
import { assignTableSlots, type TableSlot } from "./table-layout";
import type {
  RestaurantViewModel,
  RestaurantClientTable,
  RestaurantClientHealth,
  RestaurantTicket,
} from "@/modules/war-room/restaurant-core";
import { useEntityInspection } from "@/components/entity-inspection/EntityDrawerProvider";

const HEALTH_LABEL: Record<RestaurantClientHealth, string> = {
  ACTIVE: "Active",
  REVIEW: "In review",
  BLOCKED: "Blocked",
  IDLE: "Idle",
};

function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// The dominant visual center of War Room: a top-down restaurant floor
// where clients are tables, open Production Orders are the comanda rail,
// and the canonical open Work Session is the editor station. Every value
// on the stage is a reshaping of facts already computed server-side in
// buildRestaurantViewModel -- this component only lays them out and
// handles the click-to-inspect interaction.
export function WarRoomRestaurantStage({ viewModel }: { viewModel: RestaurantViewModel }) {
  const { openEntity } = useEntityInspection();
  const placed = assignTableSlots(viewModel.clients);

  return (
    <div
      className="pixel-frame relative aspect-video w-full overflow-hidden rounded-2xl border border-amber-900/30"
      data-testid="war-room-restaurant-stage"
    >
      <div className="wr-floor pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="wr-vignette pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="wr-lamp-glow pointer-events-none absolute left-1/2 top-0 h-32 w-56 -translate-x-1/2 rounded-full bg-amber-500/10 blur-2xl"
        aria-hidden="true"
      />

      <CommandaRail tickets={viewModel.tickets} />
      <EditorStation session={viewModel.activeSession} />

      {placed.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <p className="max-w-xs text-xs text-zinc-500">
            No active clients to seat right now. Tables appear as soon as current work or a recent session exists.
          </p>
        </div>
      ) : (
        placed.map(({ slot, client }) => (
          <ClientTableMarker
            key={client.id}
            slot={slot}
            client={client}
            onSelect={(trigger) => openEntity({ type: "client", id: client.id }, trigger)}
          />
        ))
      )}
    </div>
  );
}

function CommandaRail({ tickets }: { tickets: RestaurantTicket[] }) {
  if (tickets.length === 0) {
    return (
      <div className="absolute inset-x-0 top-0 flex h-[20%] items-center justify-center border-b border-amber-900/20 bg-black/20 px-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">No open comandas</p>
      </div>
    );
  }
  return (
    <div className="absolute inset-x-0 top-0 flex h-[20%] items-center gap-2 overflow-x-auto border-b border-amber-900/20 bg-black/20 px-3 py-2">
      <ArrivalScope ids={tickets.map((ticket) => `ticket:${ticket.id}`)}>
        {tickets.map((ticket) => (
          <CommandaTicket key={ticket.id} ticket={ticket} />
        ))}
      </ArrivalScope>
    </div>
  );
}

// RMEDIA OS M3: a comanda that ARRIVES after mount gets a brief NEW word + edge;
// a comanda whose phase or item count changes gets a brief changed marker; both
// return to neutral by themselves. Presentation over the same server view model.
function CommandaTicket({ ticket }: { ticket: RestaurantTicket }) {
  const isNew = useIsNew(`ticket:${ticket.id}`);
  const changed = useUpdateFlash(`${ticket.phase}|${ticket.itemCount}`, { tone: "brand" });
  return (
    <div
      className={`os-flash os-arrive wr-ticket flex shrink-0 flex-col gap-0.5 rounded-md border border-amber-800/40 bg-zinc-950/70 px-2.5 py-1.5 text-left ${
        ticket.phase === "REVIEW" ? "wr-ticket-review" : ""
      }`}
      data-flash={isNew ? "brand" : changed}
      data-enter={isNew ? "true" : undefined}
    >
      <span className="max-w-[9rem] truncate text-[10px] font-black uppercase tracking-wide text-amber-200">
        {isNew && <NewBadge className="mr-1.5" />}
        {ticket.clientName}
      </span>
      <span className="max-w-[9rem] truncate text-[10px] text-zinc-400">{ticket.projectName || ticket.label}</span>
      <span className="text-[9px] font-bold text-zinc-500">
        {ticket.itemCount} item{ticket.itemCount === 1 ? "" : "s"} ·{" "}
        <StatusTransition variant="inline" marker="none" label={ticket.phaseLabel} />
      </span>
    </div>
  );
}

// Sensor Reality Sync §4: three visually distinct states, not two --
// idle, a real canonical Work Session (WORKING, cyan -- unchanged from
// before), and an open but not-yet-approved Sensor recording
// (SENSOR_RECORDING, amber -- new). The amber state is deliberately a
// different color and label from WORKING: it is real Sensor activity,
// but it is not canonical history until Emmanuel approves it, and this
// stage must never imply otherwise.
function EditorStation({ session }: { session: RestaurantViewModel["activeSession"] }) {
  const active = session !== null;
  const isSensorRecording = session?.kind === "SENSOR_RECORDING";
  const toneClass = isSensorRecording
    ? "wr-editor-glow-sensor border-amber-500/60 bg-amber-950/30"
    : active
      ? "wr-editor-glow border-cyan-500/60 bg-cyan-950/30"
      : "border-zinc-700/50 bg-zinc-900/50";
  // RMEDIA OS M3: a change of the open session (started, switched, ended) marks the
  // station briefly and is announced once; elapsed time is deliberately NOT part of
  // the key, so the periodic refresh stays silent. Idle stays static.
  const stationKey = session
    ? `${session.kind}|${session.contextType}|${session.clientName ?? ""}|${session.videoTitle ?? ""}|${session.contextLabel ?? ""}`
    : "idle";
  const stationFlash = useUpdateFlash(stationKey, { tone: "brand" });
  const announcement = session
    ? `${isSensorRecording ? "Sensor recording" : "Editing"} started`
    : "Editor idle";
  const iconToneClass = isSensorRecording
    ? "text-amber-300"
    : active
      ? "text-cyan-300"
      : "text-zinc-600";
  return (
    <div className="pointer-events-none absolute left-1/2 top-[26%] flex -translate-x-1/2 flex-col items-center gap-1">
      <span className="sr-only" role="status" aria-live="polite">
        {stationFlash ? announcement : ""}
      </span>
      <div
        className={`os-flash grid h-12 w-16 place-items-center rounded-md border sm:h-14 sm:w-20 ${toneClass}`}
        data-flash={stationFlash}
      >
        <PixelIcon name="video" className={`h-5 w-5 sm:h-6 sm:w-6 ${iconToneClass}`} />
      </div>
      {active ? (
        <div className="flex flex-col items-center">
          <LiveIndicator label={isSensorRecording ? "SENSOR RECORDING" : "EDITING"} />
          <span className="mt-0.5 max-w-[9rem] truncate text-center text-[10px] font-bold text-zinc-300">
            {session.contextType === "CLIENT"
              ? `${session.clientName ?? "Unattributed"} · ${session.videoTitle ?? "No video"}`
              : `${session.contextType}${session.contextLabel ? ` · ${session.contextLabel}` : ""}`}
          </span>
          <span className={`mb-timer text-[9px] ${isSensorRecording ? "text-amber-300/70" : "text-cyan-300/70"}`}>
            {formatElapsed(session.elapsedSeconds)}
          </span>
          {isSensorRecording && (
            <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-500/70">
              Not yet approved
            </span>
          )}
        </div>
      ) : (
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Editor idle</span>
      )}
    </div>
  );
}

function ClientTableMarker({
  slot,
  client,
  onSelect,
}: {
  slot: TableSlot;
  client: RestaurantClientTable;
  onSelect: (trigger: HTMLButtonElement) => void;
}) {
  const primaryAttributable = client.attributable[0] ?? null;
  const workCount = client.activeCount + client.reviewCount;
  // A change of the client's health marks the table briefly. BLOCKED stays static
  // (critical is a state, not an animation); nothing fires on the periodic refresh
  // unless the canonical health actually changed.
  const healthFlash = useUpdateFlash(client.health, { tone: "brand" });
  return (
    <button
      type="button"
      onClick={(event) => onSelect(event.currentTarget)}
      aria-label={`${client.name}, ${HEALTH_LABEL[client.health]}`}
      style={{ left: `${slot.xPct}%`, top: `${slot.yPct}%` }}
      data-flash={client.health === "BLOCKED" ? undefined : healthFlash}
      className="os-flash wr-table-button absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-lg border border-amber-900/30 bg-black/40 px-2 py-1.5 text-center backdrop-blur-sm hover:border-amber-700/50 sm:px-2.5 sm:py-2"
    >
      <span className={`wr-table-marker wr-table-marker-${client.health.toLowerCase()}`} aria-hidden="true" />
      <span className="max-w-[5.5rem] truncate text-[10px] font-black text-white sm:max-w-[6.5rem] sm:text-[11px]">
        {client.name}
      </span>
      <span className="text-[8px] font-bold uppercase tracking-wide text-zinc-400 sm:text-[9px]">
        {workCount > 0 ? `${workCount} active` : "Idle"}
      </span>
      {primaryAttributable && (
        <span className="text-[8px] font-bold text-emerald-300 sm:text-[9px]">
          {formatCurrency(primaryAttributable.amount, primaryAttributable.currency)} attributed
        </span>
      )}
    </button>
  );
}
