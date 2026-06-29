# IELTS Speaking Coach — Project Guide

AI-assisted IELTS speaking practice platform. Students pick seasonal topics, answer
orally, and Gemini transcribes, scores (4 IELTS criteria + overall band), gives
encouragement and a model answer. Includes a mock test mode. Records persist per student.

## Architecture
Monorepo with two apps:
- **Frontend** (root): Vite + React + TypeScript + Tailwind. Records mic audio.
- **Backend** (`server/`): Express + Neon Postgres + Gemini. Handles auth, STT, scoring, storage.

Flow: browser records audio (MediaRecorder) → POST `/api/score` → server transcribes
with Gemini → scores → saves to Postgres → returns transcript + feedback.

## Key files
- Frontend: `src/App.tsx`, `src/views/{Practice,MockTest,History,Login}.tsx`,
  `src/services/api.ts`, `src/hooks/useAudioRecorder.ts`, `src/services/speech.ts` (TTS only),
  `src/topics.ts` (static seasonal topic bank — extend each term), `src/auth/AuthContext.tsx`
- Backend: `server/index.js` (routes), `server/gemini.js` (transcribe + score),
  `server/auth.js` (JWT), `server/db.js`, `server/initDb.js` (schema)

## Run
```bash
cd server && npm run init-db && node index.js   # API on :4000
npm run dev                                       # frontend (root)
```

## Environment
- `.env` (root): `VITE_API_URL=http://localhost:4000`
- `server/.env`: `DATABASE_URL` (Neon), `GEMINI_API_KEY`, `JWT_SECRET`, `CLIENT_ORIGIN`, `PORT`
- Both `.env` files are gitignored. Env is loaded from the server folder explicitly.

## Conventions / gotchas
- Speech-to-text uses **Gemini audio transcription**, not the browser Speech API (unreliable).
- Gemini model: `gemini-2.5-flash` (1.5/2.0 retired). List models with `curl ".../v1beta/models?key=KEY"` and update `server/gemini.js` if 404s appear.
- Keep cost free: Gemini free tier, Neon free tier, browser TTS, static topics.
- Auth = email/password + JWT in localStorage. History loads from DB via `/api/history`.
- Tailwind theme: dark gradient bg, glass cards, Sora/Inter fonts. Keep the polished look.

## DB tables
- `students(id, email, name, pw_hash, created_at)`
- `sessions(id, student_id, mode, topic_title, question, transcript, fluency, lexical, grammar, pronunciation, overall, feedback jsonb, created_at)`

## Possible next steps
Band-trend chart + CSV export on Progress; countdown timers; teacher dashboard; deploy (Vercel + Neon).
