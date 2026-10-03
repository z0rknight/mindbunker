import { redirect } from "next/navigation";
import { isSafeInternalPath } from "@/utils/navigation";
import { videoWorkspaceHref } from "@/modules/productivity/core";

/** Wave 3 compatibility boundary: Productivity is no longer an execution surface. */
export default async function ProductivityCompatibilityPage({
  searchParams,
}: {
  searchParams: Promise<{
    video?: string | string[];
    planVideo?: string | string[];
    projectId?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const rawVideo = query.video;
  const returnTo =
    typeof query.returnTo === "string" && isSafeInternalPath(query.returnTo)
      ? query.returnTo
      : undefined;

  if (typeof rawVideo === "string" && /^\d+$/u.test(rawVideo)) {
    redirect(videoWorkspaceHref(Number(rawVideo), returnTo));
  }

  const next = new URLSearchParams();
  if (query.planVideo === "1") next.set("planVideo", "1");
  if (typeof query.projectId === "string" && /^\d+$/u.test(query.projectId)) {
    next.set("projectId", query.projectId);
  }
  if (rawVideo !== undefined) next.set("workspaceError", "invalid-video");
  redirect(next.size > 0 ? `/war-room?${next.toString()}` : "/war-room");
}
