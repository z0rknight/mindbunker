"use server";

import "server-only";

import { getAuthenticatedDb } from "@/db";
import { filmRolls, filmRollSubjects } from "@/db/schema";
import { and, desc, gte, like, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isFilmRollStatus, parseSubjectInventory } from "./config";

function cleanOptional(value: FormDataEntryValue | null, max = 500) {
  const clean = typeof value === "string" ? value.trim() : "";
  return clean ? clean.slice(0, max) : null;
}

export async function createFilmRoll(formData: FormData) {
  const name = cleanOptional(formData.get("name"), 120);
  const capturedFrom = cleanOptional(formData.get("capturedFrom"), 10);
  const capturedTo = cleanOptional(formData.get("capturedTo"), 10);
  const rating = Number(formData.get("rating") ?? 0);
  const status = formData.get("status");
  const subjects = parseSubjectInventory(String(formData.get("subjects") ?? ""));
  if (!name || !capturedFrom) return { success: false as const, error: "Name and capture start are required." };
  if (capturedTo && capturedTo < capturedFrom) return { success: false as const, error: "Capture end cannot be before the start." };
  if (!Number.isInteger(rating) || rating < 0 || rating > 5) return { success: false as const, error: "Rating must be 0–5." };
  if (!isFilmRollStatus(status)) return { success: false as const, error: "Choose a valid status." };

  const db = await getAuthenticatedDb();
  const result = await db.$client.batch([
    db.$client.prepare(`INSERT INTO film_rolls
      (name, status, captured_from, captured_to, rating, aesthetic, tags, soundtrack, storage_reference, notes)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      RETURNING id`).bind(
        name,
        status,
        capturedFrom,
        capturedTo,
        rating,
        cleanOptional(formData.get("aesthetic"), 240),
        cleanOptional(formData.get("tags"), 500),
        cleanOptional(formData.get("soundtrack"), 240),
        cleanOptional(formData.get("storageReference"), 800),
        cleanOptional(formData.get("notes"), 2_000),
      ),
  ]);
  const id = Number((result[0].results[0] as { id?: number } | undefined)?.id);
  if (!Number.isInteger(id) || id <= 0) return { success: false as const, error: "Film Roll was not created." };

  if (subjects.length > 0) {
    await db.$client.batch(subjects.map((subject) => db.$client
      .prepare("INSERT INTO film_roll_subjects (film_roll_id, label, shot_count) VALUES (?1, ?2, ?3)")
      .bind(id, subject.label, subject.shotCount)));
  }
  revalidatePath("/film-rolls");
  return { success: true as const };
}

export async function getFilmRolls(filters: { query?: string; month?: string; minRating?: number }) {
  const db = await getAuthenticatedDb();
  const query = filters.query?.trim().toLowerCase() ?? "";
  const month = filters.month?.match(/^\d{4}-\d{2}$/)?.[0] ?? "";
  const minRating = Math.min(5, Math.max(0, Math.floor(filters.minRating ?? 0)));
  const predicates = [gte(filmRolls.rating, minRating)];
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
