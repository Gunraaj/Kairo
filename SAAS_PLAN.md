# Kairo SaaS plan

> **Read this first.** This file grew in stages; where sections disagree, this list and the later sections win.

## Upgrade path (the one ordered list)

| # | Step | Section to follow | Backend? | Cost |
|---|---|---|---|---|
| 0 | Commit current work; avoid small pushes (Netlify credits) | What has to be done | No | Free |
| 1 | Finish the AI layer: syllabus breakdown on `generateStructured`, Chrome built-in AI, live model lists, evals | Handoff steps 1-4 | No | Free |
| 2 | **Product revamp**: onboarding, Today / Focus / Plan / Progress, declutter | Product revamp | No | Free |
| 3 | Re-plan loop: deadlines, pace, schedule, approve-a-diff | Handoff steps 5-6, Phase 2 | No | Free |
| 4 | "Use my AI" copy-paste bridge | Phase A | No | Free |
| 5 | Installable app + notifications | Phase 3 | No | Free |
| 6 | Move hosting to Cloudflare Pages; launch free and open source; opt-in usage counts | Zero-cost stack | No | Free |
| 7 | Only with demand: Google sign-in, sync, keep-alive | Phase 4, Phase B | Yes | Free |
| 8 | AI connector (MCP), Claude first | Phase C | Yes | Free |
| 9 | Kairo Cloud pricing: exam pass, regional bands, sponsored seats | Pricing principle | Yes | % of sales |
| 10 | Course plan library, break quiz, in-chat cards, institutes | Phase D | Yes | Free |

Each step ships on its own and leaves `npm run check` green. Steps 1-6 need no server and no account.

Positioning: **"Paste your syllabus and exam date. Kairo tells you what to study today, and re-plans when you fall behind."**
Target: students. Moat vs. a chatbot: Kairo sees what you actually did (sessions) and holds the plan over weeks.

Rules for every phase: guest mode keeps working with no login; `npm run check` passes; no secrets in the client; verify free-tier limits before relying on them.

## Phase 0 — Focus (1 day)
- First-run flow: "What are you studying for?" -> paste syllabus -> exam date -> plan. Timer is step 2, not step 1.
- Move time capsules, science guide, logo variants, stage modes behind Settings > Extras.
- Add a "Today" panel: the tasks planned for today, rounds done / planned, days to deadline.

## Phase 1 — Reliable AI layer (provider-agnostic)
- `utils/ai/generateStructured.ts`: `generateStructured<T>(schema, system, prompt): Promise<T>`.
  - Send JSON schema natively where supported (OpenAI/OpenRouter `response_format: json_schema`, Gemini `responseSchema`, Anthropic tool-use, Ollama `format: <schema>`).
  - Validate with zod. On failure: one repair retry including the validation error. Then fall back to the offline heuristics. Never throw raw model text at the UI.
  - Timeout + AbortController on every call; surface provider errors in plain words.
- Live model lists: fetch `/models` (OpenAI, Anthropic, OpenRouter), Gemini `models.list`, Ollama `/api/tags`; cache 24h in localStorage; keep a small hard-coded fallback. Remove stale presets.
- Evals: `evals/syllabi/*.md` (20 real syllabi) + `scripts/eval_ai.ts`. Score: schema valid, every topic covered, rounds within sane bounds, deadline respected. Print a table per model. Run before changing prompts.

## Phase 2 — The AI loop (the differentiator)
Loop = observe -> compute -> propose -> approve -> apply.
- Observe: sessions, task rounds planned vs done, skipped days, deadline.
- Compute **in code, not in the LLM**: pace (rounds/day needed vs actual), per-user estimate multiplier (actual / estimated rounds, per archetype), tasks at risk.
- Propose: send the compact stats + remaining tasks; model returns a **diff** (`reorder`, `split`, `re-estimate`, `drop-optional`, `move-to-day`) with a one-line reason each. Schema-validated.
- Approve: show the diff as a checklist; user accepts all / some. Nothing changes silently.
- Triggers: first open of the day, session end when behind pace, Sunday weekly review.
- Offline fallback: deterministic re-spread of remaining rounds over remaining days.
- Data model: add `plannedDate`, `estimatedRounds`, `deadline` to tasks/projects (migrate storage version).

