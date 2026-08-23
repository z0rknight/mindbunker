import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { isClientAuthenticated } from "@/lib/client-portal-session";
import { ClientLoginForm } from "./LoginForm";

// Reads the client session cookie to decide whether to redirect an
// already-logged-in visitor -- see the note on dashboard/page.tsx.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client Login | RMEDIA",
  robots: { index: false, follow: false },
};

export default async function ClientLoginPage() {
  const clientId = await isClientAuthenticated();
  if (clientId !== false) {
    redirect("/client/dashboard");
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-zinc-950 px-4 py-10 text-white sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 50% -10%, rgba(124,58,237,.26), transparent 38%), radial-gradient(circle at 100% 100%, rgba(8,145,178,.10), transparent 32%)",
        }}
      />

      <section className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-8">
        <div className="mb-7 flex items-center justify-between">
          <Image
            src="/mindbunker/mindbunker-access-logo.svg"
            alt="RMEDIA"
            width={560}
            height={144}
            priority
            className="h-auto w-44 max-w-[65%]"
          />
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-900 bg-violet-950/70 text-base shadow-inner shadow-violet-950">
            🎬
          </span>
        </div>

        <div className="border-t border-zinc-800 pt-7">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            Your client portal.
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
            See what RMEDIA is producing for you, review what&apos;s ready, and revisit past deliveries.
          </p>
        </div>

        <ClientLoginForm />
      </section>
    </main>
  );
}
