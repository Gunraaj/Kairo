import React, { useEffect, useState } from 'react';
import { activeSession, aiShareEnabled, deleteAccount, deleteCloudData, pullAiState, pullVault, pushAiState, pushVault, setAiShare, signInWithGoogle, signOut } from '../utils/kairoCloud';

const CONNECTOR_URL = 'https://kairo-mcp.makekairo.workers.dev/mcp';

type Props = { onRestore: (text: string) => number; onBeforeRestore: () => void };

const LAST_SYNC_KEY = 'kairo_cloud_last_sync';
const readLastSync = () => { try { return localStorage.getItem(LAST_SYNC_KEY) ?? ''; } catch { return ''; } };

export const CloudSyncCard: React.FC<Props> = ({ onRestore, onBeforeRestore }) => {
  const [signedIn, setSignedIn] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [lastSync, setLastSync] = useState(readLastSync);
  const [share, setShare] = useState(aiShareEnabled);

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
        <p className="k-settings-hint">Optional. Sign in to keep an encrypted copy of your plan and open it on another device. Kairo works fully without it. <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy</a></p>
        <button
          type="button"
          className="k-btn k-google-btn"
          disabled={busy}
          onClick={() => run(async () => { await signInWithGoogle(window.location.origin + window.location.pathname); })}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z" />
          </svg>
          {busy ? 'Opening Google…' : 'Continue with Google'}
        </button>
        <p className="k-settings-hint">Kairo only receives your email address from Google, never your password.</p>
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
        <button type="button" className="k-link-btn" disabled={busy} onClick={() => run(async () => { await signOut(); setSignedIn(false); return 'Signed out. Your local data is untouched.'; })}>Sign out</button>
        <button type="button" className="k-link-btn k-danger-link" disabled={busy} onClick={() => run(async () => {
          if (!window.confirm('Delete your cloud copy? This cannot be undone. Data in this browser stays.')) return;
          await deleteCloudData();
          return 'Cloud copy deleted.';
        })}>Delete cloud copy</button>
        <button type="button" className="k-link-btn k-danger-link" disabled={busy} onClick={() => run(async () => {
          if (!window.confirm('Delete your Kairo Cloud account? This erases your email and every cloud copy, and cannot be undone. Data in this browser stays.')) return;
          await deleteAccount();
          setSignedIn(false); setShare(false);
          return 'Account deleted. Everything in the cloud is gone; this browser still has your plan.';
        })}>Delete my account</button>
      </div>
      {status && <p className="k-settings-hint" role="status">{status}</p>}
    </div>
  );
};
