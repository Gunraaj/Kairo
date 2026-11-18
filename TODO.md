# Kairo to-do

Updated 2026-11-18. New requests are added here with a priority first, then worked on in priority order.

**Priority:** P0 = do next, core to the product · P1 = soon, clearly improves daily use · P2 = later / nice to have
**Who:** Claude = Claude can do it alone · You = needs your account, code or decision

| # | Pri | Task | Who | Status | Notes |
|---|-----|------|-----|--------|-------|
| 1 | P0 | End-of-session sounds: a clear, loud sound when a focus session ends and a different one when a break ends | Claude | To do | One shared catalog (bells, chimes, gong, soft tones, etc.) with a preview button; pick one for "focus done" and one for "break done"; own volume; works with the timer, TV mode and Chromecast |
| 2 | P0 | Sound Studio revamp ("10x better") | Claude | To do | Rethink the right-side panel: what plays now, mixing, presets, search, layout. Volume controls already rebuilt 2026-11-18 |
| 3 | P0 | Try Chromecast casting on your TV | You | To do | Chrome or Edge, TV → Cast to Chromecast. Check centring and that Sound Studio sounds play. If stuck on the DashCast logo, use "Try full-page mode" |
| 4 | P1 | Push and deploy the 2026-11-18 work (upgrades, sidebar, volume controls) | You | Waiting for your OK | Committed locally; Cloudflare deploy after push |
| 5 | P1 | Consistent wording: "session" everywhere (not round / Pomodoro / session mixed); no typewriter font on counts | Claude | To do | Today list says "1 round", sidebar badge "2/6", Today header "sessions" |
| 6 | P1 | Whole-app intuition pass: labels, what each button does, first-time clarity | Claude | To do | You said the look is good but using it is not intuitive |
| 7 | P1 | Netlify: makekairo.netlify.app is stuck on an old build (credits used up) | You | Waiting | Credits likely reset around the 20th. Then `npm run deploy:netlify`. Or turn it into a redirect to Cloudflare |
| 8 | P1 | Brevo SMTP key so sign-in emails reach everyone | You | To do | Brevo → SMTP & API → generate key, enter the 6-digit code it emails you. Now only about 2 emails/hour to the owner |
| 9 | P1 | Connector end-to-end test, then add it in Claude and ChatGPT | Claude | Blocked by #8 | Sign in, list projects, add a plan, forged token refused |
| 10 | P2 | Clarify: "make all offline things an option in Settings" | You | Needs answer | What should change? |
| 11 | P2 | Clarify: "simplify how tasks and subtasks are divided" | You | Needs answer | What should change? |
| 12 | P2 | Decide whether the Zen and Cockpit layouts stay or merge | Claude | To do | Settings → Extras |
| 13 | P2 | Split the biggest components (`ControlPanel`, `SidebarNav`, `Stage`) | Claude | To do | Makes future changes safer |
| 14 | P2 | TypeScript 7 upgrade | Claude | Waiting | typescript-eslint does not support TS 7 yet |
| 15 | P2 | picomatch security advisory (build tools only, not shipped) | Claude | Waiting | No fixed release yet; recheck `npm audit` |

## Done
| Date | What |
|------|------|
| 2026-11-18 | Sidebar 304px wide; project, task and subtask names wrap to two lines instead of "Re…"; task details on their own line |
| 2026-11-18 | Volume controls rebuilt: long thick sliders, −/+ buttons (2%, Shift 1%), mouse wheel, perceived-loudness curve for fine control at low volume |
| 2026-11-18 | Upgrades: React 19.3, ESLint 10, gsap 3.15.1, GitHub Actions v7; Dependabot groups React and skips unsafe majors |
| 2026-11-17 | Chromecast casting via DashCast with sound; TV view centred; Sound Studio sounds on TV; "Long break every N sessions"; breaks unlock only when earned |
| 2026-11-17 | Bigger text everywhere plus Settings → Text size; readable "Done by" label; TV mode in this tab; second-screen tab |
| 2026-11-16 | Duplicate tasks; "Keep sound playing when paused"; Netlify CLI installed |
| 2026-11-16 | Free hosting on Cloudflare, optional encrypted sync, Claude/ChatGPT connector, privacy page, self-serve account deletion, security sweeps |
