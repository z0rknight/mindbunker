"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { filmRolls, filmRollSubjects } from "@/db/schema";
import { and, desc, eq, gte, like, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isFilmRollStatus, validateSubjectInventory } from "./config";

function cleanOptional(value: FormDataEntryValue | null, max = 500) {
  const clean = typeof value === "string" ? value.trim() : "";
  return clean ? clean.slice(0, max) : null;
}

function readFilmRollInput(formData: FormData) {
  const name = cleanOptional(formData.get("name"), 120);
  const capturedFrom = cleanOptional(formData.get("capturedFrom"), 10);
  const capturedTo = cleanOptional(formData.get("capturedTo"), 10);
  const rating = Number(formData.get("rating") ?? 0);
  const status = formData.get("status");
  const subjectResult = validateSubjectInventory(String(formData.get("subjects") ?? ""));
  if (!name || !capturedFrom) return { success: false as const, error: "Name and capture start are required." };
  if (capturedTo && capturedTo < capturedFrom) return { success: false as const, error: "Capture end cannot be before the start." };
  if (!Number.isInteger(rating) || rating < 0 || rating > 5) return { success: false as const, error: "Rating must be 0–5." };
  if (!isFilmRollStatus(status)) return { success: false as const, error: "Choose a valid status." };
  if (!subjectResult.success) return subjectResult;
  return { success: true as const, value: {
    name, capturedFrom, capturedTo, rating, status,
    aesthetic: cleanOptional(formData.get("aesthetic"), 240),
    tags: cleanOptional(formData.get("tags"), 500),
    soundtrack: cleanOptional(formData.get("soundtrack"), 240),
    storageReference: cleanOptional(formData.get("storageReference"), 800),
    notes: cleanOptional(formData.get("notes"), 2_000),
    subjects: subjectResult.subjects,
  } };
}

export async function createFilmRoll(formData: FormData) {
  const parsed = readFilmRollInput(formData);
  if (!parsed.success) return parsed;
  const input = parsed.value;

  const db = await getAuthenticatedDb();
  const statements = [
    db.$client.prepare(`INSERT INTO film_rolls
      (name, status, captured_from, captured_to, rating, aesthetic, tags, soundtrack, storage_reference, notes)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      RETURNING id`).bind(
        input.name, input.status, input.capturedFrom, input.capturedTo, input.rating,
        input.aesthetic, input.tags, input.soundtrack, input.storageReference, input.notes,
      ),
  ];
  if (input.subjects.length > 0) {
    statements.push(db.$client.prepare(`WITH roll AS MATERIALIZED (SELECT last_insert_rowid() AS id)
      INSERT INTO film_roll_subjects (film_roll_id, label, shot_count)
      SELECT roll.id, json_extract(value, '$.label'), json_extract(value, '$.shotCount')
      FROM roll CROSS JOIN json_each(?1)`).bind(JSON.stringify(input.subjects)));
  }
  const result = await db.$client.batch(statements);
  const id = Number((result[0].results[0] as { id?: number } | undefined)?.id);
  if (!Number.isInteger(id) || id <= 0) return { success: false as const, error: "Film Roll was not created." };
  revalidatePath("/film-rolls");
  return { success: true as const };
}

export async function updateFilmRoll(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) return { success: false as const, error: "Film Roll identity is invalid." };
  const parsed = readFilmRollInput(formData);
  if (!parsed.success) return parsed;
  const input = parsed.value;
  const db = await getAuthenticatedDb();
  const exists = await db.select({ id: filmRolls.id }).from(filmRolls).where(eq(filmRolls.id, id)).limit(1);
  if (exists.length === 0) return { success: false as const, error: "Film Roll no longer exists." };
  await db.$client.batch([
    db.$client.prepare(`UPDATE film_rolls SET
      name=?1, status=?2, captured_from=?3, captured_to=?4, rating=?5, aesthetic=?6,
      tags=?7, soundtrack=?8, storage_reference=?9, notes=?10, updated_at=CURRENT_TIMESTAMP
      WHERE id=?11`).bind(
        input.name, input.status, input.capturedFrom, input.capturedTo, input.rating,
        input.aesthetic, input.tags, input.soundtrack, input.storageReference, input.notes, id,
      ),
    db.$client.prepare("DELETE FROM film_roll_subjects WHERE film_roll_id=?1").bind(id),
    ...input.subjects.map((subject) => db.$client
      .prepare("INSERT INTO film_roll_subjects (film_roll_id, label, shot_count) VALUES (?1, ?2, ?3)")
      .bind(id, subject.label, subject.shotCount)),
  ]);
  revalidatePath("/film-rolls");
  return { success: true as const };
}

export async function getFilmRolls(filters: { query?: string; month?: string; minRating?: number; status?: string }) {
  const db = await getAuthenticatedDb();
  const query = filters.query?.trim().toLowerCase() ?? "";
  const month = filters.month?.match(/^\d{4}-\d{2}$/)?.[0] ?? "";
  const minRating = Math.min(5, Math.max(0, Math.floor(filters.minRating ?? 0)));
  const predicates = [gte(filmRolls.rating, minRating)];
  if (isFilmRollStatus(filters.status)) predicates.push(eq(filmRolls.status, filters.status));
  else if (filters.status !== "ALL") predicates.push(ne(filmRolls.status, "ARCHIVED"));
  if (month) predicates.push(like(filmRolls.capturedFrom, `${month}%`));
  if (query) {
    const pattern = `%${query}%`;
    predicates.push(or(
      like(sql`lower(${filmRolls.name})`, pattern),
      like(sql`lower(coalesce(${filmRolls.aesthetic}, ''))`, pattern),
      like(sql`lower(coalesce(${filmRolls.tags}, ''))`, pattern),
      sql`exists (select 1 from film_roll_subjects s where s.film_roll_id = ${filmRolls.id} and lower(s.label) like ${pattern})`,
    )!);
  }
  const rolls = await db.select().from(filmRolls).where(and(...predicates)).orderBy(desc(filmRolls.capturedFrom), desc(filmRolls.id));
  const subjects = rolls.length === 0 ? [] : await db.select().from(filmRollSubjects)
    .where(sql`${filmRollSubjects.filmRollId} in (${sql.join(rolls.map((roll) => sql`${roll.id}`), sql`, `)})`)
    .orderBy(filmRollSubjects.label);
  return rolls.map((roll) => ({ ...roll, subjects: subjects.filter((subject) => subject.filmRollId === roll.id) }));
}
