# RMEDIA — Pré-Wave 1 Human QA Closeout

Date: 2026-10-07  
Verdict: **BLOCKED**  
Mode: human dogfood and read-only reconciliation; no corrective implementation

## Chronology and source authority

The intended chronology was:

1. Pré-Wave 1 closed as `GREEN — LOCAL CANDIDATE / NO DEPLOY`.
2. A later, separately authorized Taryn housekeeping release changed production.

That chronology is correct as an authorization sequence, but the deployed source is not isolated in the same way. Git ancestry proves:

- `ef42ed0` (MindBunker Pré-Wave implementation) is an ancestor of `9b94855`.
- `a3cca63` (Pré-Wave evidence closure) is an ancestor of `9b94855`.
- `9b94855` was the checkout deployed as Operator Worker `b74835a8-c22e-4243-bb02-98f65a016bc0` during the later housekeeping operation.

Therefore, the current production Worker contains both the Pré-Wave MindBunker changes and the later Taryn housekeeping changes. The statement “the Pré-Wave MindBunker candidate is still not deployed” cannot be certified from the deployed source. No rollback or corrective deploy was attempted because this QA explicitly prohibited deployment.

The native RMEDIA candidate remained separate and was tested from:

- path: `mindbunker-sensor-release/build/RMEDIA.app`
- source commit: `25546fd`
- executable SHA-256: `69978acc06c375eac7f21058a9de63a390e69b6df4406246d30ee06e0065a419`

## Proven in human use

### FACT — normal launch and current reality

- The exact candidate executable launched under Emmanuel's normal macOS user context.
- Home correctly showed no active canonical Work Session.
- The current catalog exposed both `Offer Doc` and `Front Door Video 11` under Taryn DFY / Project 19.
- Relaunch preserved existing Quick Note content and recovered the observation timeline.
- The candidate remained connected to the established production endpoint; no credential was recreated or replaced.

### FACT — canonical production truth

Read-only D1 queries returned zero writes and proved:

- no Work Session is currently open;
- Offer Doc (Video 86) remains `IN_PROGRESS`, Project 19, operational Client 12, visible to client;
- Offer Doc has one closed canonical Session totaling 5,423 seconds;
- Capture 8 occurred at `1791338376` and was recorded at `1791338377`;
- Capture 8 resolves to Session 105 → Offer Doc → Project 19 → Taryn DFY;
- none of Captures 3–10 has been falsely promoted to Client, Project, Video, or Work Session.

This confirms that End Session did not finish the Video, occurred-at remains distinct from ingestion, and the canonical relationship chain is intact.

## Real frictions found

### UX FRICTION — Notes entry is not discoverable as designed

The candidate source defines a direct `Notes` action in the Home header. In the actual running candidate, only the ellipsis menu appeared. Notes could be reached only through `More → Timeline → Notes`.

This obstructed the exact workflow the candidate was meant to improve and occurred in real use. Canonical owner: RMEDIA App navigation.

### UX FRICTION — note trust signals are absent

The two visible notes have `sync_status = SYNCED` and `canonical_work_session_id = 106` in local SQLite. The human Notes list showed time, text, and app only; it did not show `Synced` or `Session 106`.

This prevents the operator from answering whether the note was synchronized and which canonical Session received it. Canonical owner: RMEDIA App Notes projection.

### UX FRICTION — candidate and installed app co-launch

The separate candidate and installed RMEDIA app share `com.rmedia.mindbunker-sensor`. Launching the candidate repeatedly resulted in both binaries running. The installed app's older Home could become the inspected window, making the candidate appear to lack its changes for the wrong reason. Exact PID/path inspection and termination of only the installed binary were required.

Canonical owner: native release/candidate packaging and launch procedure.

### DATA GAP — full real editing journey not observed in this closeout

No synthetic Offer Doc Session was created merely to satisfy a gate. The operator was not actively editing in Premiere during the controlled pass, so a new Start → ACTIVE → meaningful Quick Capture → End journey was not produced.

### NOT A BUG — browser QA unavailable

The in-app browser has a saved permission that blocks `emmanueldarosa.com`. This prevented a fresh human visual pass of the MindBunker RMEDIA Quick Captures page. The D1 facts and code lineage were still inspectable, but the browser limitation is not evidence of a product defect.

## Candidate Wave 1 items

Only three items satisfy the promotion test from this dogfood:

1. Make the direct Notes entry actually render and remain keyboard/accessibility discoverable in the RMEDIA Home header.
2. Make every Notes row render its real sync state and canonical Session association when present.
3. Make candidate launch identity unambiguous so human QA cannot silently open or co-run the installed binary.

Each occurred in real use, obstructed trust or navigation, has one canonical owner, duplicates no business truth, and reduces cognitive load.

## Needs more evidence

- Start → ACTIVE → End during real Offer Doc editing.
- A new meaningful capture during structural lock, phase change, substantial rework, creative signal, review, or delivery.
- Pending, Failed, and Local-only note states in natural operation.
- Whether internal work requires a new execution target rather than the existing Project/Video workaround.
- Whether the proposed editorial phases repeat across more than one real video.
- Fresh human visual validation of the MindBunker Quick Captures page.

## Explicitly deferred

- Any code fix during dogfood.
- Schema or migration changes.
- Candidate deploy, corrective deploy, or rollback.
- Synthetic Offer Doc work Sessions or fake editing captures.
- Automatic promotion of captures into backlog or business entities.
- Universal execution entity, permanent editorial-phase schema, and permanent metrics.

## Exit reason

The closeout is BLOCKED because the candidate fails its central human Notes discoverability/trust gates and because deployed source authority contradicts the required non-deployed premise. Production data integrity is green; human candidate readiness is not.
