// Monday Local Intelligence Lab §D — a persistent reminder/QA card, not a
// task-management system. Content is intentionally static (the two gaps it
// calls out are specific, already-known findings from the Round 2 import's
// own cross-source consistency audit -- see
// docs/architecture/ALL_HISTORY_LOCAL_IMPORT_REPORT.md), not re-derived
// from a live query every render. Nothing here blocks any other MindBunker
// surface.

export function HistoricalReviewReminder() {
  return (
    <div className="mb-6 rounded-xl border border-red-800/50 bg-red-950/20 p-4">
      <p className="text-sm font-bold text-red-300">
        🔍 REVISÃO HISTÓRICA NECESSÁRIA
      </p>
      <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
        Estes pontos ainda precisam de revisão manual antes que os dados
        históricos sejam considerados confiáveis para decisões. Este cartão é
        apenas um lembrete de qualidade — não é um sistema de gerenciamento
        de tarefas.
      </p>
      <ul className="mt-3 space-y-2 text-xs text-zinc-300">
        <li className="rounded-lg border border-red-900/40 bg-red-950/30 p-2.5">
          <span className="font-semibold text-red-300">
            Jun–Out 2025 (5 meses):
          </span>{" "}
          nenhuma cobertura de rastreamento de horas (Clockify) neste
          período. As horas faturadas do Upwork existem, mas não há como
          cruzar com horas efetivamente trabalhadas — o gráfico &ldquo;Tracked
          Hours&rdquo; acima mostra esses meses como desconhecidos, não como
          zero.
        </li>
        <li className="rounded-lg border border-red-900/40 bg-red-950/30 p-2.5">
          <span className="font-semibold text-red-300">
            4 meses com receita mas zero horas faturadas:
          </span>{" "}
          Jan/2023, Fev/2023, Set/2024, Out/2024. Pode ser receita de projeto
          fechado (não por hora), erro de exportação do Upwork, ou uma
          lacuna real de dados — precisa de confirmação manual antes de
          tratar esses meses como confiáveis para qualquer análise de
          eficiência.
        </li>
      </ul>
    </div>
  );
}
