"use client";

import {
  importInstagramProfile,
  saveInstagramProfile,
} from "@/modules/crm/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const fieldClassName =
  "min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950/70 px-3.5 text-base text-white outline-none transition focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/10";

export function InstagramProfileCard({
  clientId,
  initialUsername,
  initialBio,
  initialPhotoUrl,
  importConfigured,
}: {
  clientId: number;
  initialUsername: string | null;
  initialBio: string | null;
  initialPhotoUrl: string | null;
  importConfigured: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [username, setUsername] = useState(initialUsername ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl ?? "");
  const [feedback, setFeedback] = useState("");
  const [imageFailed, setImageFailed] = useState(false);

  function applyProfile(profile: {
    username: string;
    biography: string | null;
    profilePictureUrl: string | null;
  }) {
    setUsername(profile.username);
    setBio(profile.biography ?? "");
    setPhotoUrl(profile.profilePictureUrl ?? "");
    setImageFailed(false);
    router.refresh();
  }

  function save() {
    setFeedback("");
    startTransition(async () => {
      const result = await saveInstagramProfile(clientId, {
        username,
        biography: bio,
        profilePictureUrl: photoUrl,
      });
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      applyProfile(result.profile);
      setFeedback("Instagram profile saved.");
    });
  }

  function importProfile() {
    setFeedback("");
    startTransition(async () => {
      const result = await importInstagramProfile(clientId, username);
      if (!result.success) {
        setFeedback(result.error);
        return;
      }
      applyProfile(result.profile);
      setFeedback("Bio and photo imported from Instagram.");
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/10 via-zinc-900 to-orange-500/5">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-zinc-800 text-xl font-black text-zinc-500">
            {photoUrl && !imageFailed ? (
              // Instagram CDN hosts vary; the HTTPS URL is validated server-side.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={`@${username || "instagram"}`} className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
            ) : (
              "IG"
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300">Instagram lead context</p>
            <h3 className="mt-1 truncate text-lg font-black text-white">
              {username ? `@${username}` : "No profile linked"}
            </h3>
            {bio && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-5 text-zinc-400">{bio}</p>}
          </div>
          {username && (
            <a href={`https://www.instagram.com/${username}/`} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300">
              Open ↗
            </a>
          )}
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <label htmlFor="leadInstagramUsername" className="mb-1 block text-xs font-bold text-zinc-500">Username or profile URL</label>
            <input id="leadInstagramUsername" value={username} onChange={(event) => setUsername(event.target.value)} maxLength={120} autoCapitalize="none" autoCorrect="off" placeholder="@username" className={fieldClassName} />
          </div>
          <div>
            <label htmlFor="leadInstagramBio" className="mb-1 block text-xs font-bold text-zinc-500">Bio</label>
            <textarea id="leadInstagramBio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={2_200} rows={3} placeholder="Imported or manually pasted bio…" className={`${fieldClassName} py-3`} />
          </div>
          <details className="rounded-xl border border-zinc-800 bg-zinc-950/30 px-3.5 py-3">
            <summary className="cursor-pointer text-xs font-bold text-zinc-500">Profile photo URL</summary>
            <input value={photoUrl} onChange={(event) => { setPhotoUrl(event.target.value); setImageFailed(false); }} inputMode="url" placeholder="https://…" className={`${fieldClassName} mt-3`} />
          </details>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={save} disabled={isPending || !username.trim()} className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-black text-zinc-200 disabled:opacity-40">
              {isPending ? "Saving…" : "Save manually"}
            </button>
            <button type="button" onClick={importProfile} disabled={isPending || !username.trim() || !importConfigured} className="min-h-12 rounded-xl bg-gradient-to-r from-fuchsia-700 to-orange-700 px-4 text-sm font-black text-white disabled:opacity-40">
              Import bio + photo
            </button>
          </div>
          {!importConfigured && (
            <p className="text-xs leading-5 text-zinc-600">
              Automatic import is ready for Meta Business Discovery, but the Meta connection is not authorized yet. Manual save works now.
            </p>
          )}
          <p className="text-[11px] leading-5 text-zinc-600">
            Official import supports discoverable Business/Creator profiles. Personal accounts can be saved manually; no scraping is used.
          </p>
          {feedback && <p aria-live="polite" className={`text-sm ${feedback.includes("saved") || feedback.includes("imported") ? "text-emerald-300" : "text-amber-300"}`}>{feedback}</p>}
        </div>
      </div>
    </section>
  );
}
