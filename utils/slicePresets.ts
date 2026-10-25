/**
 * slicePresets.ts
 * Curated task breakdown presets for Studying, Learning, Working, and Writing.
 * Provides instant 1-click Pomodoro structure when AI is not configured, or as a
 * faster, deterministic alternative to generative AI.
 */

export type PresetCategory = 'study' | 'learning' | 'working' | 'writing';

export interface SlicePreset {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  category: PresetCategory;
  projectTasks: Array<{
    name: string;
    targetRounds: number;
    subTasks?: string[];
  }>;
  subtaskSteps: string[];
}

export const SLICE_PRESETS: Record<string, SlicePreset> = {
  study: {
    id: 'study',
    name: 'Study & Exam Prep',
    emoji: '🎓',
    tagline: 'Active recall, practice sets & gap analysis',
    description: 'Evidence-based study structure utilizing the testing effect and spaced repetition.',
    category: 'study',
    projectTasks: [
      {
        name: 'Review notes & compile active recall questions',
        targetRounds: 1,
        subTasks: [
          'Extract core formulas & key definitions',
          'Convert reading points into questions',
          'Identify confusing or dense topics',
        ],
      },
      {
        name: 'Active recall drill & closed-book self-testing',
        targetRounds: 2,
        subTasks: [
          'Test recall without checking notes',
          'Sketch diagrams / workflows from memory',
          'Score results & flag knowledge gaps',
        ],
      },
      {
        name: 'Solve timed practice problems / past exam questions',
        targetRounds: 2,
        subTasks: [
          'Set timer for realistic test conditions',
          'Work through challenging problem set',
          'Grade solutions against answer rubric',
        ],
      },
      {
        name: 'Error audit & targeted weak-area remediation',
        targetRounds: 1,
        subTasks: [
          'Isolate root causes of wrong answers',
          'Re-solve missed problems cleanly',
          'Schedule spaced review checkpoint',
        ],
      },
    ],
    subtaskSteps: [
      'Review & annotate core concepts',
      'Create 3-5 active recall flashcards',
      'Closed-book memory retrieval drill',
      'Review missed items & resolve gaps',
    ],
  },

  learning: {
    id: 'learning',
    name: 'Learning New Skill',
    emoji: '📚',
    tagline: 'Foundations, sandboxing & Feynman technique',
    description: 'Deep conceptual comprehension, mental models, and hands-on synthesis.',
    category: 'learning',
    projectTasks: [
      {
        name: 'Foundational reading & mental model mapping',
        targetRounds: 1,
        subTasks: [
          'Skim documentation / syllabus overview',
          'Deep read core principles chapter',
          'Summarize mechanism in 3 clear sentences',
        ],
      },
      {
        name: 'Hands-on sandbox experiment / toy implementation',
        targetRounds: 2,
        subTasks: [
          'Create scratchpad / minimal sandbox',
          'Implement smallest working prototype',
          'Tweak parameters & observe outcomes',
        ],
      },
      {
        name: 'Feynman Technique: Explain concept without jargon',
        targetRounds: 1,
        subTasks: [
          'Explain the concept to an imagined novice',
          'Highlight where explanation gets fuzzy',
          'Consult docs to find simpler analogies',
        ],
      },
      {
        name: 'Synthesize cheat sheet & spaced retention notes',
        targetRounds: 1,
        subTasks: [
          'Document top 5 takeaways & gotchas',
          'Connect to existing familiar skills',
          'Schedule practice interval for next week',
        ],
      },
    ],
    subtaskSteps: [
      'Understand core mental model',
      'Build minimal toy prototype / example',
      'Explain mechanism in own words',
      'Document gotchas and edge cases',
    ],
  },

  working: {
    id: 'working',
    name: 'Deep Work & Engineering',
    emoji: '💼',
    tagline: 'Architecture spec, sprint build & ship',
    description: 'High-leverage engineering workflow for sustained software delivery.',
    category: 'working',
    projectTasks: [
      {
        name: 'Architecture design, requirements & contracts',
        targetRounds: 1,
        subTasks: [
          'Define inputs, outputs & data contracts',
          'Map boundary constraints & edge cases',
          'Draft minimal implementation checklist',
        ],
      },
      {
        name: 'Core sprint implementation (Deep focus)',
        targetRounds: 2,
        subTasks: [
          'Build primary domain business logic',
          'Wire state management & event handlers',
          'Validate happy path end-to-end',
        ],
      },
      {
        name: 'Unit test coverage & edge-case stress verification',
        targetRounds: 1,
        subTasks: [
          'Add boundary assertion unit tests',
          'Test empty, invalid & corrupted states',
          'Verify zero regressions across entire suite',
        ],
      },
      {
        name: 'Refactor, documentation, review & deploy',
        targetRounds: 1,
        subTasks: [
          'Clean debug logging & polish styling',
          'Update documentation & release notes',
          'Deploy to production & verify health',
        ],
      },
    ],
    subtaskSteps: [
      'Define interface spec & edge cases',
      'Implement minimal working logic',
      'Add unit tests & error handling',
      'Verify types, linting & clean build',
    ],
  },

  writing: {
    id: 'writing',
    name: 'Writing & Research',
    emoji: '✍️',
    tagline: 'Outlining, zero-drafting & structural edit',
    description: 'Unblocked writing pipeline separating rapid drafting from critical editing.',
    category: 'writing',
    projectTasks: [
      {
        name: 'Source collection & structural thesis outline',
        targetRounds: 1,
        subTasks: [
          'Gather primary references & citations',
          'Outline key sections & main arguments',
          'Write thesis statement in one clear sentence',
        ],
      },
      {
        name: 'Uninterrupted zero-draft (No editing allowed)',
        targetRounds: 2,
        subTasks: [
          'Draft opening hook & problem framing',
          'Write continuous body arguments without stopping',
          'Draft conclusion & call to action',
        ],
      },
      {
        name: 'Structural revision & argument flow check',
        targetRounds: 1,
        subTasks: [
          'Check narrative flow between paragraphs',
          'Cut unnecessary filler & passive voice',
          'Strengthen transitions and topic sentences',
        ],
      },
      {
        name: 'Line editing, citation check & final polish',
        targetRounds: 1,
        subTasks: [
          'Read aloud to check cadence and rhythm',
          'Verify citation links & bibliographic formatting',
          'Final export & visual layout check',
        ],
      },
    ],
    subtaskSteps: [
      'Outline main argument & evidence',
      'Draft uninterrupted raw prose',
      'Cut fluff & tighten sentence flow',
      'Proofread and format citations',
    ],
  },
};

export const PRESET_LIST = Object.values(SLICE_PRESETS);

/**
 * Detect the best matching preset based on string heuristics
 */
export const detectPresetCategory = (text: string): SlicePreset => {
  const lower = text.toLowerCase();

  if (/study|exam|quiz|test|revision|math|algebra|formula|history|biology|chemistry|physics|flashcard|memoriz|homework|assignment/i.test(lower)) {
    return SLICE_PRESETS.study;
  }
  if (/learn|course|tutorial|class|book|read|concept|language|skill|academy|lecture|theory/i.test(lower)) {
    return SLICE_PRESETS.learning;
  }
  if (/write|draft|essay|article|blog|paper|thesis|report|doc|newsletter|manuscript/i.test(lower)) {
    return SLICE_PRESETS.writing;
  }
  // Default to working/engineering
  return SLICE_PRESETS.working;
};
