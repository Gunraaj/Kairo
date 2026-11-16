import React, { useState } from 'react';
import { Modal } from './Modal';
import { FocusSetupFields } from './FocusSetupModal';
import { CloudSyncCard } from './CloudSyncCard';
import { downloadSnapshot, importSnapshot } from '../utils/backup';
import type { UserSettings } from '../types';

type Props = {
  settings: UserSettings;
  setSettings: (settings: UserSettings) => void;
  onFinish: (next: 'plan' | 'timer') => void;
};

const STEPS = ['Welcome', 'Your focus', 'Optional extras', 'Start'] as const;

/** The one first-run popup: a short guided setup. Every step after the first can be skipped. */
export const WelcomeGuide: React.FC<Props> = ({ settings, setSettings, onFinish }) => {
  const [step, setStep] = useState(0);
  const [local, setLocal] = useState(settings);
  const finish = (next: 'plan' | 'timer') => { setSettings(local); onFinish(next); };
  const last = step === STEPS.length - 1;

  return (
    <Modal titleId="welcome-guide-title" onClose={() => finish('timer')} className="k-aibridge k-focus-setup k-guide">
      <header className="k-modal-header">
        <div>
          <h2 id="welcome-guide-title">{step === 0 ? 'Welcome to Kairo' : STEPS[step]}</h2>
          <p className="k-modal-sub">Step {step + 1} of {STEPS.length}. Change anything later in Settings.</p>
        </div>
      </header>
      <ol className="k-guide-dots" aria-hidden="true">
        {STEPS.map((label, i) => <li key={label} className={i <= step ? 'is-on' : ''} />)}
      </ol>

      <div className="k-modal-body k-aibridge-body">
        {step === 0 && (
          <div className="k-guide-copy">
            <p><b>Kairo plans your study days and runs your focus sessions.</b></p>
            <ul>
              <li>Free, with nothing locked behind a paywall.</li>
              <li>No account needed. Your plan stays in this browser and works offline.</li>
              <li>Takes about a minute to set up. You can skip any step.</li>
            </ul>
          </div>
        )}

        {step === 1 && <FocusSetupFields local={local} setLocal={setLocal} />}

        {step === 2 && (
          <div className="k-guide-copy">
            <section className="k-setup-row">
              <b>Sync across devices (optional)</b>
              <CloudSyncCard onRestore={importSnapshot} onBeforeRestore={() => downloadSnapshot('kairo-pre-restore')} />
            </section>
            <section className="k-setup-row">
              <b>Smarter plans with AI (optional)</b>
              <small>Kairo plans without AI. To let an AI write and fix your plans, add a free key or your local Ollama in Settings, AI.</small>
            </section>
          </div>
        )}

        {last && (
          <div className="k-guide-copy">
            <p>How do you want to start?</p>
            <div className="k-guide-choices">
              <button type="button" className="k-btn k-btn-primary" onClick={() => finish('plan')}>Make a study plan</button>
              <button type="button" className="k-btn" onClick={() => finish('timer')}>Just give me a timer</button>
            </div>
          </div>
        )}

        <div className="k-onboarding-actions k-guide-nav">
          {step > 0 && <button type="button" className="k-link-btn" onClick={() => setStep(s => s - 1)}>Back</button>}
          {!last && step > 0 && <button type="button" className="k-link-btn" onClick={() => setStep(s => s + 1)}>Skip</button>}
          {!last && <button type="button" className="k-btn k-btn-primary" onClick={() => setStep(s => s + 1)}>{step === 0 ? 'Get started' : 'Next'}</button>}
        </div>
      </div>
    </Modal>
  );
};
