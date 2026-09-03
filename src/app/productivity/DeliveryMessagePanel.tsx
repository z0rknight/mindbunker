"use client";

import { useEffect, useState } from "react";
import { getDeliveryMessagePayload } from "@/modules/delivery-message/actions";
import { formatDeliveryMessage } from "@/modules/delivery-message/core";

// Post-Job Commercial + Delivery Sniper §11: DELIVER VIDEO / GENERATE
// DELIVERY MESSAGE. Reuses the exact Pricing Lab "copy output"
// interaction (self-fetch -> editable textarea -> Copy button), and the
// same client-safe-only discipline the client portal already enforces --
// see modules/delivery-message/actions.ts for how the payload is
// resolved. The operator can freely edit the generated text before
// copying; nothing here sends anything anywhere (no Slack/email this
// wave, per the brief).
export function DeliveryMessagePanel({ videoId }: { videoId: number }) {
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || text !== null) return;
    let active = true;
    getDeliveryMessagePayload(videoId).then((payload) => {
      if (active && payload) setText(formatDeliveryMessage(payload));
    });
    return () => {
      active = false;
    };
  }, [open, text, videoId]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-6 inline-flex min-h-9 items-center rounded-xl border border-violet-700/40 bg-violet-950/20 px-3 text-xs font-black text-violet-300 hover:bg-violet-950/40"
      >
        Generate delivery message →
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-violet-700/40 bg-violet-950/20 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-violet-300">
        Delivery message
      </p>
      {text === null ? (
        <p className="mt-2 text-xs text-zinc-600">Loading…</p>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 font-mono text-xs text-zinc-300"
          />
          <p className="mt-1.5 text-[10px] text-zinc-600">
            Edit freely before sending -- nothing here is sent automatically.
          </p>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="mt-2 inline-flex min-h-9 items-center rounded-xl bg-violet-600 px-3 text-xs font-black text-white hover:bg-violet-500"
          >
            {copied ? "Copied ✓" : "Copy message"}
          </button>
        </>
      )}
    </div>
  );
}
