# IELTS Speaking Coach — Project Guide

AI-assisted IELTS speaking practice platform. A marketing landing page invites students to
sign up; they pick seasonal topics, answer orally, and Gemini transcribes, scores (4 IELTS
criteria + overall band), gives encouragement, useful vocabulary, and a band-8 rewrite of
their own answer. Includes a mock test mode and progress tracking. Records persist per student.
Monetised with Stripe: 5 free practices/month, then a £9.99/mo Pro plan (mock tests are Pro-only).

## Architecture
Monorepo with two apps:
- **Frontend** (root): Vite + React + TypeScript + Tailwind. Records mic audio.
- **Backend** (`server/`): Express + Neon Postgres + Gemini + Stripe. Handles auth, STT,
  scoring, storage, and subscription billing.

Flow: browser records audio (MediaRecorder) → POST `/api/score` → server enforces the free
quota → transcribes with Gemini → scores → saves to Postgres → returns transcript + feedback
+ delivery stats.

## Key files
- Frontend views: `src/views/{Landing,Login,Practice,MockTest,History,Words}.tsx`
- Frontend core: `src/App.tsx`, `src/services/api.ts`, `src/hooks/useAudioRecorder.ts`,
  `src/services/speech.ts` (TTS only), `src/services/streak.ts`,
  `src/topics.ts` (static seasonal topic bank + `getDailyTopic` — extend each term)
- Contexts (providers nested in `src/main.tsx`): `src/theme/ThemeContext.tsx`,
  `src/auth/AuthContext.tsx`, `src/history/HistoryContext.tsx`, `src/vocab/VocabContext.tsx`,
  `src/billing/SubscriptionContext.tsx`
- Components: `src/components/{FeedbackCard,MicMeter,UpgradeCard,VoiceSelector}.tsx`
- Backend: `server/index.js` (routes + webhook), `server/gemini.js` (transcribe + score),
  `server/billing.js` (Stripe + quota), `server/delivery.js` (wpm/filler analysis),
  `server/auth.js` (JWT), `server/db.js`, `server/initDb.js` (schema + migrations)

## Run
```bash
cd server && npm run init-db && node index.js   # API on :4000
npm run dev                                       # frontend (root)
```

## Environment
- `.env` (root): `VITE_API_URL=http://localhost:4000`
- `server/.env`: `DATABASE_URL` (Neon), `GEMINI_API_KEY`, `JWT_SECRET`, `CLIENT_ORIGIN`, `PORT`,
  and Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` (£9.99/mo recurring price), `STRIPE_WEBHOOK_SECRET`
- Both `.env` files are gitignored. Env is loaded from the server folder explicitly.
- Billing degrades gracefully: with no Stripe keys, checkout returns 503 and everyone stays free.
  Local webhooks: `stripe listen --forward-to localhost:4000/api/stripe/webhook`.

## Conventions / gotchas
- Speech-to-text uses **Gemini audio transcription**, not the browser Speech API (unreliable).
- Gemini model: `gemini-2.5-flash` (1.5/2.0 retired). List models with `curl ".../v1beta/models?key=KEY"` and update `server/gemini.js` if 404s appear.
- Keep cost free where possible: Gemini free tier, Neon free tier, browser TTS, static topics.
- Auth = email/password + JWT in localStorage. History loads from DB via `/api/history`.
- Quota: free tier = 5 `practice` sessions per calendar month (counted from `sessions`); mock
  tests need Pro. `/api/score` returns **402** with `code: "upgrade_required"` when blocked —
  the client throws `UpgradeRequiredError` and shows `UpgradeCard`.
- Stripe webhook (`/api/stripe/webhook`) is registered with `express.raw` BEFORE `express.json`
  and syncs `students.subscription_*`. Don't move it below the JSON parser.
- Tailwind theme: **warm sunset palette** — cream/peach light bg, espresso-plum dark bg, coral
  (`#ef5f3c`) accents, `from-[#ff8a4c] to-[#f43f5e]` brand gradient, glass cards. Keep it warm.

## DB tables
- `students(id, email, name, pw_hash, created_at, stripe_customer_id, subscription_status,
  subscription_period_end)` — `subscription_status` defaults to `'free'`; `'active'`/`'trialing'` = Pro.
- `sessions(id, student_id, mode, part, topic_title, question, transcript, fluency, lexical,
  grammar, pronunciation, overall, feedback jsonb, wpm, filler_per_min, created_at)`
- Schema changes go in `server/initDb.js` as idempotent `ADD COLUMN IF NOT EXISTS` migrations;
  re-run `npm run init-db` after editing.

## API routes
- Auth: `POST /api/register`, `POST /api/login`
- Core: `POST /api/score` (auth, multipart audio), `GET /api/history`, `DELETE /api/history/:id`
- Billing: `GET /api/subscription`, `POST /api/checkout`, `POST /api/billing-portal`,
  `POST /api/stripe/webhook` (raw body)

## Possible next steps
Teacher dashboard; mark daily challenge done; soft countdown timers; deploy (Vercel + Neon,
see `api/index.js` + `vercel.json`).
