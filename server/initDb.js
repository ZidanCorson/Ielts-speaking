import "dotenv/config";
import { pool } from "./db.js";

const schema = `
CREATE TABLE IF NOT EXISTS students (
  id          SERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  pw_hash     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id            SERIAL PRIMARY KEY,
  student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  mode          TEXT NOT NULL DEFAULT 'practice',
  topic_title   TEXT NOT NULL,
  question      TEXT NOT NULL,
  transcript    TEXT NOT NULL,
  fluency       NUMERIC(2,1) NOT NULL,
  lexical       NUMERIC(2,1) NOT NULL,
  grammar       NUMERIC(2,1) NOT NULL,
  pronunciation NUMERIC(2,1) NOT NULL,
  overall       NUMERIC(2,1) NOT NULL,
  feedback      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id, created_at DESC);
`;

const c = await pool.connect();
try {
  await c.query(schema);
  console.log("✅ Database initialised.");
} catch (e) {
  console.error("❌ Init failed:", e.message);
  process.exit(1);
} finally {
  c.release();
  await pool.end();
}
