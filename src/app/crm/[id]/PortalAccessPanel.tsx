"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CANONICAL_CLIENT_PORTAL_LOGIN_URL } from "@/lib/auth-core";
import {
  revokeClientPortalPassword,
  setClientPortalPassword,
} from "@/modules/client-portal/actions";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function generatePassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "9")
    .replaceAll("/", "8")
    .replaceAll("=", "");
}

export function PortalAccessPanel({
  clientId,
  clientEmail,
  portalPasswordSetAt,
}: {
  clientId: number;
  clientEmail: string | null;
  portalPasswordSetAt: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);
  const hasAccess = Boolean(portalPasswordSetAt);

  function issueAccess() {
    setError("");
    setFeedback("");
    setIssuedPassword(null);
    if (!clientEmail) {
      setError("Add an email for this client first — it's how they'll log in.");
      return;
    }
    const password = generatePassword();
    startTransition(async () => {
      const result = await setClientPortalPassword(clientId, password);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setIssuedPassword(result.temporaryPassword ?? password);
      setFeedback(hasAccess ? "Portal password reset." : "Portal access enabled.");
      router.refresh();
    });
  }

  function revoke() {
    if (!confirm("Revoke this client's portal login? They'll immediately lose access, even if they're logged in right now.")) {
      return;
    }
    setError("");
    setFeedback("");
    setIssuedPassword(null);
    startTransition(async () => {
      const result = await revokeClientPortalPassword(clientId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setFeedback(result.message);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Client Portal Access</p>
          <p className="mt-1 text-sm text-zinc-300">
            {hasAccess
              ? `Active since ${formatDate(portalPasswordSetAt) ?? "an earlier date"}`
              : "No persistent login set up yet — the client can still use a Vault link."}
          </p>
        </div>
        <div className="flex gap-2">
          {/* CRM CONTROL PLANE MIGRATION (Sep 2026): plain absolute <a>,
              deliberately not next/link's <Link> -- this page renders on
              the operator Worker (basePath "/mindbunker"), and Link
              rewrites every relative href with the CURRENT build's
              basePath before the browser ever sees it (verified in
              next/dist/client/link.js), which is exactly how this used to
              silently open the obsolete /mindbunker/client/login instead
              of the canonical public portal. target="_blank" matches the
              "↗" affordance already in the label -- opening the portal
              was always meant to leave the operator's CRM session alone,
              not navigate away from it. */}
          <a
            href={CANONICAL_CLIENT_PORTAL_LOGIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center rounded-xl border border-zinc-700 px-3.5 text-xs font-black text-zinc-300 transition hover:bg-zinc-800"
          >
            Open client login ↗
          </a>
          <button
            type="button"
            onClick={issueAccess}
            disabled={isPending}
            className="min-h-10 rounded-xl bg-violet-600 px-3.5 text-xs font-black text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {hasAccess ? "Reset password" : "Enable portal login"}
          </button>
          {hasAccess && (
            <button
              type="button"
              onClick={revoke}
              disabled={isPending}
              className="min-h-10 rounded-xl border border-red-900/60 bg-red-950/30 px-3.5 text-xs font-black text-red-300 transition hover:bg-red-950/50 disabled:opacity-50"
            >
              Revoke
            </button>
          )}
        </div>
      </div>

      {issuedPassword && (
        <div className="mt-3 rounded-xl border border-amber-900/70 bg-amber-950/30 px-3.5 py-3 text-xs leading-5 text-amber-200">
          <p className="mb-1 font-black uppercase tracking-widest text-amber-300">
            Share this with the client now — it won&apos;t be shown again
          </p>
          <p>
            Email: <span className="font-mono">{clientEmail}</span>
          </p>
          <p>
            Password: <span className="font-mono">{issuedPassword}</span>
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      {!error && feedback && !issuedPassword && (
        <p className="mt-2 text-xs text-emerald-300">{feedback}</p>
      )}
    </section>
  );
}
