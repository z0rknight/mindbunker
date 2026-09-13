import type { ReactNode } from "react";

export type PixelIconName =
  | "archive"
  | "flag"
  | "grip"
  | "project"
  | "shield"
  | "signal"
  | "stack"
  | "video";

const PIXELS: Record<PixelIconName, Array<[number, number, number, number]>> = {
  archive: [[2, 3, 12, 3], [3, 6, 10, 8], [6, 8, 4, 2]],
  flag: [[3, 2, 2, 12], [5, 3, 8, 6], [2, 13, 7, 2]],
  grip: [[3, 3, 3, 3], [10, 3, 3, 3], [3, 10, 3, 3], [10, 10, 3, 3]],
  project: [[2, 4, 5, 3], [2, 7, 12, 7], [7, 5, 7, 2]],
  shield: [[3, 2, 10, 3], [2, 5, 12, 5], [4, 10, 8, 3], [7, 13, 2, 2]],
  signal: [[7, 7, 2, 2], [4, 5, 2, 6], [10, 5, 2, 6], [1, 2, 2, 12], [13, 2, 2, 12]],
  stack: [[2, 3, 10, 3], [4, 7, 10, 3], [2, 11, 10, 3]],
  video: [[2, 3, 9, 10], [11, 6, 3, 4], [4, 5, 5, 2], [4, 9, 5, 2]],
};

export function PixelIcon({
  name,
  className = "h-4 w-4",
  label,
}: {
  name: PixelIconName;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      shapeRendering="crispEdges"
      fill="currentColor"
    >
      {PIXELS[name].map(([x, y, width, height], index) => (
        <rect key={`${name}-${index}`} x={x} y={y} width={width} height={height} />
      ))}
    </svg>
  );
}

export function PixelFrame({
  children,
  className = "",
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "live" | "attention" | "client";
}) {
  return <div className={`pixel-frame pixel-frame-${tone} ${className}`}>{children}</div>;
}

export function PixelDivider({ label, icon }: { label: string; icon?: PixelIconName }) {
  return (
    <div className="pixel-divider">
      {icon && <PixelIcon name={icon} className="h-3.5 w-3.5" />}
      <span>{label}</span>
      <i aria-hidden="true" />
    </div>
  );
}

export function LiveIndicator({ label = "LIVE" }: { label?: string }) {
  return (
    <span className="mb-live-indicator">
      <span className="mb-live-pulse" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function PixelEmptyState({
  icon,
  title,
  children,
  className = "",
}: {
  icon: PixelIconName;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`pixel-empty-state ${className}`}>
      <span className="pixel-empty-state-icon"><PixelIcon name={icon} className="h-6 w-6" /></span>
      <p className="pixel-empty-state-title">{title}</p>
      {children && <div className="pixel-empty-state-copy">{children}</div>}
    </div>
  );
}
