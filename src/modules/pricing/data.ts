import "server-only";

import { getAuthenticatedDb } from "@/db";
import {
  classifyPricingEvidence,
  describePricingEvidence,
  type PricingEvidenceClassification,
  type PricingEvidenceRow,
  type PricingReality,
} from "./reality";

type RawPricingEvidence = {
  video_id: number;
  title: string;
  client_name: string | null;
  project_name: string | null;
  status: string;
  recorded_content_type: string | null;
  inferred_content_type: string | null;
  tracked_seconds: number;
  manual_seconds: number;
  session_count: number;
  revision_count: number;
};

const PRICING_EVIDENCE_SQL = `
  WITH session_totals AS (
    SELECT video_id,
      SUM(CASE WHEN ended_at IS NOT NULL AND ended_at >= started_at THEN ended_at - started_at ELSE 0 END) AS tracked_seconds,
      SUM(CASE WHEN source = 'MANUAL' AND ended_at IS NOT NULL AND ended_at >= started_at THEN ended_at - started_at ELSE 0 END) AS manual_seconds,
      COUNT(*) AS session_count
    FROM work_sessions
    GROUP BY video_id
  ), revision_totals AS (
    SELECT video_id, COUNT(*) AS revision_count
    FROM revisions
    GROUP BY video_id
  )
  SELECT v.id AS video_id,
    COALESCE(v.title, 'Video ' || v.date) AS title,
    c.name AS client_name,
    p.name AS project_name,
    v.status,
    v.content_type AS recorded_content_type,
    CASE
      WHEN lower(COALESCE(p.name, '') || ' ' || COALESCE(v.title, '')) LIKE '%long form%' THEN 'long-form'
      WHEN lower(COALESCE(p.name, '') || ' ' || COALESCE(v.title, '')) LIKE '%mini doc%' THEN 'mini-doc'
      WHEN lower(COALESCE(p.name, '') || ' ' || COALESCE(v.title, '')) LIKE '%testimonial%' THEN 'testimonial'
      WHEN lower(COALESCE(p.name, '') || ' ' || COALESCE(v.title, '')) LIKE '%short form%' THEN 'short-form'
      ELSE NULL
    END AS inferred_content_type,
    COALESCE(st.tracked_seconds, 0) AS tracked_seconds,
    COALESCE(st.manual_seconds, 0) AS manual_seconds,
    COALESCE(st.session_count, 0) AS session_count,
    COALESCE(rt.revision_count, 0) AS revision_count
  FROM video_logs v
  LEFT JOIN clients c ON c.id = v.client_id
  LEFT JOIN projects p ON p.id = v.project_id
  LEFT JOIN session_totals st ON st.video_id = v.id
  LEFT JOIN revision_totals rt ON rt.video_id = v.id
  WHERE COALESCE(v.is_operational_container, 0) = 0
    AND v.cancelled_at IS NULL
    AND v.video_kind = 'CLIENT_WORK'
    AND COALESCE(st.tracked_seconds, 0) > 0
    AND COALESCE(c.name, '') NOT IN ('RMEDIA', 'RMEDIA Capture Release Test')
    AND (v.content_type IS NOT NULL OR inferred_content_type IS NOT NULL)
  ORDER BY CASE WHEN v.status = 'DONE' THEN 1 ELSE 0 END ASC,
    st.tracked_seconds DESC,
    v.id DESC
  LIMIT 24
`;

export async function getPricingReality(): Promise<PricingReality> {
  const db = await getAuthenticatedDb();
  const result = await db.$client
    .prepare(PRICING_EVIDENCE_SQL)
    .all<RawPricingEvidence>();

  const rows: PricingEvidenceRow[] = result.results.map((row) => {
    const classification: PricingEvidenceClassification = row.recorded_content_type
      ? "RECORDED"
      : "INFERRED_FROM_PROJECT";
    return {
      videoId: Number(row.video_id),
      title: row.title,
      clientName: row.client_name,
      projectName: row.project_name,
      status: row.status,
      contentType: row.recorded_content_type ?? row.inferred_content_type ?? "unknown",
      classification,
      trackedHours: Number(row.tracked_seconds) / 3_600,
      manualHours: Number(row.manual_seconds) / 3_600,
      sessionCount: Number(row.session_count),
      revisionCount: Number(row.revision_count),
    };
  });
  const completedSampleCount = rows.filter((row) => row.status === "DONE").length;
  const activeSampleCount = rows.length - completedSampleCount;
  return {
    rows,
    completedSampleCount,
    activeSampleCount,
    confidence: classifyPricingEvidence(completedSampleCount),
    note: describePricingEvidence(completedSampleCount, activeSampleCount),
  };
}
