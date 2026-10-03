"use client";

import {
  ENTITY_INSPECTION_QUERY_PARAM,
  inspectableEntityFromHref,
  parseEntityReference,
  serializeEntityReference,
  type InspectableEntity,
} from "@/lib/entity-navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EntityDrawerHost } from "./EntityDrawerHost";

type EntityDrawerContextValue = {
  entity: InspectableEntity | null;
  openEntity: (entity: InspectableEntity, trigger?: HTMLElement | null) => void;
  closeEntity: (mode?: "history" | "replace") => void;
};

const EntityDrawerContext = createContext<EntityDrawerContextValue | null>(null);
const HISTORY_MARKER = "__mindbunkerEntityInspection";

function entityFromLocation(): InspectableEntity | null {
  if (typeof window === "undefined") return null;
  return parseEntityReference(new URL(window.location.href).searchParams.get(ENTITY_INSPECTION_QUERY_PARAM));
}

function urlWithoutInspection(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete(ENTITY_INSPECTION_QUERY_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function EntityDrawerProvider({ children }: { children: ReactNode }) {
  const [entity, setEntity] = useState<InspectableEntity | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const previousEntityRef = useRef<InspectableEntity | null>(null);

  useEffect(() => {
    const initialSync = window.setTimeout(() => setEntity(entityFromLocation()), 0);
    function syncFromHistory() {
      setEntity(entityFromLocation());
    }
    window.addEventListener("popstate", syncFromHistory);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener("popstate", syncFromHistory);
    };
  }, []);

  useEffect(() => {
    if (previousEntityRef.current && !entity) {
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    }
    previousEntityRef.current = entity;
  }, [entity]);

  const openEntity = useCallback((next: InspectableEntity, trigger?: HTMLElement | null) => {
    const url = new URL(window.location.href);
    url.searchParams.set(ENTITY_INSPECTION_QUERY_PARAM, serializeEntityReference(next));
    const destination = `${url.pathname}${url.search}${url.hash}`;
    if (!entity) {
      triggerRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    }
    const nextState = { ...(window.history.state ?? {}), [HISTORY_MARKER]: true };
    if (entity) window.history.replaceState(nextState, "", destination);
    else window.history.pushState(nextState, "", destination);
    setEntity(next);
  }, [entity]);

  const closeEntity = useCallback((mode: "history" | "replace" = "history") => {
    const ownsHistoryEntry = Boolean(window.history.state?.[HISTORY_MARKER]);
    if (mode === "history" && ownsHistoryEntry) {
      window.history.back();
      return;
    }
    const nextState = { ...(window.history.state ?? {}) };
    delete nextState[HISTORY_MARKER];
    window.history.replaceState(nextState, "", urlWithoutInspection());
    setEntity(null);
  }, []);

  return (
    <EntityDrawerContext.Provider value={{ entity, openEntity, closeEntity }}>
      {children}
      <EntityDrawerHost />
    </EntityDrawerContext.Provider>
  );
}

export function useEntityInspection() {
  const context = useContext(EntityDrawerContext);
  if (!context) throw new Error("useEntityInspection must be used inside EntityDrawerProvider");
  return context;
}

export function EntityInspectionTrigger({
  entity,
  children,
  className,
  title,
  ariaLabel,
}: {
  entity: InspectableEntity;
  children: ReactNode;
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const { openEntity } = useEntityInspection();
  return (
    <button
      type="button"
      onClick={(event) => openEntity(entity, event.currentTarget)}
      className={className}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

export function EntityInspectionHrefTrigger({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const entity = inspectableEntityFromHref(href);
  const { openEntity } = useEntityInspection();
  if (!entity) return <a href={href} className={className}>{children}</a>;
  return (
    <button
      type="button"
      onClick={(event) => openEntity(entity, event.currentTarget)}
      className={className}
    >
      {children}
    </button>
  );
}
