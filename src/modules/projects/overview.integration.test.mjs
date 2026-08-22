import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const plain = (row) => ({ ...row });

test("project aggregation keeps clients isolated and counts lifecycle truth", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      deadline TEXT
    );
    CREATE TABLE video_logs (
      id INTEGER PRIMARY KEY,
      client_id INTEGER,
      project_id INTEGER REFERENCES projects(id),
      status TEXT NOT NULL
    );

    INSERT INTO clients VALUES (1, 'Client A'), (2, 'Client B');
    INSERT INTO projects VALUES
      (10, 1, 'Mixed lifecycle', 'active', '2026-08-24'),
      (11, 1, 'Empty project', 'planned', NULL),
      (20, 2, 'Other client', 'review', NULL);

    INSERT INTO video_logs VALUES
      (1, 1, 10, 'PLANNED'),
      (2, 1, 10, 'IN_PROGRESS'),
      (3, 1, 10, 'READY_FOR_REVIEW'),
      (4, 1, 10, 'CHANGES_REQUESTED'),
      (5, 1, 10, 'DONE'),
      (6, 2, 20, 'DONE'),
      (7, NULL, NULL, 'DONE');
  `);

  const rows = db
    .prepare(`
      SELECT
        p.id,
        p.client_id AS clientId,
        c.name AS clientName,
        COUNT(v.id) AS totalVideos,
        COALESCE(SUM(CASE WHEN v.status = 'DONE' THEN 1 ELSE 0 END), 0) AS doneVideos,
        COALESCE(SUM(CASE WHEN v.status IN ('IN_PROGRESS', 'READY_FOR_REVIEW', 'CHANGES_REQUESTED') THEN 1 ELSE 0 END), 0) AS inFlightVideos,
        COALESCE(SUM(CASE WHEN v.status = 'PLANNED' THEN 1 ELSE 0 END), 0) AS plannedVideos
      FROM projects p
      JOIN clients c ON c.id = p.client_id
      LEFT JOIN video_logs v ON v.project_id = p.id
      GROUP BY p.id, c.id
      ORDER BY p.id
    `)
    .all()
    .map(plain);

  assert.deepEqual(rows, [
    {
      id: 10,
      clientId: 1,
      clientName: "Client A",
      totalVideos: 5,
      doneVideos: 1,
      inFlightVideos: 3,
      plannedVideos: 1,
    },
    {
      id: 11,
      clientId: 1,
      clientName: "Client A",
      totalVideos: 0,
      doneVideos: 0,
      inFlightVideos: 0,
      plannedVideos: 0,
    },
    {
      id: 20,
      clientId: 2,
      clientName: "Client B",
      totalVideos: 1,
      doneVideos: 1,
      inFlightVideos: 0,
      plannedVideos: 0,
    },
  ]);

  db.close();
});
