export type VideoInputValues = {
  title: string;
  projectId?: number | null;
  clientId?: number | null;
  notes?: string;
};

type VideoInputResult =
  | {
      success: true;
      data: {
        title: string;
        projectId: number | null;
        clientId: number | null;
        notes: string | null;
      };
    }
  | { success: false; error: string };

export function isPositiveId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function optionalId(value: unknown) {
  return value === null || value === undefined || value === ""
    ? null
    : isPositiveId(value)
      ? value
      : undefined;
}

export function validateVideoInput(values: VideoInputValues): VideoInputResult {
  const title = typeof values.title === "string"
    ? values.title.trim().slice(0, 180)
    : "";
  if (!title) return { success: false, error: "Video name is required." };

  const projectId = optionalId(values.projectId);
  const clientId = optionalId(values.clientId);
  if (projectId === undefined || clientId === undefined) {
    return { success: false, error: "Choose a valid project or client." };
  }

  const notes = typeof values.notes === "string"
    ? values.notes.trim().slice(0, 2_000) || null
    : null;
  return {
    success: true,
    data: { title, projectId, clientId, notes },
  };
}
