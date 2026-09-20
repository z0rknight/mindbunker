// RMEDIA OS motion contract (Train M1). The CSS tokens live in
// src/app/globals.css; these constants are the JS-side mirror used by the
// primitives and pinned against the CSS by src/lib/os-foundation.test.mjs.
// Presentation only: nothing here knows about business state.

export const OS_MOTION_MS = { fast: 120, standard: 180, panel: 240, exit: 140 } as const;

export const OS_INTENSITY_SCALE = { public: 1.25, client: 1, operator: 0.8 } as const;
export type OsIntensity = keyof typeof OS_INTENSITY_SCALE;

/** Reduced motion collapses every derived duration to (effectively) nothing. */
export const OS_REDUCED_SCALE = 0.0001;

/** Pending feedback is only shown for waits that are actually noticeable. */
export const OS_PENDING = { delayMs: 150, minVisibleMs: 300 } as const;

/** How long a changed object keeps its marker before returning to neutral. */
export const OS_FLASH_HOLD_MS = 1400;

/** Effective duration for a motion token at an intensity. */
export function osDurationMs(
  token: keyof typeof OS_MOTION_MS,
  intensity: OsIntensity,
  reduced = false,
): number {
  const scale = reduced ? OS_REDUCED_SCALE : OS_INTENSITY_SCALE[intensity];
  return OS_MOTION_MS[token] * scale;
}
