/**
 * The text half of a "new arrival" marker (the edge is the shared
 * `os-flash` + data-flash="brand"). It is a WORD, so newness is never
 * colour-only; it is rendered only while an item is in its brief new window.
 */
export function NewBadge({ className }: { className?: string }) {
  return <span className={className ? `os-new-label ${className}` : "os-new-label"}>New</span>;
}
