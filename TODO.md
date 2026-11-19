# Kairo to-do

Updated 2026-11-18 (evening). New requests are added here with a priority first, then worked on in priority order.

**Priority:** P0 = do next, core to the product · P1 = soon, clearly improves daily use · P2 = later / nice to have
**Who:** Claude = Claude can do it alone · You = needs your account, code or decision

| # | Pri | Task | Who | Status | Notes |
|---|-----|------|-----|--------|-------|
| 1 | P0 | End-of-session sounds: a clear, loud sound when a focus session ends and a different one when a break ends | Claude | Done | Settings → 9 sounds with Test buttons, separate focus/break picks, alarm volume, ring 1–3×, also rings on Chromecast |
| 2 | P0 | Sound Studio revamp ("10x better") | Claude | Done (round 1) | Tile grid, one "Now playing" mixer with precise sliders, wider panel, plain labels. Tell me what still feels off |
| 3 | P0 | Try Chromecast casting on your TV | You | To do | Chrome or Edge, TV → Cast to Chromecast. Check: timer centred, Sound Studio and alarm sounds play, and whether the TV still falls asleep (then turn off Ambient mode on the TV) |
| 4 | P1 | Push and deploy the 2026-11-18 evening work (offline mode, checklist subtasks, security fix, lint clean-up, bug fixes) | Claude | Done | Pushed and live on Cloudflare 2026-11-18 |
| 5 | P1 | Consistent wording: "session" everywhere; no typewriter font on counts | Claude | Done | |
| 6 | P1 | Whole-app intuition pass: labels, what each button does | Claude | Done (round 1) | Plain labels + tooltips (Count it, Schedule my day, Plan exam revision, Not linked to a task). Next: watch you use it and fix what confuses |
| 7 | P1 | Netlify: makekairo.netlify.app is stuck on an old build (credits used up) | You | Waiting | Credits likely reset around the 20th. Then `npm run deploy:netlify`. Or turn it into a redirect to Cloudflare |
| 8 | P0 | Sign in with Google instead of emailed links (Brevo dropped) | Claude | Done | Google Cloud project "Kairo" (alias account), OAuth client, Supabase Google provider, consent screen published. Tested on the live site: sign-in works. Credentials live in .supabase-secrets |
| 9 | P1 | Connector end-to-end test, then add it in Claude and ChatGPT | Claude | Test done; you add it | Tested with Google sign-in: token issued, tools work, forged token refused. Add `https://kairo-mcp.makekairo.workers.dev/mcp` as a custom connector in Claude / ChatGPT, then turn on Share with AI assistants in Kairo |
| 10 | P2 | "Make all offline things an option in Settings" | Claude | Done (my reading) | Settings → Your data → Offline mode: no internet connections; timer, plans, focus tones, cached sounds and local Ollama keep working. Tell me if you meant something else |
| 11 | P2 | "Simplify how tasks and subtasks are divided" | Claude | Done (my reading) | Subtasks read as a plain checklist; their session counters show only once used or on hover. Tell me if you meant something else |
| 12 | P2 | Zen and Cockpit layouts | Claude | Done | Kept both; the "Zen" layout is renamed "Minimal" so it is not confused with the Zen button |
| 13 | P2 | Split the biggest components (`ControlPanel`, `SidebarNav`, `Stage`) | Claude | Done (round 1) | Sidebar icons and the Sounds tab moved out; dead code removed. Further splits as features touch those files |
| 14 | P2 | TypeScript 7 upgrade | Claude | Waiting | typescript-eslint does not support TS 7 yet |
| 15 | P2 | picomatch security advisory (build tools only, not shipped) | Claude | Waiting | No fixed release yet; recheck `npm audit` |
| 16 | P0 | Allow less than 1 session per task (0.5 session) | Claude | Done | Plan popover: ½ chip, − from 1 goes to 0.5, typed minutes round up to halves; progress counts in halves for half targets |
| 17 | P0 | Subtask entry flow | Claude | Done (my reading) | Enter now adds the next subtask and keeps the box open (Esc / Enter on empty finishes); no jump to the checkbox. Tell me if you wanted the opposite |
| 18 | P0 | TV must not go to sleep while casting | Claude | Done (best effort) | TV page now holds a screen wake lock plus a silent video loop. Google TV still starts its own screensaver after ~10 min, so the TV menu tells you to turn off Ambient mode on the TV. Needs your real-TV test |
| 19 | P1 | Steadier subtask and per-session plan layout | Claude | Done (round 1) | Subtask rows: name and buttons on one line, badge below only when shown; plan popovers same width/alignment for tasks and subtasks |
| 20 | P1 | Toasts and the undo bar: close button, auto-fade | Claude | Done | × on both, fade-out, pause on hover, never overlap |
| 21 | P1 | Revamp Settings | Claude | Done (round 1) | Left menu that follows scrolling, search, new Alarms section, Text size moved to Appearance, wider dialog, tabs on phones |
| 22 | P1 | Revamp the left sidebar | Claude | Done (round 1) | Drag or Alt+Up/Down to reorder projects and tasks, project progress bar. Later ideas: quick-add shortcut, collapse-all |
| 23 | P1 | A proper FAQ / help page | Claude | Done | /help page with contents, search and answers rewritten for the current product; the in-app FAQ links to it |

## Done
| Date | What |
|------|------|
| 2026-11-19 | Half sessions; Enter adds next subtask; TV keep-awake; toasts with close + fade; steadier subtask rows; Help page; Settings revamp (menu, search, Alarms); sidebar drag/Alt-arrow reorder + project progress |
| 2026-11-19 | Google sign-in live (app and connector), Brevo dropped, connector tested end to end |
| 2026-11-18 | Linter fully clean (real types instead of `any`, correct hook deps); fixed stale default session length; welcome guide skippable from step 1; no vibrate errors |
| 2026-11-18 | Offline mode; subtasks as a checklist; security: script policy narrowed to Google's cast paths; dead code removed; sidebar icons and Sounds tab split out |
| 2026-11-18 | End-of-session alarm catalog; Sound Studio tile grid + single mixer; "session" wording everywhere; plain-language labels; Minimal layout name |
| 2026-11-18 | Sidebar 304px wide; project, task and subtask names wrap to two lines instead of "Re…"; task details on their own line |
| 2026-11-18 | Volume controls rebuilt: long thick sliders, −/+ buttons (2%, Shift 1%), mouse wheel, perceived-loudness curve for fine control at low volume |
| 2026-11-18 | Upgrades: React 19.3, ESLint 10, gsap 3.15.1, GitHub Actions v7; Dependabot groups React and skips unsafe majors |
| 2026-11-17 | Chromecast casting via DashCast with sound; TV view centred; Sound Studio sounds on TV; "Long break every N sessions"; breaks unlock only when earned |
| 2026-11-17 | Bigger text everywhere plus Settings → Text size; readable "Done by" label; TV mode in this tab; second-screen tab |
| 2026-11-16 | Duplicate tasks; "Keep sound playing when paused"; Netlify CLI installed |
| 2026-11-16 | Free hosting on Cloudflare, optional encrypted sync, Claude/ChatGPT connector, privacy page, self-serve account deletion, security sweeps |
