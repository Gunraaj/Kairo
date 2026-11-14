import React, { useState } from 'react';
import { Modal } from './Modal';

export interface OnboardingResult {
  name: string;
  deadline: string;
  text: string;
}

interface OnboardingModalProps {
  onSubmit: (result: OnboardingResult) => void;
  onSkip: () => void;
}

const SAMPLE = '## Unit 1: Foundations\n- Key definitions\n- Worked examples\n## Unit 2: Applications\n- Practice problem set\n- Past paper questions';

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onSubmit, onSkip }) => {
  const [name, setName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [text, setText] = useState('');
  const ready = text.trim().length >= 10;

  return (
    <Modal titleId="onboarding-title" onClose={onSkip} className="k-onboarding">
      <header className="k-modal-header">
        <div>
          <h2 id="onboarding-title">What are you studying for?</h2>
          <p className="k-modal-sub">Paste your topics and the date. Kairo plans each day and re-plans when you fall behind.</p>
        </div>
        <button className="k-modal-close" onClick={onSkip} aria-label="Skip for now">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </header>
      <div className="k-modal-body k-onboarding-body">
        <label className="k-onboarding-field">
          <span>Name (optional)</span>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Linear Algebra midterm" maxLength={80} />
        </label>
        <label className="k-onboarding-field">
          <span>Exam or deadline (optional)</span>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
        </label>
        <label className="k-onboarding-field">
          <span>Topics, syllabus or outline</span>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={7} placeholder={SAMPLE} />
        </label>
        <div className="k-onboarding-actions">
          <button type="button" className="k-btn k-btn-primary" disabled={!ready} onClick={() => onSubmit({ name: name.trim(), deadline, text: text.trim() })}>
            Make my plan
          </button>
          <button type="button" className="k-btn" onClick={onSkip}>I will add tasks myself</button>
        </div>
        <p className="k-onboarding-note">Works offline. If you set up an AI in Settings (including a local model), the plan gets smarter. Nothing leaves your device otherwise.</p>
      </div>
    </Modal>
  );
};
