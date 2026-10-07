export type CaptureEvidenceInput = {
  source: string;
  localCaptureId: string | null;
  contextSnapshotJson: string | null;
  canonicalWorkSessionId: number | null;
  startedAt: Date | null;
  createdAt: Date | null;
};

export type RmediaCaptureEvidence = {
  occurredAt: Date | null;
  recordedAt: Date | null;
  canonicalWorkSessionId: number | null;
  videoId: number | null;
  videoTitle: string | null;
  projectName: string | null;
  clientName: string | null;
  observedApplication: string | null;
  integrityIssues: string[];
};

export function isRmediaQuickCapture(
  capture: Pick<CaptureEvidenceInput, "source" | "localCaptureId">,
) {
  return capture.source === "MAC_SENSOR" && Boolean(capture.localCaptureId);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean.length > 0 ? clean : null;
}

function positiveInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function integrityIssues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(text).filter((item): item is string => item !== null))];
}

/**
 * Read-only projection of the immutable Context Snapshot carried by a native
 * RMEDIA Quick Capture. It never promotes a Capture or treats observed app
 * context as intentional work. The canonical Session FK remains authoritative;
 * snapshot identity is only a fallback for legacy/local evidence display.
 */
export function projectRmediaCaptureEvidence(
  capture: CaptureEvidenceInput,
): RmediaCaptureEvidence | null {
  if (!isRmediaQuickCapture(capture)) return null;

  let snapshot: Record<string, unknown> | null = null;
  if (capture.contextSnapshotJson) {
    try {
      snapshot = record(JSON.parse(capture.contextSnapshotJson));
    } catch {
      snapshot = null;
    }
  }
  const execution = record(snapshot?.canonicalExecution);

  return {
    occurredAt: capture.startedAt,
    recordedAt: capture.createdAt,
    canonicalWorkSessionId:
      capture.canonicalWorkSessionId ?? positiveInteger(execution?.workSessionID),
    videoId: positiveInteger(execution?.videoID),
    videoTitle: text(execution?.videoTitle),
    projectName: text(execution?.projectName),
    clientName: text(execution?.clientName),
    observedApplication:
      text(snapshot?.normalizedApplication) ?? text(snapshot?.foregroundApplication),
    integrityIssues: integrityIssues(snapshot?.integrityIssues),
  };
}
