import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/app/login/LoginForm";

export const metadata: Metadata = {
  title: "Acesso privado | MindBunker",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
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
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <section className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-8">
        <div className="mb-7 flex items-center justify-between">
          <Image
            src="/mindbunker/mindbunker-access-logo.svg"
            alt="MindBunker RMEDIA"
            width={560}
            height={144}
            priority
            className="h-auto w-52 max-w-[72%]"
          />
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-900 bg-emerald-950/70 text-base shadow-inner shadow-emerald-950">
            🔒
          </span>
        </div>

        <div className="border-t border-zinc-800 pt-7">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,.8)]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">
              Área privada protegida
            </p>
          </div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            Bem-vindo ao seu bunker.
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
            Seus clientes, finanças e registros pessoais ficam atrás desta porta.
          </p>
        </div>

        <LoginForm />

        <div className="mt-6 flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-3.5 py-3">
          <span className="text-lg" aria-hidden="true">⌁</span>
          <p className="text-xs leading-5 text-zinc-500">
            Salve a senha no iPhone para entrar com Face ID. A sessão permanece protegida por 30 dias.
          </p>
        </div>
      </section>

      <p className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-700">
        RMEDIA · Single-user mode
      </p>
    </main>
  );
}
