import type { Metadata } from "next";
import { RequestResetForm } from "./RequestResetForm";

// No per-request personalized data is read server-side here today, but
// this is an auth-adjacent surface (submits directly into the password
// reset flow) -- kept explicitly dynamic for consistency with every other
// page under /client and to leave no ambiguity for a future edit that adds
// a server-side read here.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset Password | RMEDIA",
  robots: { index: false, follow: false },
};

export default function ClientResetRequestPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-zinc-950 px-4 py-10 text-white sm:px-6">
      <section className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-8">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Reset your password</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
          Enter the email your portal access is set up with.
        </p>
        <RequestResetForm />
      </section>
    </main>
  );
}
