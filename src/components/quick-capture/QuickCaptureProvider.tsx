"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { QuickCaptureModal } from "./QuickCaptureModal";

// P0.5 (Tuesday Reality & Usability Patch): global Quick Capture. A
// convenience layer over already-canonical actions (createVideoCommitment,
// recordDetailedRevision, openVideoBlocker, updateOpportunity,
// addVideoOperationalNote, startWorkSession, reorderExecutionQueueItem) --
// no new write paths, no AI parsing, no second follow-up/task model. See
// QuickCaptureModal for the action list itself.
export type QuickCaptureTarget = {
  clientId?: number;
  clientName?: string;
  projectId?: number;
  projectName?: string;
  videoId?: number;
  videoTitle?: string;
};

type QuickCaptureContextValue = {
  open: (target?: QuickCaptureTarget) => void;
};

const QuickCaptureContext = createContext<QuickCaptureContextValue | null>(null);

// Context inheritance (Tuesday Patch instruction): a surface that already
// knows its client/project/video (e.g. an Execution Queue row) calls
// open({ clientId, clientName, projectId, projectName, videoId, videoTitle })
// so the modal never re-asks for what's already on screen. The global
// Cmd/Ctrl+K trigger calls open() with no target -- each action's own form
// then asks for a target the normal way (same cascading picker
// StartWorkButton already uses).
export function useQuickCapture() {
  const ctx = useContext(QuickCaptureContext);
  if (!ctx) {
    throw new Error("useQuickCapture must be used within QuickCaptureProvider");
  }
  return ctx;
}

export function QuickCaptureProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [target, setTarget] = useState<QuickCaptureTarget | undefined>(undefined);

  const open = useCallback((next?: QuickCaptureTarget) => {
    setTarget(next);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);
      const modifierPressed = isMac ? event.metaKey : event.ctrlKey;
      if (modifierPressed && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setTarget(undefined);
        setIsOpen((current) => !current);
        return;
      }
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <QuickCaptureContext.Provider value={{ open }}>
      {children}
      {isOpen && <QuickCaptureModal target={target} onClose={close} />}
    </QuickCaptureContext.Provider>
  );
}
