import type { EvidenceSource } from "@/lib/os/evidence-rail";
import { barPercent } from "@/lib/os/evidence-rail";

/**
 * One labelled horizontal bar: name, a bar, and the EXACT value with units.
 * The value text carries the meaning (the bar is decorative, aria-hidden), so it
 * needs no hover and no colour. Width is set inline (no animation on first paint);
 * when the server later sends a different value the same element transitions from
 * its previous width. Neutral by default; `emphasis` (violet) is for the one
 * current/selected row. `source` draws provenance: solid fact, hatched derived
 * (label it in text too), dashed-empty unknown.
 */
export function DataBar({
  label,
  detail,
  value,
  max,
  display,
  source = "fact",
  emphasis = false,
}: {
  label: string;
  detail?: string;
  value: number;
  max: number;
  /** Pre-formatted exact value, units included ("2h 14m"). */
  display: string;
  source?: EvidenceSource;
  emphasis?: boolean;
}) {
  return (
    <div className="os-databar" data-source={source} data-emphasis={emphasis ? "true" : undefined}>
      <span className="os-databar-label">
        {label}
        {detail && <span className="os-databar-detail"> · {detail}</span>}
      </span>
      <span className="os-databar-track" aria-hidden="true">
        <i style={{ "--w": barPercent(value, max).toFixed(2) } as React.CSSProperties} />
      </span>
      <span className="os-databar-value">{display}</span>
    </div>
  );
}
