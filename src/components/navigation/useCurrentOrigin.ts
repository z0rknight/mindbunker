"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { originPathFrom } from "@/utils/navigation";

/**
 * The page the operator is on RIGHT NOW (path + query, e.g. a Sessions week
 * view with its filters), as a validated internal `returnTo` for links that
 * open the Video Workspace from an inspection surface -- so closing the
 * workspace lands back on that exact view instead of the generic default.
 * Returns undefined (=> the workspace's normal default) if the current
 * location is not a safe/short internal path.
 */
export function useCurrentOrigin(): string | undefined {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return originPathFrom(pathname, search);
}
