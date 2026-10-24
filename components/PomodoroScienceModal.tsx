import React, { useState } from 'react';
import { Modal } from './Modal';

interface PomodoroScienceModalProps {
  onClose: () => void;
}

type TabKey = 'method' | 'biology' | 'research' | 'protocol';

interface ResearchPaper {
  title: string;
  authors: string;
  journal: string;
  year: number;
  url: string;
  finding: string;
  takeaway: string;
}

const PAPERS: ResearchPaper[] = [
  {
    title: 'Brief and rare mental "breaks" keep you focused: Deactivation and reactivation of task goals preempt vigilance decrements',
    authors: 'Atsunori Ariga & Alejandro Lleras',
    journal: 'Cognition (University of Illinois)',
    year: 2011,
    url: 'https://doi.org/10.1016/j.cognition.2010.12.007',
    finding: 'Continuous focus on a single task causes habituation: the brain treats constant stimulation as unimportant and cancels it out, leading to vigilance decrements.',
    takeaway: 'Taking brief mental breaks deactivates and reactivates task goals, allowing prolonged high-level focus without cognitive drop-off.',
  },
  {
    title: 'The Restorative Benefits of Nature: Toward an Integrative Framework',
    authors: 'Stephen Kaplan',
    journal: 'Journal of Environmental Psychology (University of Michigan)',
    year: 1995,
    url: 'https://doi.org/10.1016/0272-4944(95)90001-2',
    finding: 'Formulated Attention Restoration Theory (ART). Directed voluntary attention requires strenuous inhibitory control in the prefrontal cortex.',
    takeaway: 'Breaks involving "soft fascination" (gazing into nature, looking out the window) restore directed attention mechanisms while high-stimulus tasks deplete them.',
  },
  {
    title: 'Inspired by Distraction: Mind Wandering Facilitates Creative Incubation',
    authors: 'Benjamin Baird, Jonathan Smallwood, Michael Mrazek, et al.',
    journal: 'Psychological Science',
    year: 2012,
    url: 'https://doi.org/10.1177/0956797612446024',
    finding: 'Engaging in an undemanding rest interval yields substantial improvements on creative problem solving compared to continuous work or forced sleep.',
    takeaway: 'The Default Mode Network (DMN) activates during diffuse rest intervals, linking disparate concepts and solving stubborn roadblocks in the background.',
  },
  {
    title: 'Implementation Intentions: Strong Effects of Simple Plans',
    authors: 'Peter M. Gollwitzer',
    journal: 'American Psychologist (New York University)',
    year: 1999,
    url: 'https://doi.org/10.1037/0003-066X.54.7.493',
    finding: 'Formulating explicit "if-then" intentions ("When timer starts, I will write paragraph 1") drastically increases goal attainment over vague intentions.',
    takeaway: 'Naming your single focus goal before pressing start shields your attention from distractions and primes automatic action.',
  },
  {
    title: 'Basic Rest-Activity Cycle—22 Years Later',
    authors: 'Nathaniel Kleitman',
    journal: 'Sleep (University of Chicago)',
    year: 1982,
    url: 'https://doi.org/10.1093/sleep/5.4.311',
    finding: 'Demonstrated that human biological alertness operates on ultradian rhythms of 90 to 120 minutes during both waking and sleeping states.',
    takeaway: 'Human physiology is not designed for continuous sustained alertness; it thrives on oscillating waves of peak focus and conscious replenishment.',
  },
  {
    title: 'The Pomodoro Technique: The Acclaimed Time-Management System That Has Transformed How We Work',
    authors: 'Francesco Cirillo',
    journal: 'FC Garages Monograph',
    year: 2006,
    url: 'https://francescocirillo.com/products/the-pomodoro-technique',
    finding: 'The original 1980s methodology using a mechanical tomato timer. Shows how externalizing time into a physical countdown dissolves temporal anxiety.',
    takeaway: 'Time is transformed from an adversary ("I don\'t have enough time") into an ally ("I only need to protect these next 25 minutes").',
  },
];

