# Kairo security review

Reviewed: 2026-07-21

## Executive summary

Kairo is a client-only, local-first application with no authentication, backend, or server-side data store. The highest-risk issues found were in the development and media-loading boundaries: an unpinned runtime Tailwind CDN, permissive user-supplied iframe URL conversion, unvalidated local-storage state, missing deployment security headers, and vulnerable build dependencies. Those issues were remediated in this hardening pass.

The current dependency audit reports zero known vulnerabilities. Strict TypeScript checks, twelve boundary and timer-state tests, and the production build pass. This is a strong baseline for a personal application, but it is not a formal penetration test or a guarantee of security.

## Findings

### KAIRO-SEC-001 - Runtime third-party script dependency

- Severity: High
- Status: Fixed
- Rule: WEB-SUPPLY-001, REACT-DEPENDENCIES-001
- Previous location: `index.html`
- Evidence: The application loaded `https://cdn.tailwindcss.com` at runtime and configured it through an inline script.
- Impact: Availability and page integrity depended on mutable third-party JavaScript executing with full origin privileges.
- Fix: Removed the runtime Tailwind script and Google Fonts requests. The app now ships all required CSS in the versioned production bundle.
- Verification: `index.html` contains only the local `/index.tsx` module entry.

### KAIRO-SEC-002 - Permissive lofi embed parsing

- Severity: High
- Status: Fixed
- Rule: WEB-URL-001, REACT-URL-001
- Location: `utils/embed.ts:8`, `components/ControlPanel.tsx:219`
- Evidence: The old converter accepted any string containing `spotify.com` and extracted YouTube parameters without validating protocol or host.
- Impact: Crafted input could load an unexpected frame origin or produce unsafe/invalid navigation behavior.
- Fix: Added an HTTPS-only parser with exact host, path, media-type, and identifier allowlists. YouTube links use the privacy-enhanced `youtube-nocookie.com` embed origin.
- Verification: `tests/embed.test.ts` covers valid links, hostile lookalike domains, non-HTTPS input, and script URLs.

### KAIRO-SEC-003 - Iframe lacked isolation controls

- Severity: Medium
- Status: Fixed
- Rule: WEB-IFRAME-001
- Location: `components/ControlPanel.tsx:470`
- Evidence: The lofi iframe previously had no sandbox or referrer policy.
- Impact: Embedded third-party content received broader browser capabilities and referral context than needed.
- Fix: Added a constrained sandbox, a strict referrer policy, lazy loading, and a narrow `allow` capability list.
- Residual note: `allow-same-origin` is required for the supported media players to function. The frame origin is still restricted by the URL allowlist and deployment CSP.

### KAIRO-SEC-004 - Untrusted local-storage records

- Severity: Medium
- Status: Fixed
- Rule: WEB-STORAGE-001, REACT-STORAGE-001
- Location: `hooks/useLocalStorage.ts:13`, `data/validation.ts:46`
- Evidence: Stored JSON was previously parsed directly into trusted application types.
- Impact: Corrupt, oversized, or manually modified storage could crash the UI, create invalid timer math, or cause excessive local memory use.
- Fix: Added versioned storage envelopes, schema normalization, numeric/text bounds, array limits, enum validation, and safe fallbacks. Legacy raw records migrate automatically.
- Verification: `tests/validation.test.ts` covers invalid settings, control characters, nested legacy projects, negative time, bad dates, and excessive duration.

### KAIRO-SEC-005 - Unrestricted ambient asset URLs

- Severity: Medium
- Status: Fixed
- Rule: WEB-URL-001
- Location: `utils/embed.ts:55`, `components/ControlPanel.tsx:69`
- Evidence: Catalogue URLs were passed directly to `Audio`.
- Impact: A modified local catalogue could make the app contact an arbitrary origin.
- Fix: Ambient assets are accepted only from HTTPS on `raw.githubusercontent.com` under the Moodist public-sounds repository path.

### KAIRO-SEC-006 - Missing deployment hardening headers

- Severity: Medium
- Status: Fixed and verified
- Rule: WEB-HEADERS-001, WEB-CSP-001
- Location: `vercel.json:2`, `netlify.toml:10`
- Evidence: Previous deployment files only configured single-page-app routing.
- Impact: A deployed app lacked CSP, framing protection, MIME sniffing protection, referrer minimization, and browser feature restrictions.
- Fix: Added equivalent Vercel and Netlify headers including CSP, `nosniff`, `DENY`, `no-referrer`, and a restrictive Permissions Policy.
- Verification: On 2026-07-21, `https://kairo-focus.netlify.app` returned HTTP 200 with the configured CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and the restrictive Permissions Policy. The compiled JavaScript asset and SPA fallback route also returned HTTP 200.

### KAIRO-SEC-007 - Vulnerable build dependency graph

- Severity: High
- Status: Fixed
- Rule: REACT-DEPENDENCIES-001
- Location: `package.json`, `package-lock.json`
- Evidence: `npm audit` initially reported five findings, including high-severity Vite, Rollup, and Picomatch advisories.
- Impact: The vulnerable paths primarily affected local development/build tooling, including Windows file-read/write boundaries and denial-of-service cases.
- Fix: Updated Vite to the non-breaking 6.4.3 patch and applied safe transitive updates. Direct versions are exact-pinned and the lockfile is committed.
- Verification: `npm audit` reports zero known vulnerabilities.

### KAIRO-SEC-008 - Local secret-like development file

- Severity: Informational
- Status: Open, not bundled
- Rule: WEB-SECRETS-001
- Location: `.env.local`
- Evidence: A local ignored file contains a variable named `GEMINI_API_KEY`; no application source references it.
- Impact: It is not included in the production bundle, but unused local credentials create avoidable rotation and workstation exposure risk.
- Recommendation: If the credential is obsolete, revoke it and remove the local file manually. Its value was not read or copied during this review.

### KAIRO-SEC-009 - CSP permitted inline styles

- Severity: Low
- Status: Fixed
- Rule: WEB-CSP-001
- Location: `vercel.json:6`, `netlify.toml:13`
- Previous evidence: `style-src` included `'unsafe-inline'` because timer, chart, task progress, and sculpture timing used React style attributes.
- Impact: The exception weakened CSP protection against style injection, though scripts remained restricted to the application origin.
- Fix: Replaced every dynamic style attribute with bounded `progress-pct-*` and `sculpture-delay-*` classes, then restricted `style-src` to `'self'`.
- Verification: No TSX file contains a `style` attribute and neither deployment policy contains `unsafe-inline` or `unsafe-eval`.

## Not applicable or not found

- No `dangerouslySetInnerHTML`, direct `innerHTML`, `eval`, or dynamic script injection was found.
- Authentication, authorization, CSRF, session cookies, database security, and server-side rate limiting are not applicable because the app has no backend.
- The application does not collect or transmit projects, tasks, settings, or focus history.

## Verification commands

```bash
npm audit
npm run check
```
