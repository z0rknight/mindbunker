// 14SEP Patch Sniper §2-3: the root cause of "the whole app behaves like a
// centered document" was never AppShell's <main> (already full-width --
// flex-1, no max-w, see AppShell.tsx) -- it was every individual
// authenticated Operator page re-imposing its own restrictive
// `mx-auto max-w-5xl/6xl/7xl` wrapper on top of that already-correct
// shell. One shared class here instead of that decision living
// independently in twenty page files. Keeps the ~16-24px operational
// gutter (px-4 / sm:px-6 / md:px-8), just drops the artificial centering
// cap. Deliberately NOT used by Client Portal, login/auth, or the public
// site -- those keep their own narrower, reader-friendly widths.
export const OPERATOR_WORKSPACE_CLASS = "w-full px-4 py-5 sm:px-6 md:px-8";
