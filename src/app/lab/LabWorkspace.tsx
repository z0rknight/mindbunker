"use client";

import { useState } from "react";
import { VideoWorkbench } from "./VideoWorkbench";
import { QuickCapturePanel } from "./QuickCapturePanel";

type VideoOption = { id: number; title: string; clientName: string | null; projectName: string | null };

// Shared `videoId` selection state for Workbench + Quick Capture, so
// selecting a video once in the Workbench is inherited by Quick Capture --
// the context-inheritance requirement from Wave 2J.
export function LabWorkspace({ videos }: { videos: VideoOption[] }) {
  const [videoId, setVideoId] = useState("");
  return (
    <div className="space-y-4">
      <VideoWorkbench videos={videos} videoId={videoId} onVideoIdChange={setVideoId} />
      <QuickCapturePanel videos={videos} videoId={videoId} />
    </div>
  );
}
