# RMEDIA guided intake — local prototype

This is an isolated, static decision-model prototype for the proposed public
`/start` experience. It is deliberately under `docs/prototypes/`, not
`src/app/` or `public/`, so the Next/OpenNext production build cannot expose it
accidentally.

It has no API calls, Server Actions, database binding, analytics, cookies, or
production submission path. It writes unfinished answers only to browser
`sessionStorage` and removes them when the browser session ends.

## Run

From the repository root:

```sh
python3 -m http.server 4173
```

Open:

```text
http://127.0.0.1:4173/docs/prototypes/guided-intake/?ref=pdbm
```

## Validate the decision model

```sh
node --test docs/prototypes/guided-intake/model.test.mjs docs/prototypes/guided-intake/experience.test.mjs
```

The test cases cover a defined project, repeatable production, pilot/setup,
flexible collaboration, human review, and the key evidence-backed
counterexample: several known pieces may be operationally simpler than one
unresolved custom piece.

`experience.test.mjs` keeps the presentation honest: resolved work skips the
technical branch, volume alone does not imply complexity, uncertainty remains a
valid path, edited answers replace earlier values, and the summary uses the
visitor's language. It also proves that an edit which hides the conditional
technical branch clears only that dependent answer and that the public pilot
label remains human while the internal `PILOT_SETUP` semantic key stays stable.

## Boundary

The prototype never generates price, discount, scope acceptance, timeline
acceptance, capacity acceptance, a lead score, a Client, a Project, or a
Production Order. The result is only a deterministic starting-path suggestion
for human review.
