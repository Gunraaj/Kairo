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
          <h2 id="aibridge-title">Use my ChatGPT, Claude or Gemini</h2>
          <p className="k-modal-sub">Your AI plans, Kairo keeps you on it. Works with free chatbots. Nothing is sent from here.</p>
        </div>
        <button className="k-modal-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </header>

      <div className="k-modal-body k-aibridge-body">
        <div className="k-faq-tabs" role="tablist" aria-label="Steps">
          <button type="button" role="tab" aria-selected={tab === 'copy'} className={`k-faq-tab ${tab === 'copy' ? 'is-active' : ''}`} onClick={() => setTab('copy')}>1. Copy for your AI</button>
          <button type="button" role="tab" aria-selected={tab === 'paste'} className={`k-faq-tab ${tab === 'paste' ? 'is-active' : ''}`} onClick={() => setTab('paste')}>2. Paste its plan</button>
        </div>

        {tab === 'copy' && (
          <>
            <ol className="k-faq-steps">
              <li>Copy the text below and paste it into any chatbot.</li>
              <li>Replace the last line with your exam, topics and date.</li>
              <li>It answers with a plan. Copy that answer and come back to step 2.</li>
            </ol>
            <pre className="k-aibridge-context">{context}</pre>
            <div className="k-onboarding-actions">
              <button type="button" className="k-btn k-btn-primary" onClick={() => copy(context, 'context')}>{copied === 'context' ? 'Copied' : 'Copy text'}</button>
              <button type="button" className="k-btn" onClick={() => setTab('paste')}>I have the plan</button>
            </div>
            <p className="k-onboarding-note">The text has only task names and totals from your Kairo history. No keys, emails or session details.</p>
          </>
        )}

        {tab === 'paste' && (
          <>
            {!initialPlan && (
              <label className="k-onboarding-field">
                <span>Paste the AI's reply</span>
                <textarea value={reply} onChange={e => setReply(e.target.value)} rows={6} placeholder='{"projects":[{"name":"...","tasks":[...]}]}' />
              </label>
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
