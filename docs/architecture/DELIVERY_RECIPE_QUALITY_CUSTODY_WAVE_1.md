# Delivery Recipe / Quality Custody — Wave 1

Date: 2026-10-08
State: local candidate; production remains on migration 0056
Source baseline: `91d8710669b0636dca1e23462ae65501132ae04f`

## Question

Can RMEDIA prove how one real Video moves from source to review through a minimum quality standard, with negligible tracking friction?

The implementation is technically proven. The real-edit dogfood gate remains intentionally open; synthetic QA is not promoted to operational evidence.

## Archaeology

### Reuse

- `video_logs` remains the canonical deliverable.
- `work_sessions` remains the only authority for intentional worked time.
- `revisions` and the existing Video lifecycle/review URLs remain review authority.
- Video Workspace remains the operator surface.
- Client Video Detail remains the client-safe surface.
- Existing timestamp/provenance conventions informed the Recipe transition event.

### Gap

The legacy `production_checklist_items` model is a fixed eight-step list with only `NOT_STARTED / DONE / NOT_REQUIRED`. It has no reusable template, no `ACTIVE` state, no immutable execution snapshot and no event history. It remains readable under Advanced / history and is not backfilled or reinterpreted.

### Do not touch

No changes were made to Work Sessions, Sensor, Quick Capture, Pricing/Quotes, Video lifecycle, review/revisions, authentication, CRM reset data or the native RMEDIA App.

## Canonical model

- `delivery_recipes`: reusable template identity and applicability.
- `delivery_recipe_steps`: ordered, enabled/disabled template steps classified under the five broad quality gates.
- `video_recipe_instances`: one current Recipe attached to a Video, with the Recipe name snapshotted.
- `video_recipe_instance_steps`: immutable-at-instantiation step label/gate/order/standard plus current state.
- `delivery_recipe_events`: append-only transition evidence with Video, instance, step, previous/new state, `occurred_at`, actor, source and provenance.

Allowed truthful transitions:

```text
NOT_STARTED → ACTIVE → DONE
NOT_STARTED / ACTIVE → N_A
DONE → ACTIVE
N_A → NOT_STARTED
```

Only one step may be `ACTIVE` at once. Completed and archived Videos are read-only. Template changes never rewrite an existing Video snapshot.

## Operator projection

The Video Workspace shows the attached Recipe, progress, current/next step, one-click transitions, optional N/A, recent transition history and canonical total Session time. It explicitly reports stage time as `UNKNOWN`; Recipe timestamps are never treated as labor duration.

Template management at `/recipes` supports creation, ordered steps, enable/disable and reuse. It deliberately omits workflow graphs, automation, AI quality scoring and a task-manager abstraction.

## Client projection

The client sees only:

```text
Editing
Finishing
Quality review
Ready for you
```

Internal step names, quality standards, transition history, Work Sessions and Sensor evidence never cross the client boundary. Review actions remain owned by the existing Video review lifecycle.

## Proof

- Targeted contracts: 11/11.
- Full canonical suite: 1,605/1,605 after final guarded-transition coverage.
- Typecheck: GREEN.
- Production build: GREEN.
- Lint: 0 errors; 3 pre-existing warnings.
- Isolated D1 `0000 → 0057`: GREEN.
- Production-shaped `0056 → 0057`: GREEN.
- `PRAGMA foreign_key_check`: zero rows.
- `PRAGMA quick_check`: `ok`.
- Authenticated local HTTP: `/recipes` 200; Video Workspace 200; client Video detail 200.
- Client projection runtime leak check: no internal step labels, standards, Sessions or Sensor data.
- Exact local QA fixture removed; all scoped counts returned to zero and integrity remained GREEN.
- Browser visual automation unavailable because the saved client preference blocked localhost; no alternate-browser/CDP bypass was attempted.

## Open gate

One real active Video must still be attached to a real Recipe and naturally progress during editing, including a reopen only if actual rework occurs. This is the only acceptable proof of negligible tracking friction.

No deploy and no production migration were performed.
