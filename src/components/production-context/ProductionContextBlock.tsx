import { linkifyText, type ProductionContext } from "@/modules/production-context/core";

// Read-only "Production context": presentational only (no hooks, no state,
// no writes), so the Production Order page (server) and the Video Workspace
// panel (client) render identical facts. Rows exist only for facts that are
// recorded; when nothing about source/notes exists it says so ONCE.

function LinkedText({ text }: { text: string }) {
  return (
    <>
      {linkifyText(text).map((part, index) =>
        part.type === "link" ? (
          <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className="break-all text-cyan-400 hover:text-cyan-300">
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-black uppercase tracking-wide text-zinc-600">{label}</dt>
      <dd className="mt-0.5 text-xs leading-5 text-zinc-300">{children}</dd>
    </div>
  );
}

function UrlLink({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-cyan-400 hover:text-cyan-300">
      {url} ↗
    </a>
  );
}

export function ProductionContextBlock({
  context,
  title = "Production context",
}: {
  context: ProductionContext;
  title?: string;
}) {
  if (context.rows.length === 0 && !context.noSourceContext) return null;
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono" data-testid="production-context">
      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">{title}</p>
      <dl className="space-y-3">
        {context.rows.map((row) => {
          switch (row.key) {
            case "batch-notes":
            case "project-notes":
              return (
                <Row key={row.key} label={row.label}>
                  <div className="max-h-44 overflow-auto whitespace-pre-line break-words">
                    <LinkedText text={row.text} />
                  </div>
                </Row>
              );
            case "source":
              return (
                <Row key={row.key} label={row.label}>
                  <ul className="space-y-1.5">
                    {row.references.map((ref) => (
                      <li key={ref.id} className="break-words">
                        {[ref.location, ref.profile, ref.approxSizeLabel].filter(Boolean).join(" · ")}
                        {ref.sourceUrl && (
                          <>
                            {" "}
                            <UrlLink url={ref.sourceUrl} />
                          </>
                        )}
                        {ref.notes && <span className="block text-zinc-500">{ref.notes}</span>}
                      </li>
                    ))}
                  </ul>
                </Row>
              );
            case "review":
            case "delivery":
            case "published":
              return (
                <Row key={row.key} label={row.label}>
                  <UrlLink url={row.url} />
                </Row>
              );
            case "formats":
              return (
                <Row key={row.key} label={row.label}>
                  {row.names.join(" · ")}
                </Row>
              );
          }
        })}
      </dl>
      {context.noSourceContext && (
        <p className="mt-3 text-[11px] text-zinc-600">No source or cut-sheet context is recorded for this batch or project.</p>
      )}
    </section>
  );
}