export const PomodoroScienceModal: React.FC<PomodoroScienceModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('method');

  return (
    <Modal titleId="science-modal-title" onClose={onClose} className="k-science-dialog">
      <header className="k-modal-header">
        <div>
          <span className="k-science-eyebrow">The Science of Focus & Rhythms</span>
          <h2 id="science-modal-title">Why 25 Minutes Changes Everything</h2>
          <p className="k-modal-sub">
            The neurobiology, cognitive psychology, and empirical research behind Kairo.
          </p>
        </div>
        <button className="k-modal-close" onClick={onClose} aria-label="Close guide">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      {/* Tab Navigation */}
      <div className="k-science-nav" role="tablist" aria-label="Focus Guide Tabs">
        <button
          role="tab"
          aria-selected={activeTab === 'method'}
          className={`k-science-tab ${activeTab === 'method' ? 'active' : ''}`}
          onClick={() => setActiveTab('method')}
        >
          <span>🍅</span> The Method
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'biology'}
          className={`k-science-tab ${activeTab === 'biology' ? 'active' : ''}`}
          onClick={() => setActiveTab('biology')}
        >
          <span>🧠</span> Biology of Breaks
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'research'}
          className={`k-science-tab ${activeTab === 'research' ? 'active' : ''}`}
          onClick={() => setActiveTab('research')}
        >
          <span>📚</span> Research Papers
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'protocol'}
          className={`k-science-tab ${activeTab === 'protocol' ? 'active' : ''}`}
          onClick={() => setActiveTab('protocol')}
        >
          <span>✨</span> Ideal Break Protocol
        </button>
      </div>

      <div className="k-modal-body k-science-body">
        {activeTab === 'method' && (
          <div className="k-science-section">
            <div className="k-science-banner">
              <h3>The Pomodoro Technique: From Tomato Timer to Deep Work</h3>
              <p>
                In the late 1980s, university student Francesco Cirillo felt overwhelmed by coursework.
                He challenged himself: <i>"Can I study for just ten minutes without losing focus?"</i> He grabbed a
                tomato-shaped kitchen timer (<i>pomodoro</i> in Italian) and found that committing to an unbroken,
                bounded unit of time transformed his focus.
              </p>
            </div>

            <div className="k-science-grid-2">
              <div className="k-science-feature-card">
                <div className="k-science-card-icon">⏳</div>
                <h4>1. Taming Parkinson's Law</h4>
                <p>
                  <b>Parkinson's Law</b> states: <i>"Work expands so as to fill the time available for its completion."</i>
                  When you have all day to write a memo, it takes all day. A 25-minute Pomodoro establishes a gentle,
                  healthy artificial deadline that forces ruthless clarity on what matters.
                </p>
              </div>

              <div className="k-science-feature-card">
                <div className="k-science-card-icon">🎯</div>
                <h4>2. The Power of Single-Tasking</h4>
                <p>
                  Multitasking is a neurological myth. Dr. Gloria Mark's research at UC Irvine shows that when
                  interrupted, it takes an average of <b>23 minutes and 15 seconds</b> to return to deep flow.
                  Kairo creates an intentional sanctuary where only one task exists at a time.
                </p>
              </div>

              <div className="k-science-feature-card">
                <div className="k-science-card-icon">⚡</div>
                <h4>3. The Zeigarnik Effect</h4>
                <p>
                  Discovered by psychologist Bluma Zeigarnik in 1927: incomplete tasks occupy working memory and cause
                  subconscious cognitive friction. Breaking a large project into concrete 25-minute milestones
                  allows the brain to cleanly archive progress and rest peacefully.
                </p>
              </div>

              <div className="k-science-feature-card">
                <div className="k-science-card-icon">🛡️</div>
                <h4>4. Implementation Intentions</h4>
                <p>
                  Psychologist Peter Gollwitzer discovered that articulating an explicit goal before acting increases
                  follow-through by over 200%. Kairo's <b>Goal</b> input primes your brain to shield that specific intention
                  until the bell rings.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'biology' && (
          <div className="k-science-section">
            <div className="k-science-banner">
              <h3>Why Resting is an Active Part of Thinking</h3>
              <p>
                Many treat breaks as a concession to weakness. Neuroscience reveals the exact opposite:
                <b> strategic rest is when the brain consolidates learning, repairs neurotransmitters, and sparks insight.</b>
              </p>
            </div>

            <div className="k-science-deep-card">
              <h4>1. Ultradian Rhythms & Cognitive Fatigue</h4>
              <p>
                Pioneering sleep researcher <b>Nathaniel Kleitman</b> discovered that our nervous systems operate on
                90- to 120-minute <b>Basic Rest-Activity Cycles (BRAC)</b>. Throughout the day, alertness rises to a peak,
                then dips into an energetic trough. Attempting to power through without rest forces the body to release
                adrenaline and cortisol, degrading executive function and decision quality.
              </p>
            </div>

            <div className="k-science-deep-card">
              <h4>2. Attention Restoration Theory (ART)</h4>
              <p>
                Dr. Stephen Kaplan at the University of Michigan demonstrated that <b>directed attention</b> is a finite
                metabolic resource housed in the prefrontal cortex. Constant screen focus drains directed attention.
                However, when you shift to <b>soft fascination</b> (looking at distant foliage, stepping outside, breathing),
                the inhibitory mechanisms of the prefrontal cortex replenish, restoring sharpness for the next round.
              </p>
            </div>

            <div className="k-science-deep-card">
              <h4>3. The Default Mode Network (DMN) & Incubation</h4>
              <p>
                When you step away from a problem, the brain doesn't stop working. It activates the <b>Default Mode Network</b>,
                an interconnected circuit responsible for creative synthesis, memory consolidation, and perspective.
                Studies by Baird and Smallwood (2012) prove that periods of undemanding rest generate creative breakthroughs
                that continuous analytical focus cannot reach.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'research' && (
          <div className="k-science-section">
            <div className="k-science-banner">
              <h3>Peer-Reviewed Evidence Library</h3>
              <p>
                Kairo is built upon empirical literature across neuroscience, cognitive psychology, and ergonomics.
                Explore the foundational papers below:
              </p>
            </div>

            <div className="k-paper-list">
              {PAPERS.map((paper, idx) => (
                <article key={idx} className="k-paper-card">
                  <div className="k-paper-header">
                    <span className="k-paper-year">{paper.year}</span>
                    <span className="k-paper-journal">{paper.journal}</span>
                  </div>
                  <h4 className="k-paper-title">
                    <a href={paper.url} target="_blank" rel="noopener noreferrer">
                      {paper.title}
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M6 3h7v7M13 3L6 10" />
                      </svg>
                    </a>
                  </h4>
                  <div className="k-paper-authors">{paper.authors}</div>
                  <div className="k-paper-finding">
                    <b>Finding:</b> {paper.finding}
                  </div>
                  <div className="k-paper-takeaway">
                    <b>How Kairo applies this:</b> {paper.takeaway}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'protocol' && (
          <div className="k-science-section">
            <div className="k-science-banner">
              <h3>The High-Restoration Break Protocol</h3>
              <p>
                Not all breaks are created equal. A break spent scrolling social media or triaging urgent email
                keeps the prefrontal cortex in high-vigilance mode, worsening mental fatigue.
              </p>
            </div>

            <div className="k-protocol-columns">
              <div className="k-protocol-column do">
                <div className="k-protocol-col-header">
                  <span className="k-protocol-pill green">Recommended (Restores Attention)</span>
                </div>
                <ul className="k-protocol-list">
                  <li>
                    <b>The 20-20-20 Rule:</b> Look at an object at least 20 feet away for 20 seconds to relax the ciliary
                    muscles in your eyes and reset visual accommodation.
                  </li>
                  <li>
                    <b>Hydration & Salt:</b> Drink a tall glass of cool water. Even mild 1.5% dehydration triggers
                    measurable drops in cognitive speed and working memory.
                  </li>
                  <li>
                    <b>Spinal & Hip Extension:</b> Stand up, stretch your hip flexors, roll your shoulders back, and walk
                    around. Movement increases cerebral blood flow.
                  </li>
                  <li>
                    <b>Physiological Sigh:</b> Take two quick inhales through the nose, followed by a long, slow exhale
                    through the mouth to immediately reduce autonomic nervous system arousal.
                  </li>
                  <li>
                    <b>Window Gaze or Sunlight:</b> Get natural ambient light into your eyes to sustain daytime dopamine and
                    circadian alertness.
                  </li>
                </ul>
              </div>

              <div className="k-protocol-column avoid">
                <div className="k-protocol-col-header">
                  <span className="k-protocol-pill red">Avoid (Maintains Cognitive Drain)</span>
                </div>
                <ul className="k-protocol-list">
                  <li>
                    <b>Algorithmic Feeds:</b> Twitter, TikTok, and Instagram trigger rapid dopamine spikes and decision
                    fatigue, leaving your prefrontal cortex more drained than before.
                  </li>
                  <li>
                    <b>Inbox Triage & Slack:</b> Reading messages activates the threat-monitoring amygdala and creates open
                    mental loops that sabotage your subsequent focus round.
                  </li>
                  <li>
                    <b>Intense Arguments or Breaking News:</b> High-stress stimuli trigger cortisol, preventing your default
                    mode network from synthesizing ideas.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="k-modal-footer">
        <div className="k-science-footer-note">
          <span>Kairo runs 100% locally in your browser. No trackers, no cookies, pure focus.</span>
        </div>
        <button className="k-btn k-btn-primary" onClick={onClose}>
          Ready to Focus
        </button>
      </footer>
    </Modal>
  );
};
