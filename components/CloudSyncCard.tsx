import React, { useEffect, useRef, useState } from 'react';
import { loadTurnstile, TURNSTILE_SITEKEY } from '../utils/turnstile';
import { activeSession, aiShareEnabled, deleteCloudData, pullAiState, pullVault, pushAiState, pushVault, sendLink, setAiShare, signOut } from '../utils/kairoCloud';

const CONNECTOR_URL = 'https://kairo-mcp.makekairo.workers.dev/mcp';

type Props = { onRestore: (text: string) => number; onBeforeRestore: () => void };

const LAST_SYNC_KEY = 'kairo_cloud_last_sync';
const readLastSync = () => { try { return localStorage.getItem(LAST_SYNC_KEY) ?? ''; } catch { return ''; } };

export const CloudSyncCard: React.FC<Props> = ({ onRestore, onBeforeRestore }) => {
  const [signedIn, setSignedIn] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [lastSync, setLastSync] = useState(readLastSync);
  const [share, setShare] = useState(aiShareEnabled);

  const captchaBox = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [captcha, setCaptcha] = useState('');

  useEffect(() => {
    if (signedIn || !captchaBox.current) return;
    let cancelled = false;
    loadTurnstile()
      .then(api => {
        if (cancelled || !captchaBox.current || widgetId.current) return;
        widgetId.current = api.render(captchaBox.current, {
          sitekey: TURNSTILE_SITEKEY,
          size: 'flexible',
          callback: (token: string) => setCaptcha(token),
          'expired-callback': () => setCaptcha(''),
          'error-callback': () => setCaptcha(''),
        });
      })
      .catch(error => setStatus(error instanceof Error ? error.message : 'Bot check could not load.'));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [signedIn]);

  const resetCaptcha = () => {
    setCaptcha('');
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  };

  useEffect(() => { activeSession().then(s => setSignedIn(Boolean(s))).catch(() => setSignedIn(false)); }, []);

  const run = async (task: () => Promise<string | void>) => {
    setBusy(true);
    setStatus('');
    try {
      const message = await task();
      if (message) setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const stampSync = (iso: string) => {
    try { localStorage.setItem(LAST_SYNC_KEY, iso); } catch { /* storage unavailable */ }
    setLastSync(iso);
  };

  if (!signedIn) {
    return (
      <div className="k-cloud">
        <p className="k-settings-hint">Optional. Sign in with just your email to keep an encrypted copy of your plan and open it on another device. Kairo works fully without it. <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy</a></p>
        <form className="k-cloud-row" onSubmit={e => { e.preventDefault(); run(async () => { try { await sendLink(email, window.location.origin + window.location.pathname, captcha); } finally { resetCaptcha(); } setSent(true); return 'Link sent. Open it in this browser to finish signing in (check spam too).'; }); }}>
          <input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} aria-label="Email" required />
          <button type="submit" className="k-btn k-btn-primary" disabled={busy || !captcha}>{sent ? 'Send again' : 'Email me a sign-in link'}</button>
        </form>
        <div ref={captchaBox} className="k-cloud-captcha" />
        {status && <p className="k-settings-hint" role="status">{status}</p>}
      </div>
    );
  }

  return (
    <div className="k-cloud">
      <p className="k-settings-hint">
        Your data is encrypted in this browser with your passphrase before upload. We cannot read it, and cannot recover it if you forget the passphrase.
        {lastSync && <> Last synced {new Date(lastSync).toLocaleString()}.</>}
      </p>
      <div className="k-cloud-row">
        <input type="password" autoComplete="new-password" placeholder="Sync passphrase (8+ characters)" value={passphrase} onChange={e => setPassphrase(e.target.value)} aria-label="Sync passphrase" />
      </div>
      <div className="k-cloud-row">
        <button type="button" className="k-btn k-btn-primary" disabled={busy || passphrase.length < 8} onClick={() => run(async () => { stampSync(await pushVault(passphrase)); return 'Saved to the cloud.'; })}>Save to cloud</button>
        <button type="button" className="k-btn" disabled={busy || passphrase.length < 8} onClick={() => run(async () => {
          const result = await pullVault(passphrase);
          if (!result) return 'Nothing saved in the cloud yet.';
          if (!window.confirm('Replace the plan in this browser with the cloud copy? A backup file of the current one downloads first.')) return;
          onBeforeRestore();
          const count = onRestore(result.text);
          stampSync(result.updatedAt || new Date().toISOString());
          window.setTimeout(() => window.location.reload(), 600);
          return `Restored ${count} items. Reloading…`;
        })}>Load from cloud</button>
      </div>
      <div className="k-cloud-ai">
        <label className="k-cloud-row">
          <input type="checkbox" checked={share} disabled={busy} onChange={e => { const on = e.target.checked; run(async () => { await setAiShare(on); setShare(on); return on ? 'Shared. Claude or ChatGPT can now read and add to your plan.' : 'Stopped sharing. The readable copy was deleted.'; }); }} />
          <span><b>Share with AI assistants</b> (Claude, ChatGPT). This copy is not encrypted, so the connector can read it.</span>
        </label>
        {share && (
          <>
            <p className="k-settings-hint">In Claude or ChatGPT, add a custom connector with this address, then sign in with this email:</p>
            <div className="k-cloud-row">
              <input readOnly value={CONNECTOR_URL} aria-label="Connector address" onFocus={e => e.currentTarget.select()} />
              <button type="button" className="k-btn" onClick={() => { void navigator.clipboard?.writeText(CONNECTOR_URL); setStatus('Address copied.'); }}>Copy</button>
            </div>
            <div className="k-cloud-row">
              <button type="button" className="k-btn" disabled={busy} onClick={() => run(async () => { await pushAiState(); return 'Sent your latest plan to the AI copy.'; })}>Send my plan</button>
              <button type="button" className="k-btn" disabled={busy} onClick={() => run(async () => {
                if (!window.confirm('Replace your projects here with the AI copy? A backup file downloads first.')) return;
                onBeforeRestore();
                const count = await pullAiState();
                if (count === null) return 'Nothing shared yet.';
                window.setTimeout(() => window.location.reload(), 600);
                return `Loaded ${count} projects. Reloading…`;
              })}>Get AI changes</button>
            </div>
          </>
        )}
      </div>
      <div className="k-cloud-row">
        <button type="button" className="k-link-btn" disabled={busy} onClick={() => run(async () => { await signOut(); setSignedIn(false); setSent(false); return 'Signed out. Your local data is untouched.'; })}>Sign out</button>
        <button type="button" className="k-link-btn k-danger-link" disabled={busy} onClick={() => run(async () => {
          if (!window.confirm('Delete your cloud copy? This cannot be undone. Data in this browser stays.')) return;
          await deleteCloudData();
          return 'Cloud copy deleted.';
        })}>Delete cloud copy</button>
      </div>
      {status && <p className="k-settings-hint" role="status">{status}</p>}
    </div>
  );
};
