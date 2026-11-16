import React, { useEffect, useState } from 'react';
import { activeSession, deleteCloudData, pullVault, pushVault, sendLink, signOut } from '../utils/kairoCloud';

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
        <p className="k-settings-hint">Optional. Sign in with just your email to keep an encrypted copy of your plan and open it on another device. Kairo works fully without it.</p>
        <form className="k-cloud-row" onSubmit={e => { e.preventDefault(); run(async () => { await sendLink(email, window.location.origin + window.location.pathname); setSent(true); return 'Link sent. Open it in this browser to finish signing in (check spam too).'; }); }}>
          <input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} aria-label="Email" required />
          <button type="submit" className="k-btn k-btn-primary" disabled={busy}>{sent ? 'Send again' : 'Email me a sign-in link'}</button>
        </form>
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
