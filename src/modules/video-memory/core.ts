export const VIDEO_OPERATIONAL_NOTE_EVENT_TYPE = "video.note_added";
export const VIDEO_OPERATIONAL_NOTE_MAX_LENGTH = 2_000;
export const VIDEO_OPERATIONAL_MEMORY_DELETE_ERROR =
  "Videos with operational memory cannot be deleted.";

export type VideoOperationalMemoryEntry = {
  id: number;
  body: string;
  createdAt: string;
};

export function isVideoMemoryVideoId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

export function validateVideoOperationalNote(value: unknown) {
  if (typeof value !== "string") {
    return { success: false as const, error: "Write a note first." };
  }
  const body = value.trim();
  if (!body) {
    return { success: false as const, error: "Write a note first." };
  }
  if (body.length > VIDEO_OPERATIONAL_NOTE_MAX_LENGTH) {
    return {
      success: false as const,
      error: `Keep the note under ${VIDEO_OPERATIONAL_NOTE_MAX_LENGTH.toLocaleString("en-US")} characters.`,
    };
  }
  return { success: true as const, body };
}

export function newestVideoMemoryFirst(
  entries: readonly VideoOperationalMemoryEntry[],
) {
  return [...entries].sort((a, b) => {
    const timestampOrder = b.createdAt.localeCompare(a.createdAt);
    return timestampOrder || b.id - a.id;
  });
}

export function videoOperationalMemoryBlocksDeletion(eventCount: number) {
  return Number.isSafeInteger(eventCount) && eventCount > 0;
}