## Phase 3 — Installable app + retention
- PWA: `vite-plugin-pwa`, manifest, icons, offline cache of app shell + cached sounds. CSP: keep `worker-src 'self' blob:`.
- Local notifications: session end, break end (Notification API, ask permission after first completed session, not on load).
- Reminders when app is closed: Web Push (VAPID) from a scheduled Supabase Edge Function. Needs Phase 4 accounts. iOS works only when installed to home screen.
- Retention mechanics: daily plan, exam countdown, streak with one "freeze" per week, weekly AI review, share card of the week.
- Stores later: Android via PWABuilder/Bubblewrap (Play fee applies); iOS via Capacitor only if demand exists.

## Phase 4 — Optional accounts + free secure sync
- One shared Supabase project (yours, free tier). Auth: Google OAuth + email magic link. No passwords stored by Kairo.
- Guest by default. "Sign in to sync" is a button, never a wall.
- Table `kairo_backups(user_id uuid pk -> auth.users, updated_at, ciphertext text, salt, iv, version)`, RLS `auth.uid() = user_id` for all.
- End-to-end encryption: WebCrypto AES-GCM; key from a user sync passphrase via PBKDF2 (>=600k iterations) or Argon2id. Server only ever sees ciphertext. Lost passphrase = lost cloud copy (say so in UI; local data unaffected).
- Sync: push on change (debounced), pull on open, `updated_at` + version check, conflict prompt. Keep last 5 versions.
- Reliability: scheduled GitHub Action pings the project so the free tier does not pause; weekly `pg_dump` artifact. Verify current free-tier limits first.
- Keep the existing bring-your-own-Supabase path under Advanced.
- Account page: export data, delete account (deletes rows + auth user).

## Phase 5 — Hosted AI (no key needed)
- Supabase Edge Function `ai-proxy`: verifies the user JWT, checks a per-user daily quota row, calls the provider with a server-side key, returns the structured result. Add it to CSP `connect-src`.
- Tiers: Guest = offline heuristics + own key + local Ollama + Chrome built-in AI. Free account = small daily hosted quota. Pro = high quota + better model.
- Cost control: small/cheap model for slicing, larger model only for re-planning; cap tokens; cache identical requests.
- A free provider key can fund the free quota at first, but check its terms (rate limits, data use) before launch.

## Phase 6 — Billing
- Merchant-of-record provider (handles tax; check which ones onboard your country). Webhook -> Edge Function -> `subscriptions` table -> quota.
- Pro pays for hosted AI. Sync stays free.

## Phase 7 — Trust and operations
- Privacy policy, terms, in-app "what leaves your device" (FAQ exists).
- Error monitoring (Sentry free tier) with PII scrubbing; privacy-friendly analytics (free tier, opt-in for guests).
- Landing page with the brag video; feedback link; changelog.
- Tech debt: split ControlPanel/Stage/SidebarNav and washi.css as each area is touched.

---

## Build status (2026-11-14, end of day)

Done, tested (177 tests) and checked in a real browser: upgrade-path steps 1 (AI layer), 2 (Today home, onboarding, mobile tab bar Today/Focus/Plan/Progress, extras behind Settings), 3 (deadlines, pace, schedule, AI re-plan with approve-a-diff), 4 (paste bridge, share links), 5 (installable app: manifest, icons, offline service worker, session-end notifications from Settings) and the config half of 6 (`public/_headers` for Cloudflare Pages, README deploy notes).

Needs you (accounts or decisions, cannot be done from code): create the Cloudflare Pages project and point it at the repo (step 6), then update `OLLAMA_ORIGINS` on Helios for the new address; Supabase + Google sign-in project (step 7); connector host (step 8); payment provider eligibility check (step 9).

Exam Mode (added later the same day, researched: retrieval practice over rereading, interleaving, no new topics in the last days): phase banner on Today for deadlines within 7 days, and a sprint planner (`utils/examMode.ts`) with Recall/Practice/Fix blocks and an optional 10 pm stop.

