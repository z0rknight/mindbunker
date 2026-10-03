import Link from "next/link";
import { formatCurrency, formatMonthKey } from "@/utils/date";
import type { ClientReality } from "@/modules/reality/data";

function hours(minutes: number | null) {
  if (minutes === null) return "Unknown";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function timestamp(seconds: number | null) {
  if (seconds === null) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(seconds * 1000));
}

const AUTHORITY_LABELS = {
  DIRECT_TIME: "Direct · tracked-time estimate",
  EXTERNAL_PLATFORM: "External platform evidence",
  FIXED_SCOPE: "Fixed scope",
  MIXED: "Mixed · separated components required",
  UNKNOWN: "Unknown",
} as const;

function Money({ amount, currency }: { amount: number | null; currency: string | null }) {
  return <>{amount === null || !currency ? "Unknown" : formatCurrency(amount, currency)}</>;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/55 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">{label}</p>
      <div className="mt-1 text-sm font-semibold text-zinc-200">{children}</div>
    </div>
  );
}

export function ClientRealityPanel({ reality }: { reality: ClientReality }) {
  const { commercial } = reality;
  const currency = commercial.currency;
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Commercial · evidence-backed</p>
          <h2 className="mt-1 text-lg font-bold text-white">{reality.canonicalName}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {reality.activeRelationship ? "Active relationship" : "Inactive relationship"} · {reality.projectCount} active projects · {reality.productionOrderCount} open orders
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black tracking-wide ${commercial.readiness === "REQUESTED" || commercial.readiness === "READY_TO_REQUEST" ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-300"}`}>
          {commercial.readiness.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Fact label="Commercial model">
          {commercial.model}{commercial.platform ? ` · ${commercial.platform}` : ""}
          <span className="mt-0.5 block text-[10px] font-normal text-zinc-600">{AUTHORITY_LABELS[commercial.valueAuthority]}</span>
        </Fact>
        <Fact label="Rate evidence">
          {commercial.hourlyRate && currency ? `${formatCurrency(commercial.hourlyRate, currency)}/h` : "Scope-controlled or unknown"}
          <span className="mt-0.5 block text-[10px] font-normal text-zinc-600">Hours never increase a fixed-price scope</span>
        </Fact>
        <Fact label="Last request">
          <Money amount={commercial.lastRequest ? commercial.lastRequest.amountCents / 100 : null} currency={commercial.lastRequest?.currency ?? currency} />
          <span className="mt-0.5 block text-[10px] font-normal text-zinc-600">{commercial.lastRequest ? `${commercial.lastRequest.status} · ${timestamp(commercial.lastRequest.createdAt)}` : "No request recorded"}</span>
        </Fact>
        <Fact label="Unpaid requested">
          <Money amount={commercial.unpaidRequested} currency={currency} />
          <span className="mt-0.5 block text-[10px] font-normal text-zinc-600">Confirmed ask · not revenue</span>
        </Fact>
        <Fact label="Paid since current request">
          <Money amount={commercial.paidAgainstCurrent} currency={currency} />
          <span className="mt-0.5 block text-[10px] font-normal text-zinc-600">Candidate receipts · payment request ≠ payment</span>
        </Fact>
        <Fact label="Expected new value · Level 1">
          <Money amount={commercial.expectedNewValue} currency={currency} />
          <span className="mt-0.5 block text-[10px] font-normal text-zinc-600">
            {commercial.expectedValueState.replaceAll("_", " ")} · {hours(commercial.expectedMinutes)}
          </span>
        </Fact>
        <Fact label="Supported inside current request">
          <Money amount={commercial.supportedDeltaInCurrent} currency={currency} />
          <span className="mt-0.5 block text-[10px] font-normal text-zinc-600">Historical verification only · {hours(commercial.includedMinutes)}</span>
        </Fact>
        <Fact label="Current commercial position">
          <span>{commercial.unpaidRequested > 0 ? <><Money amount={commercial.unpaidRequested} currency={currency} /> requested</> : "No open request"}</span>
          <span className="mt-0.5 block text-[10px] font-normal text-zinc-600">
            {commercial.expectedNewValue === null ? "Expected value controlled elsewhere" : `+ ${formatCurrency(commercial.expectedNewValue, currency ?? "USD")} expected · never auto-added`}
          </span>
        </Fact>
        <Fact label="Evidence through">{commercial.externalEvidenceThrough ?? timestamp(commercial.evidenceCutoff)}</Fact>
        <Fact label="Delivery / review">{reality.deliveryCount} delivered · {reality.reviewCount} review events</Fact>
      </div>

      <details className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/30">
        <summary className="cursor-pointer px-3 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">Expected value derivation</summary>
        <div className="border-t border-zinc-800 px-3 py-3 text-xs leading-5 text-zinc-400">
          <p>{commercial.expectedValueBasis}</p>
          <p className="mt-2 text-zinc-600">
            Level 2 request preparation: {commercial.requestDraftReadiness.replaceAll("_", " ")}. No payment request is created or sent automatically; the current request model is client-visible and has no safe draft state.
          </p>
        </div>
      </details>

      {(reality.registeredMinutes !== null || reality.dfyMinutes > 0 || reality.weekly.length > 0) && (
        <details className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40" open>
          <summary className="cursor-pointer px-3 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
            {formatMonthKey(reality.periodMonthKey)} · commercial relationship
          </summary>
          <div className="border-t border-zinc-800 p-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
              <Fact label="DIRECT">{hours(reality.directMinutes)}</Fact>
              <Fact label="DFY">{hours(reality.dfyMinutes)}</Fact>
              <Fact label="External registered">{hours(reality.registeredMinutes)}</Fact>
              <Fact label="Work-date gross"><Money amount={reality.workDateGross} currency={currency} /></Fact>
              <Fact label="Posted gross"><Money amount={reality.postedGross} currency={currency} /></Fact>
              <Fact label="Service fees"><Money amount={reality.serviceFees} currency={currency} /></Fact>
              <Fact label="Withdrawal fees"><Money amount={reality.withdrawalFees} currency={currency} /></Fact>
              <Fact label="Net cash"><Money amount={reality.netCash} currency={currency} /></Fact>
              <Fact label="Client count">1 canonical relationship</Fact>
              <Fact label="Below-client allocation">Unallocated unless evidenced</Fact>
            </div>

            {reality.weekly.length > 0 && (
              <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-800">
                <table className="w-full min-w-[860px] text-xs">
                  <thead className="bg-zinc-950 text-zinc-600">
                    <tr>
                      {['Week','Registered','Gross','Posted','Service','Withdrawal','Net platform','Bank','DIRECT / DFY'].map((label) => <th key={label} className="px-2 py-2 text-left font-bold uppercase tracking-wide">{label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {reality.weekly.map((week) => (
                      <tr key={`${week.periodStart}-${week.periodEnd}`} className="border-t border-zinc-800 text-zinc-300">
                        <td className="px-2 py-2 whitespace-nowrap">{week.periodStart} → {week.periodEnd}</td>
                        <td className="px-2 py-2">{hours(week.registeredMinutes)}</td>
                        <td className="px-2 py-2"><Money amount={week.workDateGross} currency={currency} /></td>
                        <td className="px-2 py-2"><Money amount={week.postedGross} currency={currency} /></td>
                        <td className="px-2 py-2"><Money amount={week.serviceFees} currency={currency} /></td>
                        <td className="px-2 py-2"><Money amount={week.withdrawalFees} currency={currency} /></td>
                        <td className="px-2 py-2"><Money amount={week.netPlatformValue} currency={currency} /></td>
                        <td className="px-2 py-2"><Money amount={week.bankSettlement} currency={currency} /></td>
                        <td className="px-2 py-2">{hours(week.directMinutes)} / {hours(week.dfyMinutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      )}

      {reality.exceptions.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
          <p className="font-bold uppercase tracking-wide">Known exceptions</p>
          {reality.exceptions.map((exception) => <p key={exception} className="mt-1 text-amber-200/75">{exception}</p>)}
        </div>
      )}
      <div className="mt-3 flex gap-4 text-xs">
        <Link href="/finance" className="font-semibold text-cyan-400 hover:text-cyan-300">Finance drill-down →</Link>
        <Link href="/productivity/sensor" className="font-semibold text-cyan-400 hover:text-cyan-300">Sensor coverage →</Link>
      </div>
    </section>
  );
}
