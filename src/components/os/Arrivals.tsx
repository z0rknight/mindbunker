"use client";

import { createContext, useContext, type ElementType, type ReactNode } from "react";
import { useArrivals } from "./hooks";
import { NewBadge } from "./NewBadge";

const ArrivalsContext = createContext<ReadonlySet<string>>(new Set());

/**
 * Tracks which ids of a server-rendered list ARRIVED after mount (across
 * revalidations). The initial list is never new; an arrival is marked for a few
 * seconds and then settles into normal hierarchy. Presentation only.
 */
export function ArrivalScope({ ids, children }: { ids: readonly string[]; children: ReactNode }) {
  const arrived = useArrivals(ids);
  return <ArrivalsContext.Provider value={arrived}>{children}</ArrivalsContext.Provider>;
}

/** True while `id` is inside its brief "new" window (for components that combine it with other feedback). */
export function useIsNew(id: string): boolean {
  return useContext(ArrivalsContext).has(id);
}

/** One list item inside an ArrivalScope: brief entrance, a NEW word and the brand edge while new. */
export function ArrivalItem({
  id,
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  id: string;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
} & Record<string, unknown>) {
  const isNew = useContext(ArrivalsContext).has(id);
  return (
    <Tag
      {...rest}
      className={className ? `os-flash os-arrive ${className}` : "os-flash os-arrive"}
      data-flash={isNew ? "brand" : undefined}
      data-enter={isNew ? "true" : undefined}
      data-new={isNew ? "true" : undefined}
    >
      {isNew && <NewBadge className="mr-2" />}
      {children}
    </Tag>
  );
}
