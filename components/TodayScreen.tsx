import React from 'react';
import type { Pace } from '../utils/planMath';
import type { ProjectPlan, TodayState } from '../utils/todayPlan';
import { PHASE_ADVICE } from '../utils/examMode';

interface TodayScreenProps {
  state: TodayState;
  onStartBlock: (taskId: string) => void;
  onSetDeadline: (projectId: string, deadline: string) => void;
  onNewPlan: () => void;
  onOpenFocus: () => void;
  onOpenProgress: () => void;
  onOpenPlanBridge?: () => void;
  onReplan?: (projectId: string) => void;
  onExamSprint?: () => void;
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const paceChip = (pace: Pace | undefined): { text: string; tone: 'good' | 'warn' | 'bad' } | null => {
  if (!pace) return null;
  switch (pace.status) {
    case 'done': return { text: 'Done', tone: 'good' };
    case 'on-track':
      return pace.projectedDays === null
        ? { text: `Plan: about ${num(pace.requiredPerDay)} round(s) a day`, tone: 'good' }
        : { text: 'On track', tone: 'good' };
    case 'behind': return { text: `Behind: need ${num(pace.requiredPerDay)}/day, doing ${num(pace.actualPerDay)}`, tone: 'warn' };
    case 'at-risk': return { text: `At risk: about ${Math.max(1, Math.abs(pace.slackDays ?? 0))} day(s) short`, tone: 'bad' };
    case 'infeasible': return { text: `Too much for the time: ${num(pace.requiredPerDay)} rounds/day needed`, tone: 'bad' };
  }
};

const daysLabel = (plan: ProjectPlan): string | null => {
  if (!plan.pace) return null;
  const d = plan.pace.daysLeft;
  return d === 1 ? 'due tomorrow or today' : `${d} days left`;
};

export const TodayScreen: React.FC<TodayScreenProps> = ({
  state, onStartBlock, onSetDeadline, onNewPlan, onOpenFocus, onOpenProgress, onOpenPlanBridge, onReplan, onExamSprint,
}) => {
  const { blocks, projects, multiplier, roundsToday, plannedToday, goal } = state;
  const first = blocks[0];
  const planned = Math.max(plannedToday, 1);
  const pct = Math.min(100, Math.round((roundsToday / (roundsToday + planned)) * 100));

  return (
    <section className="k-today" aria-labelledby="today-title">
      <div className="k-today-inner">
        <header className="k-today-head">
          <div>
            <h2 id="today-title">Today</h2>
            <p className="k-today-sub">
              {state.hasPlan
                ? `${num(roundsToday)} round${roundsToday === 1 ? '' : 's'} done · ${plannedToday} to go today (goal ${goal})`
                : 'Tell Kairo what you are studying and it plans each day for you.'}
            </p>
          </div>
          <div className="k-today-head-actions">
            <button type="button" className="k-btn" onClick={onOpenProgress}>Progress</button>
            <button type="button" className="k-btn" onClick={onOpenFocus}>Open timer</button>
          </div>
        </header>

        {state.exam && (
          <div className={`k-today-exam is-${state.exam.phase}`} role="region" aria-label="Exam mode">
            <div>
              <b>{PHASE_ADVICE[state.exam.phase].title}: {state.exam.name}</b>
              <p>{state.exam.daysLeft <= 0 ? 'Today. ' : `${state.exam.daysLeft} day${state.exam.daysLeft === 1 ? '' : 's'} left. `}{PHASE_ADVICE[state.exam.phase].advice}</p>
            </div>
            {onExamSprint && <button type="button" className="k-btn k-btn-primary" onClick={onExamSprint}>Plan a sprint</button>}
          </div>
        )}

        {!state.hasPlan && (
          <div className="k-today-empty">
            <p>No plan yet. Paste a syllabus or a topic list and set the date. Works offline, and better with an AI.</p>
            <div className="k-today-empty-actions">
              <button type="button" className="k-btn k-btn-primary" onClick={onNewPlan}>Make my plan</button>
              {onOpenPlanBridge && <button type="button" className="k-btn" onClick={onOpenPlanBridge}>Use my ChatGPT / Claude / Gemini</button>}
            </div>
          </div>
        )}

        {state.hasPlan && (
          <>
            <div className="k-today-bar" role="img" aria-label={`${pct}% of today's plan done`}>
              <span style={{ width: `${pct}%` }} />
            </div>

            {first ? (
              <button type="button" className="k-btn k-btn-primary k-today-next" onClick={() => onStartBlock(first.taskId)}>
                Start next: {first.taskName}
              </button>
            ) : (
              <p className="k-today-done">Nothing left for today. Rest, or open the timer to keep going.</p>
            )}

            <ol className="k-today-blocks">
              {blocks.map(block => (
                <li key={`${block.taskId}-${block.reason}`} className="k-today-block">
                  <div>
                    <b>{block.taskName}</b>
                    <small>{block.projectName}{block.reason === 'deadline' && block.deadline ? ` · due ${block.deadline}` : ' · no deadline'}</small>
                  </div>
                  <span className="k-today-rounds">{block.rounds} round{block.rounds === 1 ? '' : 's'}</span>
                  <button type="button" className="k-btn" onClick={() => onStartBlock(block.taskId)} aria-label={`Start ${block.taskName}`}>Start</button>
                </li>
              ))}
            </ol>
          </>
        )}

        {projects.length > 0 && (
          <div className="k-today-projects">
            <h3>Projects</h3>
            {projects.map(plan => {
              const chip = paceChip(plan.pace);
              return (
                <div key={plan.projectId} className="k-today-project">
                  <div className="k-today-project-main">
                    <b>{plan.name}</b>
                    <small>{plan.doneRounds}/{plan.totalRounds} rounds{daysLabel(plan) ? ` · ${daysLabel(plan)}` : ''}</small>
                    {chip && <span className={`k-today-chip is-${chip.tone}`}>{chip.text}</span>}
                    {onReplan && plan.pace && ['behind', 'at-risk', 'infeasible'].includes(plan.pace.status) && (
                      <button type="button" className="k-btn k-today-replan" onClick={() => onReplan(plan.projectId)}>Re-plan with AI</button>
                    )}
                    {plan.overflowRounds > 0 && <small className="k-today-warn">{plan.overflowRounds} rounds will not fit before the deadline. Move the date or drop topics.</small>}
                  </div>
                  <label className="k-today-deadline">
                    <small>Deadline</small>
                    <input type="date" value={plan.deadline ?? ''} onChange={e => onSetDeadline(plan.projectId, e.target.value)} aria-label={`Deadline for ${plan.name}`} />
                  </label>
                </div>
              );
            })}
            {multiplier !== 1 && (
              <p className="k-today-note">
                {multiplier > 1
                  ? `Your finished tasks took about ${multiplier}x the estimate, so remaining rounds are scaled up.`
                  : `You finish faster than estimated (${multiplier}x), so remaining rounds are scaled down.`}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
