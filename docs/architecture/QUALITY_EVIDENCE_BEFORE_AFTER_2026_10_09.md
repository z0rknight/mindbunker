# Quality Evidence / Before–After — 09 Oct 2026

## Verdict

LOCAL GREEN. No deploy and no production write.

## Canonical ownership

`quality_evidence` is owned by one `video_logs` row. It represents explicit proof of transformation and contains only:

- `type`: `IMAGE_COMPARISON` or `AUDIO_COMPARISON`
- `label`
- explicit before and after references
- `visibility`: `INTERNAL_ONLY` or `CLIENT_SAFE`
- provenance and creation time

It is not a reusable Asset, approval, quality/value score, time record or billing fact. Media bytes remain in R2 (or an explicit HTTPS reference); D1 stores only references.

## Views

- Operator Video Workspace: complete and incomplete evidence, visibility and provenance.
- Authenticated Client Video: only complete `CLIENT_SAFE` pairs owned by the authenticated client's visible Video/Project.
- Image: one preserved-aspect-ratio viewport, draggable/keyboard vertical divider and before/after labels.
- Audio: one player, explicit Before/After state, no autoplay, with position/play-state preservation when the alternate media duration permits it.

Media is served through authenticated routes. The client projection never receives object keys, filesystem paths, internal IDs, provenance, Sessions, Sensor, Finance or private notes.

## Real dogfood

The local-only Geoff / Offer Doc fixture used the four real files from `/Volumes/VIDEO/Ambiente Dev Web/Outubro/09OCT-ANTES E DEPOIS/`:

- two 1920×1080 PNG color-correction frames;
- two 48 kHz stereo MP3 mixes, each 1,073.645333 seconds.

The normal authoring endpoint attached both explicit pairs as `CLIENT_SAFE`. Browser QA proved the operator slider and Audio A/B, then the same facts on the authenticated Client Video at desktop and 390×844. Unauthenticated media returned 401; another authenticated client returned 404. Exact QA D1 rows and the four local R2 objects were deleted after verification.

## Schema and gates

- Migration: `0059_quality_evidence.sql`, local only.
- Local migration head: `0059`; no pending migration.
- Focused tests: 13/13.
- Full suite: 1,637/1,637.
- Typecheck: GREEN.
- Production build: GREEN.
- Lint: 0 errors; 3 pre-existing warnings.
- D1: `foreign_key_check` empty; `quick_check` ok after exact cleanup.

## Production boundary

Production remains at its previously known authority. Migration 0059 was not applied remotely, no Worker was deployed and no production data or media changed. Promotion requires a separate authority-checked decision.
