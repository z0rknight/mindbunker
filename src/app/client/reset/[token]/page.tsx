import type { Metadata } from "next";
import { CompleteResetForm } from "./CompleteResetForm";

// Same reasoning as src/app/client/reset/page.tsx.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset Password | RMEDIA",
  robots: { index: false, follow: false },
};

export default async function ClientResetTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-zinc-950 px-4 py-10 text-white sm:px-6">
      <section className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-8">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Set a new password</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
          Choose a new password for your RMEDIA portal.
        </p>
        <CompleteResetForm token={token} />
      </section>
    </main>
  );
}