MCP connector (step 8) prototype in `connector/`, 7 tests with the official MCP client (see its README). Checked against current docs on 2026-11-14: Claude custom connectors need a public HTTPS URL, OAuth with PKCE, and support Dynamic Client Registration (callback `https://claude.ai/api/mcp/auth_callback`); ChatGPT needs developer mode and the sources disagree on whether Plus/Pro can run write tools (OpenAI's own page lists full MCP for Business/Enterprise/Edu), so the paste bridge stays the universal path and the connector is launched for Claude first. Claude, ChatGPT and Gemini acceptance is untested until there is a public URL.

Hosting (step 6): deployed and fully tested on Cloudflare Workers static assets through wrangler's `--temporary` mode (no account, no signup): https://kairo.abundant-stilton-736.workers.dev. Checked: onboarding, manifest, service worker, offline reload, CSP/headers from `public/_headers`, SPA deep links, no console errors. The temporary account's lifetime is unknown, so run `npx wrangler login` with a real alias-email account and `npm run deploy:cf` for a permanent address. `wrangler.jsonc` sets SPA routing (Workers reject the Pages `_redirects` file; `scripts/prepare_cloudflare.mjs` strips it).

Sync (step 7) groundwork, all tested without a Supabase project: `utils/vaultCrypto.ts` (PBKDF2 600k + AES-256-GCM end-to-end envelope), `utils/supabaseAuth.ts` (Google sign-in with PKCE, verified against the RFC 7636 test vector), `supabase/migrations/20261114000000_kairo_sync.sql` (`kairo_vault` encrypted, `kairo_state` readable for the connector, row-level security on both), `connector/src/supabaseStore.ts`. Still to do once a project exists: run the migration, enable the Google provider, build the Settings UI for sign-in + passphrase, and test the real OAuth round trip.

Code health done: `washi.css` split into ordered `styles/parts/*.css` (built CSS byte-identical), `WelcomeModal`, `AnalogDial` and `soundStudio/soundCatalog` extracted (App 1108 -> 1027 lines, Stage 1535 -> 1180, ControlPanel 2648 -> 2189). Further splitting of the `ControlPanel` and `SidebarNav` bodies is left; their state is tightly coupled.

Not built: further component splitting (`ControlPanel`, `Stage`, `SidebarNav`, `washi.css`), a dedicated Plan/Focus split screen on desktop (the sidebar is the Plan view), and everything in steps 7-10. Web Push when the app is closed needs step 7.

## Status (2026-11-14, earlier)

Done and tested (151 tests pass):
- `utils/structuredAi.ts` — `generateStructured()`: provider-side schema enforcement (OpenAI-compatible `json_schema`, Gemini `responseSchema`, Anthropic forced tool), automatic step-down for endpoints that reject schemas, local validation and safe repair (`conform`), one retry carrying the validation errors, timeout. Verified live on Ollama with qwen2.5 7B, llama3.2 3B and gemma3 4B.
- `utils/planMath.ts` — `estimateMultiplier`, `applyMultiplier`, `paceStatus`, `spreadRounds`, `daysBetween`, `toDayKey`. Pure and deterministic. This is the Phase 2 maths; do not re-derive it.
- `breakdownProjectTasks` and `breakdownSubtasks` in `utils/geminiAi.ts` now use `generateStructured`.

## Handoff: remaining work, in order (mechanical; a cheaper model can do it)

1. **Syllabus breakdown** (`utils/documentBreakdown.ts`, the block that builds the Gemini URL and the `JSON.parse(cleaned)` after it): replace with `generateStructured` using a schema for `{ projectName, summary, modules[{ name, topics[{ name, difficulty: enum, rounds, subtasks[] }] }] }`. Keep the PDF path on Gemini as is (inline file data is not supported by `generateStructured` yet). Keep the heuristic fallback. Keep existing tests green.
2. **Chrome built-in AI**: in `generateStructured`, before the network path, if `'LanguageModel' in self` and `await LanguageModel.availability()` is `'available'` and the user has no key, use `session.prompt(prompt, { responseConstraint: schema })`. The current code checks the old `window.ai.languageModel` name; update it.
3. **Live model lists** (`utils/modelCatalog.ts`): `listModels(config)` -> OpenAI/OpenRouter/custom `GET {base}/models`, Anthropic `GET {base}/models` (same headers as messages), Gemini `GET {base}/models` with `x-goog-api-key` (keep those supporting `generateContent`), Ollama `GET {origin}/api/tags`. Cache 24h in localStorage per provider+base. Settings model picker: live list first, `POPULAR_MODELS` as fallback. Refresh the fallback defaults (Anthropic: `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-opus-5-5`; look up current Gemini and OpenAI ids, do not guess).
4. **Evals**: `evals/syllabi/*.md` (20 varied syllabi) and `scripts/eval_ai.ts` that runs the breakdown per model and prints: schema-valid %, topic coverage %, total rounds, seconds. Not part of `npm run check`.
5. **Data model for the loop**: add `deadline?: string` (day key) to projects and `plannedDate?: string`, `estimatedRounds?: number` to tasks in `types.ts` + `data/validation.ts` (bump storage version, default missing fields). Set `estimatedRounds = targetRounds` at creation.
6. **Today panel + re-plan**: compute `paceStatus` from sessions (rounds per day, last 14 days) and `spreadRounds` for remaining tasks (apply `estimateMultiplier` first). Show status, required vs actual per day, and today's blocks. "Re-plan" button: offline = apply `spreadRounds`; with AI = send the pace numbers + remaining tasks to `generateStructured` asking for a diff (`reorder | split | re-estimate | drop-optional`, each with a one-line reason), show as a checklist, apply accepted items, then `spreadRounds`.
7. Verify each step in the browser on port 3010 (`kairo-dev-3010`; port 3000 is taken on this machine).

## Research notes (checked 2026-11-14; re-check official pages before launch)

- **Supabase free plan**: projects pause after about a week of low database activity and must be restored by hand from the dashboard, so the scheduled keep-alive ping is required, not optional. Reported limits: 2 projects, 500 MB database, 50,000 monthly active users, about 5 GB egress. Edge Function quota unconfirmed.
- **Free hosted AI is not viable as a product tier**: Gemini's free tier is reported at roughly 20-50 requests/day and may use prompts for training; OpenRouter `:free` models allow 50 requests/day per account (1,000 after a one-time $10 credit purchase) and may route to providers that train on data. Consequence for Phase 5: guests and free accounts use Chrome built-in AI, their own key, or local Ollama; hosted AI is Pro only, funded by the subscription.
- **Chrome built-in AI (Prompt API)**: global is `LanguageModel`; supports JSON Schema via `responseConstraint` since Chrome 137. Availability to ordinary websites on stable Chrome is not confirmed; needs about 22 GB free disk and more than 4 GB VRAM. Treat as a bonus path, feature-detect, never depend on it.
- **iOS push**: only for sites installed to the Home Screen (iOS 16.4+), and the permission request must come from a tap. Keep a normal service worker; Declarative Web Push is Safari-only.
- **Payments from India**: Dodo Payments markets itself to Indian solo founders (about 4% + $0.40); Paddle has eligibility checks; Lemon Squeezy (now owned by Stripe) may require a registered company. Sources were mostly vendor blogs: confirm eligibility and payouts directly before building Phase 6.
- **Ollama from a hosted site**: needs the site in `OLLAMA_ORIGINS` and Chrome's local-network permission (done for Helios + makekairo.netlify.app).

---

## USP: "Your AI plans. Kairo makes it happen, and tells your AI the truth."

The student's own chatbot (ChatGPT, Claude, Gemini, local) is the brain and pays for itself. Kairo is the timer plus the record of what really happened, and feeds that back so the next plan is calibrated. Open-source the code; compete on the student's history, the shared plan library, and being one tap away inside the chat.

### Phase A — Copy-paste bridge (no server, works with free chatbots; do this first)
- `utils/aiBridge.ts`
  - `buildAiContext(projects, sessions, today)`: returns a text block the student pastes into any chatbot. Contents: what Kairo is (2 lines), the reply format (the JSON schema below, in a fenced block), the student's numbers from `planMath` (`estimateMultiplier` overall and per project, `paceStatus` per project with a deadline, average rounds per day over 14 days), and remaining tasks with rounds. No names, emails or keys. Cap at about 6,000 characters.
  - `PLAN_SCHEMA` (a `JsonSchema` from `structuredAi.ts`): `{ projects: [{ name, deadline?: 'YYYY-MM-DD', tasks: [{ name, rounds: 1-12, subtasks?: string[] }] }] }` with length and count limits.
  - `parseAiPlan(text)`: `extractJson` then `conform(…, PLAN_SCHEMA)`; returns `{ plan, errors }`. Never trust the text beyond this.
  - `encodePlanLink(plan)` / `decodePlanLink(hash)`: base64url of the JSON in `#import=…` (hash, so it is never sent to a server). Reject over 20 KB.
- UI: "Use my AI" modal (sidebar item next to Import Syllabus) with two tabs.
  - "Copy context": shows the block, Copy button, one-line instructions per chatbot.
  - "Paste plan": textarea, live validation, a preview list (reuse the staging list from `DocumentBreakdownModal`), then "Import". Merge into an existing project when names match (case-insensitive); otherwise create.
- On load, if `location.hash` starts with `#import=`, open the same preview. Always preview; never import silently.
- Tests: round-trip link, hostile input (oversized, wrong types, script strings stay inert text), context contains no storage keys or API keys.
- FAQ entry: "Use Kairo with ChatGPT, Claude or Gemini".

### Phase B — Connected mode (needs Phase 4 accounts)
- Two modes, chosen by the user and explained plainly: **Private** (local only or end-to-end encrypted sync; no connector) and **Connected** (a readable server copy so an AI connector can work; encrypted at rest; delete any time).
- Tables with row-level security on `auth.uid()`: `projects`, `tasks`, `sessions` (rows, not one blob), `updated_at` on each. Client syncs rows both ways with last-write-wins per row and tombstones for deletes.

### Phase C — MCP connector (one server for Claude, ChatGPT, Gemini)
- Remote MCP server over Streamable HTTP on a free host (Cloudflare Workers or a Supabase Edge Function), OAuth 2.1 against Supabase Auth. Open source, self-hostable.
- Tools (inputs validated with the same schemas; every write returns what changed):
  - `get_today` — today's planned blocks, rounds done, pace status.
  - `get_study_profile` — the "study fingerprint": estimate multiplier overall and per project, rounds per day, usual focus hours, average session length.
  - `list_projects` / `list_tasks(project)`.
  - `add_plan(plan)` — same shape as `PLAN_SCHEMA`.
  - `add_subtasks(task, subtasks[])`, `set_deadline(project, date)`, `reschedule(project)` (runs `spreadRounds`).
  - `weekly_report` — planned vs done, honest numbers.
- Server instructions tell the model: read the profile before estimating; size tasks in 25-minute rounds; apply the multiplier; never invent completed work.
- Client reality (checked 2026-11-14, re-check): Claude accepts a custom connector by URL on every plan including Free (one connector). ChatGPT needs a paid plan; write tools on Plus are unconfirmed. Gemini's consumer app appears limited to the US and the top tier. So launch for Claude first; the paste bridge covers everyone else.
- Rate-limit per user; log tool calls without content.

### Phase D — Things a clone does not get
- **Course plan library**: share a plan as a link or publish it under "university + course code". Browse and import with the Phase A preview. Moderation: report button, text-only, size limits. Later: opt-in anonymous actuals ("students usually need 14 rounds for this unit").
- **Break quiz**: an MCP prompt `quiz_me` that hands the chatbot the topics studied in the last session; results logged as a session note.
- **In-chat cards** (ChatGPT Apps SDK, MCP Apps): today's plan and a start-timer link. Directory listing needs a verified developer identity.

### Money (after A and C work)
- Free: the web app, the paste bridge, private mode, self-hosting.
- Pro at a student price: Connected mode with the live connector, multi-device sync, the study profile and weekly report. Cost per user is near zero because the student's own subscription pays for the AI.
- Paid exam packs in the plan library with a revenue share for the author.
- Institutes: a cohort view with anonymous pace.
- Sponsorship for the open-source project.

---

## Pricing principle (overrides the earlier "Tiers", "Billing" and "Money" notes)

**"Every feature is free. You only pay if you want us to run it for you."**

- Free forever, no sign-up: timer, tasks, sounds, analytics, AI with a local model / own key / Chrome built-in AI, the copy-paste bridge, export/import, self-hosted sync and self-hosted connector (the server code is open source).
- **Kairo Cloud** (never called "Pro"; no feature is locked behind it): hosted sync across devices, the hosted AI connector, hosted backups. Same features a user can run themselves, minus the setup.
- Pricing page = one sentence plus a two-column table: "Do it yourself (free)" vs "We run it (Cloud)". Every row has an entry in both columns. If a row would be empty on the free side, the feature is not ready to ship.
- No hosted AI tier at launch (it is the only thing with a real per-user cost). Revisit only if users ask.

### Prices (starting points to test, not facts)
- Three regional bands by billing country (taken from the payment provider, not IP): A = high income, B = middle, C = lower-middle and low. Example: A $4/month or $30/year; B $2.50 or $18; C about $1.20 or $8 (India: about Rs 99 / Rs 699).
- **Exam pass**: one payment for 4 months, no auto-renew, priced a little under 4 monthly payments. Fits how students actually use it and works with one-time local methods such as UPI. Confirm the provider supports these before building.
- **Sponsored seats**: companies or individuals fund Cloud seats for students who ask for one (no verification theatre; a simple request form and a monthly cap). Sponsors are listed on a public page.
- Institutes: per-seat Cloud with an anonymous cohort pace view. Later: a cut of paid exam packs in the plan library.

### Order of work
1. Ship Phase A (paste bridge) and the re-plan loop, free and open source. No billing code yet.
2. Add privacy-friendly opt-in usage counts. Watch week-4 retention, not sign-ups.
3. Build accounts + Cloud sync + connector only when there are a few hundred weekly users asking for multi-device.
4. Add billing last, starting with the exam pass in band C and the yearly plan in band A.

### Honest numbers (estimates; conversion for free consumer apps is commonly quoted at 1-5%, unverified)
- Costs are near zero, so the first payer makes it profitable.
- 10,000 monthly users x 2% x about $1.50 blended = about $300/month. 100,000 = about $3,000/month.
- So: a real side income needs either six-figure users or institute deals. Plan distribution accordingly: shared course plans as public pages, student communities, AI connector directories, "Show HN" for the local-first angle.

---

## Zero-cost stack (researched 2026-11-14; third-party figures, confirm on each provider's own page)

Rule: nothing is added that has a fixed monthly cost. Fees are allowed only as a percentage of money already received.

| Need | Choice | Cost | Limit / catch |
|---|---|---|---|
| Web hosting | **Move to Cloudflare Pages** (`*.pages.dev`) | Free | Reported 500 builds/month, unlimited bandwidth. Netlify's free plan is now 300 credits/month (about 20 production deploys or about 15 GB) and the site pauses when they run out, so batch pushes until the move. |
| Domain | Keep the free subdomain | Free | A custom domain (about $10/year) is the only optional spend; it is also needed for sending email. |
| Sign-in | Supabase Auth with **Google sign-in only** | Free | No email magic links: Supabase's built-in email is 2/hour and test-only, and real email needs a domain + SMTP provider. |
| Database + sync | Supabase free | Free | Pauses after about a week idle; restore is manual. Keep-alive ping from a scheduled GitHub Action (free on public repos). Reported 500 MB, 50k monthly users. |
| AI connector (MCP) | Cloudflare Workers | Free | Reported 100,000 requests/day, short CPU time per request, so keep tools light. Does not pause. |
| AI itself | The student's own chatbot, key, or local model | Free | No hosted AI. This is the one item that could ever generate a bill; do not add it. |
| Notifications | Web Push (browser standard) | Free | iOS only when installed to the Home Screen. |
| Phone app | Installable web app (PWA) | Free | Skip the stores: Google Play has a one-time fee and Apple a yearly one. |
| Errors / usage | Sentry free tier, Cloudflare Web Analytics | Free | Keep usage counting opt-in. |
| Payments | Merchant of record, percentage per sale | No fixed fee reported | About 4% + $0.40 per sale; a per-payout fee may apply to small payouts, so pay out monthly. Costs only exist when there is income. Solo-individual and UPI support not confirmed. |
| Code, CI, evals | GitHub public repo + Actions; evals on local Ollama | Free | |

Guard rails so a bill can never appear: no card on file with any provider; free plans with hard caps only; a status note in the app if the Cloud is paused; every Cloud feature degrades to local mode.

## Value before price (why people would pay when everything is free)

People pay for service, not for unlocking. Cloud must be clearly easier than doing it yourself:
- One tap: "Sign in with Google" and the phone has your plan. The free route (own Supabase or self-hosted connector) stays real but takes setup.
- Never lose your streak or history: automatic backups and restore.
- Your AI already knows your week: the hosted connector, no copy-paste.
- Offer Cloud only at the moment of need (opening Kairo on a second device, after a data restore, when setting an exam deadline), never as a banner on the timer.
- Show what the student already got for free (hours focused, plans made) on the same screen as the offer.

## What has to be done, in order

1. Commit current work. Then stop pushing small changes to Netlify (credits).
2. Phase A paste bridge + handoff steps 1-7 (all free, no backend).
3. Move hosting to Cloudflare Pages; point the README and video at the new URL; update CSP file to `_headers`, update `OLLAMA_ORIGINS` on Helios and the hard-coded fallback origin in `utils/structuredAi.ts` / `utils/geminiAi.ts`.
4. PWA install + local notifications.
5. Launch free and open source; collect opt-in usage and feedback.
6. Only with real demand: Google sign-in + Supabase sync + keep-alive, then the Workers connector.
7. Only after that: payments, starting with the exam pass.

---

## Product revamp (step 2)

Goal: a stranger understands Kairo in 10 seconds and has a plan in 60. Today it opens on a timer with ten side features; after the revamp it opens on "what do I study today".

### Shape: four places, nothing else at the top level
1. **Today** (home): today's blocks in order, rounds done / planned, days to each deadline, pace chip (on track / behind / at risk), one primary button "Start next".
2. **Focus**: the timer (the existing dial), current task and subtasks, sound toggle. Nothing else on screen while running.
3. **Plan**: projects, tasks, subtasks, deadlines, the day-by-day schedule, "Import syllabus", "Use my AI", "Re-plan".
4. **Progress**: streak, heatmap, weekly bars, planned vs done, estimate accuracy.
Settings and Help stay as secondary items. Desktop: left rail with these four. Phone: bottom tab bar with the same four.

### First run (replaces the Welcome modal)
Three screens, skippable at any point, no sign-up:
1. "What are you studying for?" (name) and "When is it?" (date, optional).
2. "Paste your syllabus or topic list" with sample starters, or "I'll add tasks myself".
3. The staged plan with rounds per topic -> "Looks good". Lands on Today with the first block ready.
If no AI is configured, the offline planner makes the plan and a quiet line says how to get better plans (link to Help).

### Declutter (move, do not delete)
Under Settings > Extras, off by default: stage modes (keep Classic as the only default), time capsules / Future Treat, logo variants, palettes beyond light and dark, the science guide (link from Help), custom streams. Sound Studio stays but opens from Focus, not the main rail.

### Rules
- One primary action per screen. Empty states say what to do next and offer one button.
- Every number shown comes from `utils/planMath.ts` or `utils/analytics.ts`; no new maths in components.
- Keep the washi / sumi / vermilion tokens and fonts from `DESIGN.md`; this is a re-arrangement, not a re-skin.
- Split as you go: `SidebarNav` -> `NavRail` + `ProjectTree`; `Stage` -> `FocusDial` + `FocusHeader`; `ControlPanel` -> `SoundStudio` + `StreamPlayer`. New screens are new files under `components/screens/`. Move each area's CSS out of `washi.css` into its own file when touched.
- Keep all existing keyboard shortcuts and add `1-4` for the four places (move session-type switching to `Shift+1-3`; update the Shortcuts page and tests).
- Storage: no breaking changes; add `kairo_onboarded` and `kairo_extras`. Existing users skip onboarding and keep their layout choice.
- Accessibility: one `h1` per screen, tab bar as `nav` with `aria-current`, 44px targets on touch, reduced motion respected.

### Build order inside the revamp
1. Routing between the four places (state only, no router library) + the nav.
2. Today screen (needs handoff step 5 fields; show tasks without dates as "Unscheduled").
3. Onboarding flow, reusing the staging list from `DocumentBreakdownModal`.
4. Move Extras behind the setting; trim the Focus screen.
5. Plan and Progress screens from the existing sidebar tree and Analytics modal.
6. Browser check at 375px and 1280px, light and dark; re-record the launch video with the brag skill.

### Done when
- A new visitor reaches a plan and starts a session in under 60 seconds without reading help.
- The first screen shows at most one primary button and no more than seven interactive elements above the fold on a phone.
- All existing tests pass; new tests cover onboarding state, Today's block list, and the nav shortcuts.
