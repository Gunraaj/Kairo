# Kairo to-do

Updated 2026-11-18. Newest decisions at the top of each section. Claude keeps this file current at the end of each work session.

## Needs you (accounts, codes or decisions)
- [ ] **Try Chromecast casting on your TV**: Chrome or Edge, TV → Cast to Chromecast. Check the timer is centred and Sound Studio sounds play. If stuck on the DashCast logo, use "Try full-page mode".
- [ ] **Netlify**: credits are used up, so makekairo.netlify.app is stuck on an old build. Decide: wait for the credit reset, or turn it into a redirect to kairo.makekairo.workers.dev (recommended).
- [ ] **Brevo SMTP key**: open Brevo → SMTP & API → generate key, and enter the 6-digit code it emails you. Then Claude adds it to Supabase so sign-in emails reach everyone (now: only the org owner, about 2 per hour).
- [ ] **Merge Dependabot updates** once Claude says which are safe (see "Next up").
- [ ] Clarify two older asks: "make all offline things an option in Settings" and "simplify how tasks and subtasks are divided". What should change?

## Next up (Claude can do)
- [ ] Review the 7 Dependabot PRs: test each locally, report safe / unsafe.
- [ ] Connector end-to-end test (needs Brevo first): sign in from Claude/ChatGPT, list projects, add a plan, check a forged token is refused. Then add the connector in Claude and ChatGPT.
- [ ] Decide whether the Zen and Cockpit layouts stay (Settings → Extras) or merge.
- [ ] Split the biggest components (`ControlPanel`, `SidebarNav`, `Stage`) to make future changes safer.

## Done recently
- 2026-11-17: Chromecast casting via DashCast with sound; TV view centred; Sound Studio sounds on TV (Web Audio fallback); "Long break every N sessions"; breaks unlock only when earned.
- 2026-11-17: Bigger text everywhere plus Settings → Text size; "Done by 9:36 PM · 2 h 35 min left" label; TV mode in this tab; second-screen tab.
- 2026-11-16: Duplicate tasks; "Keep sound playing when paused" setting; Netlify CLI installed (`npm run deploy:netlify`, blocked until credits reset).
- 2026-11-16: Free hosting on Cloudflare, optional encrypted sync, Claude/ChatGPT connector, privacy page, self-serve account deletion, security sweeps.
