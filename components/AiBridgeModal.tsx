import React, { useMemo, useState } from 'react';
import { Modal } from './Modal';
import type { KairoSession, Project } from '../types';
import type { ImportedPlan } from '../utils/importPlan';
import { bridgeToImports, buildAiContext, encodePlanLink, parseAiPlan, type BridgePlan } from '../utils/aiBridge';

interface AiBridgeModalProps {
  projects: Project[];
  sessions: KairoSession[];
  onImport: (plans: ImportedPlan[]) => void;
  onClose: () => void;
  initialPlan?: BridgePlan | null;
}

export const AiBridgeModal: React.FC<AiBridgeModalProps> = ({ projects, sessions, onImport, onClose, initialPlan = null }) => {
  const [tab, setTab] = useState<'copy' | 'paste'>(initialPlan ? 'paste' : 'copy');
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState<'context' | 'link' | null>(null);
  const [clipboardError, setClipboardError] = useState('');

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { setClipboardError('Your clipboard is empty. Copy the AI\'s last reply first.'); return; }
      setClipboardError('');
      setReply(text);
    } catch {
      setClipboardError('Your browser blocked clipboard access. Paste into the box below instead (Ctrl+V or long-press).');
    }
  };

  const context = useMemo(() => buildAiContext({ projects, sessions }), [projects, sessions]);
  const parsed = useMemo(() => {
    if (initialPlan && !reply.trim()) return { plan: initialPlan, errors: [] as string[] };
    return reply.trim() ? parseAiPlan(reply) : { plan: null, errors: [] as string[] };
  }, [reply, initialPlan]);
  const plan = parsed.plan;

  const copy = async (text: string, kind: 'context' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  };

  const link = plan ? encodePlanLink(plan) : null;
  const totalRounds = plan?.projects.reduce((sum, p) => sum + p.tasks.reduce((s, t) => s + t.rounds, 0), 0) ?? 0;

  return (
    <Modal titleId="aibridge-title" onClose={onClose} className="k-aibridge">
      <header className="k-modal-header">
        <div>
          <h2 id="aibridge-title">Plan with ChatGPT, Claude or Gemini</h2>
          <p className="k-modal-sub">Your AI interviews you and plans it; Kairo keeps you on it. Works with free plans. Kairo itself sends nothing.</p>
        </div>
        <button className="k-modal-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </header>

      <div className="k-modal-body k-aibridge-body">
        <div className="k-faq-tabs" role="tablist" aria-label="Steps">
          <button type="button" role="tab" aria-selected={tab === 'copy'} className={`k-faq-tab ${tab === 'copy' ? 'is-active' : ''}`} onClick={() => setTab('copy')}>1. Chat with your AI</button>
          <button type="button" role="tab" aria-selected={tab === 'paste'} className={`k-faq-tab ${tab === 'paste' ? 'is-active' : ''}`} onClick={() => setTab('paste')}>2. Bring the plan back</button>
        </div>

        {tab === 'copy' && (
          <>
            <ol className="k-faq-steps">
              <li>Open your AI below. It interviews you about your exam, one question at a time.</li>
              <li>When it shows the plan, copy its last reply (the copy icon under the message) and come back.</li>
            </ol>
            <div className="k-onboarding-actions">
              <a className="k-btn k-btn-primary" href={`https://chatgpt.com/?q=${encodeURIComponent(context)}`} target="_blank" rel="noopener noreferrer" onClick={() => setTab('paste')}>Open in ChatGPT</a>
              <a className="k-btn k-btn-primary" href={`https://claude.ai/new?q=${encodeURIComponent(context)}`} target="_blank" rel="noopener noreferrer" onClick={() => setTab('paste')}>Open in Claude</a>
              <button type="button" className="k-btn" onClick={() => { void copy(context, 'context'); setTab('paste'); }}>{copied === 'context' ? 'Copied' : 'Copy for Gemini or others'}</button>
            </div>
            <details className="k-aibridge-details">
              <summary>See what is sent</summary>
              <pre className="k-aibridge-context">{context}</pre>
            </details>
            <p className="k-onboarding-note">The text has only task names and totals from your Kairo history. No keys, emails or session details.</p>
          </>
        )}

        {tab === 'paste' && (
          <>
            {!initialPlan && (
              <>
                <button type="button" className="k-btn k-btn-primary" onClick={pasteFromClipboard}>Paste the AI's reply</button>
                {clipboardError && <p className="k-onboarding-note">{clipboardError}</p>}
                <label className="k-onboarding-field">
                  <span>Or paste it here yourself (the whole reply is fine)</span>
                  <textarea value={reply} onChange={e => setReply(e.target.value)} rows={4} placeholder="Paste your AI's last reply" />
                </label>
              </>
            )}
            {parsed.errors.length > 0 && (
              <ul className="k-aibridge-errors" role="alert">
                {parsed.errors.map(error => <li key={error}>{error}</li>)}
              </ul>
            )}
            {plan && (
              <div className="k-aibridge-preview">
                <p><b>{plan.projects.length} project{plan.projects.length === 1 ? '' : 's'}</b> · {totalRounds} rounds · review before importing</p>
                {plan.projects.map(project => (
                  <div key={project.name} className="k-aibridge-project">
                    <b>{project.name}</b>
                    <small>{project.deadline ? `due ${project.deadline}` : 'no deadline'}{projects.some(p => p.name.trim().toLowerCase() === project.name.trim().toLowerCase()) ? ' · adds to your existing project' : ''}</small>
                    <ul>
                      {project.tasks.map(task => <li key={task.name}>{task.name} <span className="k-today-rounds">{task.rounds}</span></li>)}
                    </ul>
                  </div>
                ))}
                <div className="k-onboarding-actions">
                  <button type="button" className="k-btn k-btn-primary" onClick={() => { onImport(bridgeToImports(plan, projects)); onClose(); }}>Import into Kairo</button>
                  {link && <button type="button" className="k-btn" onClick={() => copy(`${location.origin}${location.pathname}${link}`, 'link')}>{copied === 'link' ? 'Link copied' : 'Copy share link'}</button>}
                </div>
              </div>
            )}
            {!plan && !reply.trim() && !initialPlan && <p className="k-onboarding-note">Nothing yet. Do step 1 first, then paste the reply here.</p>}
          </>
        )}
      </div>
    </Modal>
  );
};
