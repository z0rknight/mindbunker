"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileQuickCapture } from "@/components/ui/MobileQuickCapture";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const normalizedPath = pathname.startsWith("/mindbunker")
    ? pathname.slice("/mindbunker".length) || "/"
    : pathname;
  const isLogin = normalizedPath === "/login";
  const isPublicGateway = normalizedPath.startsWith("/g/");

  if (isLogin || isPublicGateway) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto pt-16 pb-36 md:pt-0 md:pb-0">
        {children}
      </main>
      <MobileQuickCapture />
    </div>
  );
}
