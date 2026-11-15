import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from './Modal';
import type { KairoSession, Project } from '../types';
import type { ImportedPlan } from '../utils/importPlan';
import { bridgeToImports } from '../utils/aiBridge';
import {
  aiBuildPlan, aiFollowUp, parseLength, planFromAnswers, SCRIPT, scriptedNext, studentProfile,
  type Answers, type ChatLine, type FitResult, type Question, type SlotId,
} from '../utils/aiInterview';
import { getAiConfig } from '../utils/geminiAi';
import { toDayKey } from '../utils/planMath';
import { chromeAiAvailable } from '../utils/structuredAi';

interface PlanInterviewModalProps {
  projects: Project[];
  sessions: KairoSession[];
  onImport: (plans: ImportedPlan[]) => void;
  onSessionLength?: (minutes: number) => void;
  onClose: () => void;
  onUploadFile: () => void;
  onUseChatbot: () => void;
}

type Phase = 'asking' | 'thinking' | 'planning' | 'review';
type Result = FitResult & { sessionsPerDay: number };

const aiConfigured = () => {
  const c = getAiConfig();
  return c.provider !== 'offline' && (c.provider === 'local' || Boolean(c.apiKey.trim()));
};

export const PlanInterviewModal: React.FC<PlanInterviewModalProps> = ({ projects, sessions, onImport, onSessionLength, onClose, onUploadFile, onUseChatbot }) => {
  const today = useMemo(() => toDayKey(new Date()), []);
  const profile = useMemo(() => studentProfile(projects, sessions, today), [projects, sessions, today]);
  const first = SCRIPT[0]!.question({});

  const [mode, setMode] = useState<'ai' | 'offline'>(() => (aiConfigured() ? 'ai' : 'offline'));
  const [lines, setLines] = useState<ChatLine[]>([{ role: 'coach', text: first.message }]);
  const [question, setQuestion] = useState<Question>(first);
  const [slot, setSlot] = useState<SlotId | null>('subject');
  const [answers, setAnswers] = useState<Answers>({});
  const [phase, setPhase] = useState<Phase>('asking');
  const [draft, setDraft] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<Result | null>(null);
  const [notice, setNotice] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'offline') chromeAiAvailable().then(ok => { if (ok) setMode('ai'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [lines, phase]);
  useEffect(() => { if (phase === 'asking') inputRef.current?.focus(); }, [phase, question]);

  const ask = (q: Question, nextSlot: SlotId | null) => {
    setQuestion(q);
    setSlot(nextSlot);
    setDraft('');
    setPicked(new Set());
    setLines(prev => [...prev, { role: 'coach', text: q.message }]);
    setPhase('asking');
  };

  const buildPlan = async (all: Answers) => {
    setPhase('planning');
    if (mode === 'ai') {
      try {
        setResult(await aiBuildPlan({ answers: all, profile, today }));
        setPhase('review');
        return;
      } catch {
        setNotice('The AI could not build the plan, so Kairo planned it from your answers.');
      }
    }
    setResult(planFromAnswers(all, today));
    setPhase('review');
  };

  const afterBasics = async (all: Answers) => {
    if (mode !== 'ai' || all.extra !== undefined) {
      await buildPlan(all);
      return;
    }
    setPhase('thinking');
    try {
      const follow = await aiFollowUp({ answers: all, profile, today });
      if (follow) {
        ask(follow, 'extra');
        return;
      }
    } catch {
      // The follow-up is optional; plan with what we have.
    }
    await buildPlan(all);
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || phase !== 'asking') return;
    setLines(prev => [...prev, { role: 'student', text }]);
    setDraft('');
    setPicked(new Set());
    const all = slot ? { ...answers, [slot]: text } : answers;
    setAnswers(all);
    const next = slot === 'extra' ? null : scriptedNext(all);
    if (next) ask(next.question, next.id);
    else await afterBasics(all);
  };

  const restart = () => {
    setLines([{ role: 'coach', text: first.message }]);
    setQuestion(first);
    setSlot('subject');
    setAnswers({});
    setResult(null);
    setNotice('');
    setPhase('asking');
  };

  const removeTask = (name: string) => {
    if (!result) return;
    const project = result.plan.projects[0]!;
    const tasks = project.tasks.filter(t => t.name !== name);
    setResult({ ...result, total: tasks.reduce((s, t) => s + t.rounds, 0), plan: { projects: [{ ...project, tasks }] } });
  };

  const project = result?.plan.projects[0];

  return (
    <Modal titleId="interview-title" onClose={onClose} className="k-aibridge k-interview">
      <header className="k-modal-header">
        <div>
          <h2 id="interview-title">New plan</h2>
          <p className="k-modal-sub">
            {mode === 'ai' ? `A few quick questions, one smart follow-up, then your AI (${getAiConfig().model || 'set in Settings'}) writes the plan.` : 'A few quick questions, then Kairo plans it. Works with no AI and no account.'}
          </p>
        </div>
        <button className="k-modal-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </header>

      <div className="k-modal-body k-interview-body">
        <div className="k-chat" aria-live="polite">
          {lines.map((line, i) => (
            <div key={i} className={`k-chat-line is-${line.role}`}><span>{line.text}</span></div>
          ))}
          {phase === 'thinking' && <div className="k-chat-line is-coach is-typing"><span>…</span></div>}
          {phase === 'planning' && <div className="k-chat-line is-coach is-typing"><span>Building your plan…</span></div>}
          {notice && <p className="k-onboarding-note">{notice}</p>}
          <div ref={endRef} />
        </div>

        {phase === 'asking' && (
          <div className="k-chat-input">
            {question.options.length > 0 && (
              <div className="k-chat-options" role="group" aria-label="Quick answers">
                {question.options.map(option => (
                  question.input === 'multi' ? (
                    <button key={option} type="button" className={`k-faq-tab ${picked.has(option) ? 'is-active' : ''}`} aria-pressed={picked.has(option)}
                      onClick={() => setPicked(prev => { const next = new Set(prev); if (next.has(option)) next.delete(option); else next.add(option); return next; })}>
                      {option}
                    </button>
                  ) : (
                    <button key={option} type="button" className="k-faq-tab" onClick={() => send(option)}>{option}</button>
                  )
                ))}
              </div>
            )}
            <form className="k-chat-form" onSubmit={e => { e.preventDefault(); send(question.input === 'multi' && picked.size ? [...picked, draft].filter(Boolean).join(', ') : draft); }}>
              {question.input === 'topics' ? (
                <textarea ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} rows={5} placeholder={'Thermodynamics\nOptics\nElectrostatics\n...or paste the whole syllabus'} aria-label="Your answer" />
              ) : question.input === 'date' ? (
                <input ref={inputRef} type="date" value={draft} min={today} onChange={e => setDraft(e.target.value)} aria-label="Pick the date" />
              ) : (
                <input ref={inputRef} type="text" value={draft} onChange={e => setDraft(e.target.value)} inputMode={question.input === 'number' ? 'decimal' : undefined}
                  placeholder={question.input === 'number' ? 'e.g. 2' : question.input === 'multi' ? 'Or type your own' : 'Type your answer'} aria-label="Your answer" />
              )}
              <button type="submit" className="k-btn k-btn-primary" disabled={!draft.trim() && !(question.input === 'multi' && picked.size)}>Send</button>
            </form>
            <div className="k-chat-footer">
              {answers.topics !== undefined && <button type="button" className="k-link-btn" onClick={() => buildPlan({ ...answers, extra: answers.extra ?? '' })}>Plan it now</button>}
              <button type="button" className="k-link-btn" onClick={onUploadFile}>Upload a syllabus file</button>
              <button type="button" className="k-link-btn" onClick={onUseChatbot}>Use ChatGPT or Claude instead</button>
            </div>
          </div>
        )}

        {phase === 'review' && result && project && (
          <div className="k-aibridge-preview">
            <p>
              <b>{project.name}</b>{project.deadline ? ` · exam ${project.deadline}` : ''} · {result.total} sessions
              {result.scaledFrom ? ` (cut from ${result.scaledFrom} to fit ${result.sessionsPerDay} sessions a day)` : ` · fits ${result.sessionsPerDay} sessions a day`}
            </p>
            {result.overflow > 0 && <p className="k-today-warn">Even trimmed, this needs about {result.overflow} more sessions than you have. Consider fewer topics or more sessions a day.</p>}
            <ol className="k-interview-tasks">
              {project.tasks.map(task => (
                <li key={task.name}>
                  <span><b>{task.name}</b>{task.subtasks?.length ? <small>{task.subtasks.join(' · ')}</small> : null}</span>
                  <span className="k-today-rounds">{task.rounds}</span>
                  <button type="button" className="k-link-btn" onClick={() => removeTask(task.name)} aria-label={`Remove ${task.name}`}>Remove</button>
                </li>
              ))}
            </ol>
            <div className="k-onboarding-actions">
              <button type="button" className="k-btn k-btn-primary" disabled={!project.tasks.length} onClick={() => { if (answers.length) onSessionLength?.(parseLength(answers.length)); onImport(bridgeToImports(result.plan, projects)); onClose(); }}>
                Add to Kairo
              </button>
              <button type="button" className="k-btn" onClick={restart}>Start over</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
