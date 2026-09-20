"use server";

import { getProductionContextForVideo, type VideoProductionContext } from "./data";

// Read-only server action for the Video Workspace panel. The video's own row
// decides which batch/project/client facts are returned (never a caller-
// supplied id for those), and getProductionContextForVideo authenticates.
export async function getVideoProductionContext(
  videoId: number,
): Promise<{ success: true; data: VideoProductionContext } | { success: false }> {
  if (!Number.isInteger(videoId) || videoId <= 0) return { success: false };
  const data = await getProductionContextForVideo(videoId);
  return data ? { success: true, data } : { success: false };
}
