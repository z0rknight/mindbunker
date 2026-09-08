"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileQuickCapture } from "@/components/ui/MobileQuickCapture";
import { QuickCaptureProvider } from "@/components/quick-capture/QuickCaptureProvider";
import { classifyAppShellRoute } from "@/lib/route-classification";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isBareShellRoute } = classifyAppShellRoute(pathname);

  if (isBareShellRoute) {
    return <>{children}</>;
  }

  return (
    <QuickCaptureProvider>
      <div className="flex min-h-dvh">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-auto pt-16 pb-36 md:pt-0 md:pb-0">
          {children}
          {/* FX + Business Operating Cash Patch §14: discreet, not branding --
              small/muted/lowercase, one line, no logo, no links. */}
          <p className="px-4 py-6 text-center text-[10px] text-zinc-800 sm:px-6 md:px-8">
            software made by emmanuel for emmanuel
          </p>
        </main>
        <MobileQuickCapture />
      </div>
    </QuickCaptureProvider>
  );
}
