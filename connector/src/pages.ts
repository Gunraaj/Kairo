import type { ConsentDescription } from '@cloudflare/workers-oauth-provider';

/** Everything client-supplied (name, host, scopes) is attacker-controlled: escape it. */
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);

const shell = (title: string, body: string, extraHead = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>${extraHead}
<style>
:root{color-scheme:light dark;--bg:#f6f2ea;--card:#fffdf8;--ink:#1e1b17;--muted:#6b645a;--line:#e3dccf;--accent:#d2452f}
@media (prefers-color-scheme:dark){:root{--bg:#0f0f13;--card:#17171d;--ink:#eee9df;--muted:#a49d92;--line:#2a2a33}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif;padding:16px}
main{width:100%;max-width:440px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:24px}
h1{font-size:20px;margin:0 0 8px}p{margin:0 0 12px;color:var(--muted)}b{color:var(--ink)}
label{display:block;font-weight:600;margin:12px 0 6px}input[type=email]{width:100%;padding:10px;border-radius:8px;border:1px solid var(--line);background:transparent;color:inherit;font:inherit}
.row{display:flex;gap:8px;margin-top:16px}button{flex:1;padding:10px;border-radius:8px;border:1px solid var(--line);background:transparent;color:inherit;font:inherit;cursor:pointer}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}.warn{color:var(--accent)}ul{margin:0 0 12px;padding-left:18px;color:var(--muted)}
</style></head><body><main>${body}</main></body></html>`;

export const renderMessage = (title: string, text: string) => shell(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p>`);

export const renderAuthorizePage = (details: ConsentDescription, handle: string, sitekey: string) => {
  const name = escapeHtml(details.clientName || 'An app');
  const origin = details.clientDomain
    ? `Published by <b>${escapeHtml(details.clientDomain)}</b>.`
    : 'This app registered itself, so its name is not verified.';
  const loopback = details.redirectIsLoopback
    ? '<p class="warn"><b>This sends access to an app on your computer.</b> Continue only if you just started connecting from it.</p>'
    : '';
  return shell(`Connect ${details.clientName || 'app'} to Kairo`, `
<h1>Allow ${name} to use your Kairo plan?</h1>
<p>${origin} Access goes to <b>${escapeHtml(details.redirectHost)}</b>.</p>
${loopback}
<ul><li>Read your projects, deadlines and study history</li><li>Add plans, subtasks and deadlines</li></ul>
<p>It only sees your plan if you turned on <b>Share with AI assistants</b> in Kairo Settings. You can revoke access by turning sharing off in the app. <a href="https://kairo.makekairo.workers.dev/privacy.html">Privacy</a></p>
<form method="post" action="/authorize">
  <input type="hidden" name="handle" value="${escapeHtml(handle)}">
  <label for="email">Your Kairo Cloud email</label>
  <input id="email" name="email" type="email" autocomplete="email" required>
  <div class="cf-turnstile" data-sitekey="${escapeHtml(sitekey)}" data-size="flexible" style="margin-top:12px"></div>
  <div class="row">
    <button type="submit" name="decision" value="deny" formnovalidate>Deny</button>
    <button type="submit" name="decision" value="approve" class="primary">Email me a link</button>
  </div>
</form>`, '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>');
};
