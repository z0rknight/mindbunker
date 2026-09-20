import type { Rail } from "@/lib/os/evidence-rail";

/**
 * A composition rail for quantitative evidence: how a whole (registered time,
 * session time) splits into known parts and an explicit UNKNOWN/unallocated part.
 * Provenance is drawn three ways that survive greyscale (solid fact, hatched
 * derived, dashed-empty unknown) and every part is named with its exact value in
 * the legend. The rail is an `img` with a plain-text summary; the legend repeats
 * the values visibly. Segment widths transition only when the server later sends
 * different values (never animated on first paint). An over-allocated total is
 * shown and flagged, not clipped.
 */
export function EvidenceRail({ rail, legend = true }: { rail: Rail; legend?: boolean }) {
  return (
    <div className="os-evidence" data-over={rail.overAllocated ? "true" : undefined}>
      <div className="os-rail" role="img" aria-label={rail.summary}>
        {rail.segments.map((segment) => (
          <span
            key={segment.key}
            className="os-rail-seg"
            data-source={segment.source}
            data-emphasis={segment.emphasis ? "true" : undefined}
            data-tone={segment.tone}
            data-empty={segment.value <= 0 ? "true" : undefined}
            style={{ "--w": segment.pct.toFixed(2) } as React.CSSProperties}
          />
        ))}
      </div>
      {legend && (
        <ul className="os-rail-legend" aria-hidden="true">
          {rail.segments.map((segment) => (
            <li key={segment.key} data-source={segment.source}>
              <i data-source={segment.source} data-emphasis={segment.emphasis ? "true" : undefined} data-tone={segment.tone} />
              {segment.label} <b>{segment.display}</b>
              {segment.source === "derived" && <span> · derived</span>}
              {segment.source === "unknown" && <span> · unknown</span>}
            </li>
          ))}
        </ul>
      )}
      {rail.overAllocated && (
        <p className="os-rail-warn">Parts add up to more than the total; shown as recorded, not clipped.</p>
      )}
    </div>
  );
}
