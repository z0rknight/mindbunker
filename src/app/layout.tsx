import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "RMEDIA MindBunker",
  description: "Personal tracking dashboard for life metrics and professional performance",
  applicationName: "MindBunker",
  manifest: "/mindbunker/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MindBunker",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="bg-zinc-950 text-white min-h-dvh" data-intensity="operator">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
