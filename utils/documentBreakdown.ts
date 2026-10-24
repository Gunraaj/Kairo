/**
 * documentBreakdown.ts
 * Deep, document-grounded task and curriculum breakdown engine for Kairo.
 * Translates syllabi, course outlines, PRDs, and topic lists into structured,
 * cognitively-weighted Pomodoro sprints with true pedagogical understanding.
 */

import { getAiConfig, queryAi } from './geminiAi';
import { detectPresetCategory, PresetCategory } from './slicePresets';

export type CognitiveDifficulty = 'light' | 'standard' | 'intensive';

export interface ProposedSubtask {
  id: string;
  name: string;
}

export interface ProposedTask {
  id: string;
  name: string;
  targetRounds: number;
  difficulty: CognitiveDifficulty;
  topicTag?: string;
  subTasks: ProposedSubtask[];
  selected: boolean;
}

export interface ProposedModule {
  id: string;
  name: string;
  tasks: ProposedTask[];
}

export interface BreakdownPlan {
  projectName: string;
  summary: string;
  archetype: PresetCategory;
  targetDeadline?: string; // YYYY-MM-DD
  modules: ProposedModule[];
  totalRounds: number;
  totalMinutes: number;
  daysRemaining?: number;
  roundsPerDay?: number;
}

export interface DocumentAnalysisInput {
  text?: string;
  fileBase64?: string;
  mimeType?: string;
  fileName?: string;
  archetype?: PresetCategory;
  deadline?: string;
}

export interface DataSufficiencyCheck {
  isSufficient: boolean;
  reason?: string;
  missingElements: string[];
  suggestedClarifications: string[];
}

/**
 * Validates whether the user's input contains enough pedagogical signal
 * to generate a grounded, meaningful Pomodoro breakdown without hallucinating or
 * outputting generic boilerplate.
 */
export const checkInputSufficiency = (
  text: string,
  hasFile = false,
): DataSufficiencyCheck => {
  if (hasFile) {
    return { isSufficient: true, missingElements: [], suggestedClarifications: [] };
  }

  const trimmed = text.trim();
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const words = trimmed.split(/\s+/).filter(Boolean);

  // If text is empty or just 1 short phrase (e.g. "maths", "prep exam", "chapter 1")
  if (lines.length < 2 && words.length < 8) {
    return {
      isSufficient: false,
      reason: `"${trimmed || 'Your input'}" is too brief for an accurate breakdown without guessing.`,
      missingElements: [
        'Specific topics, modules, or chapter titles',
        'Key sub-concepts or problem types to cover',
        'Target deadline or available study hours',
      ],
      suggestedClarifications: [
        'List 3-5 specific topics (e.g., "1. Limits, 2. Derivatives, 3. Integrals")',
        'Paste your course syllabus, lecture outline, or textbook index',
        'Drop a PDF or Markdown curriculum file for full-context extraction',
      ],
    };
  }

  return { isSufficient: true, missingElements: [], suggestedClarifications: [] };
};

/**
 * Calculates deadline pacing (days left and daily round targets).
 */
export const calculatePacing = (
  totalRounds: number,
  deadlineStr?: string,
): { daysRemaining?: number; roundsPerDay?: number } => {
  if (!deadlineStr) return {};

  try {
    const target = new Date(deadlineStr);
    if (isNaN(target.getTime())) return {};

    const now = new Date();
    // Normalize to midnight for fair day count
    const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const diffMs = targetMidnight - nowMidnight;
    const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const roundsPerDay = Math.max(1, Math.ceil(totalRounds / daysRemaining));

    return { daysRemaining, roundsPerDay };
  } catch {
    return {};
  }
};

/**
 * Heuristically detect cognitive difficulty and Pomodoro rounds from topic keywords.
 */
export const inferCognitiveLoad = (
  text: string,
): { difficulty: CognitiveDifficulty; targetRounds: number } => {
  const lower = text.toLowerCase();

  // Intensive (3-4 rounds = 75-100 min)
  if (
    /\b(proof|derivation|architecture|architect|refactor|migration|comprehensive|mock exam|thesis|synthesis|deep dive|final exam|full-stack|compiler|kernel|distributed)\b/i.test(
      lower,
    )
  ) {
    return { difficulty: 'intensive', targetRounds: 3 };
  }

  // Light (1 round = 25 min)
  if (
    /\b(intro|introduction|overview|vocabulary|definitions?|glossary|summary|read|reading|setup|configure|review|flashcards?)\b/i.test(
      lower,
    )
  ) {
    return { difficulty: 'light', targetRounds: 1 };
  }

  // Standard (2 rounds = 50 min) - Default for problem sets, features, coding, labs
  return { difficulty: 'standard', targetRounds: 2 };
};

/**
 * Universal Outline & Markdown Parser (100% Offline / Zero API Fallback).
 * Extracts modules, tasks, and subtasks from hierarchical outlines, numbered lists, and markdown.
 */
export const parseOutlineOffline = (
  rawContent: string,
  options?: { archetype?: PresetCategory; deadline?: string; fileName?: string },
): BreakdownPlan => {
  const content = (rawContent || '').trim();
  const archetype: PresetCategory =
    options?.archetype || detectPresetCategory(content.slice(0, 300) || options?.fileName || 'Study Project').id;

  const lines = content.split(/\r?\n/).map(l => l.trimEnd());
  
  let projectName = (options?.fileName || '').replace(/\.[^/.]+$/, '').trim();
  let currentModuleName = 'Module 1: Foundations & Core Concepts';
  const modulesMap = new Map<string, ProposedTask[]>();

  let currentTask: ProposedTask | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // Detect Project Title from H1 or very first prominent line if not already set
    if (!projectName && (line.startsWith('# ') || i === 0)) {
      projectName = line.replace(/^#\s*/, '').replace(/^[0-9]+[.:)]\s*/, '').trim();
      continue;
    }

    // Detect Module / Section Headers
    // e.g. "## Module 1", "Week 2:", "Unit 3 -", "Part I:", "Section A"
    const isModuleHeader =
      line.startsWith('## ') ||
      /^(module|unit|week|part|chapter|section)\s+[0-9a-zivx]+/i.test(line) ||
      /^[IVXLCDM]+\.\s+[A-Z]/i.test(line);

    if (isModuleHeader && !line.startsWith('### ')) {
      currentModuleName = line
        .replace(/^##\s*/, '')
        .replace(/^[:\-–—\s]+/, '')
        .trim();
      currentTask = null;
      continue;
    }

    // Detect Tasks (H3, numbered list 1., bullets -/•/* at root indent)
    const indentMatch = rawLine.match(/^(\s*)/);
    const indentLevel = indentMatch ? indentMatch[1].length : 0;
    const isSubBullet = indentLevel >= 2;

    const taskMatch = line.match(/^(?:###\s*|[0-9]+\.\s*|[-*•]\s*(?:\[[ x]\]\s*)?)(.*)/);

    if (taskMatch && !isSubBullet) {
      const taskTitle = taskMatch[1].trim();
      if (!taskTitle) continue;

      const { difficulty, targetRounds } = inferCognitiveLoad(taskTitle);
      currentTask = {
        id: `prop-task-${Math.random().toString(36).slice(2, 9)}`,
        name: taskTitle,
        targetRounds,
        difficulty,
        topicTag: taskTitle.split(/[:\-–—]/)[0]?.trim().slice(0, 30),
        subTasks: [],
        selected: true,
      };

      if (!modulesMap.has(currentModuleName)) {
        modulesMap.set(currentModuleName, []);
      }
      modulesMap.get(currentModuleName)!.push(currentTask);
      continue;
    }

    // Detect Subtasks (indented lines or secondary bullets)
    if (currentTask && (isSubBullet || /^(?:[-*•]\s*|\([a-z0-9]+\)\s*|[a-z]\.\s*)(.*)/i.test(line))) {
      const subClean = line.replace(/^(?:[-*•]\s*|\([a-z0-9]+\)\s*|[a-z]\.\s*)/i, '').trim();
      if (subClean && subClean.length > 2) {
        currentTask.subTasks.push({
          id: `prop-sub-${Math.random().toString(36).slice(2, 9)}`,
          name: subClean.slice(0, 100),
        });
      }
      continue;
    }

    // Plain lines fallback into tasks if no task yet
    if (!currentTask && line.length > 3) {
      const { difficulty, targetRounds } = inferCognitiveLoad(line);
      currentTask = {
        id: `prop-task-${Math.random().toString(36).slice(2, 9)}`,
        name: line,
        targetRounds,
        difficulty,
        subTasks: [],
        selected: true,
      };
      if (!modulesMap.has(currentModuleName)) {
        modulesMap.set(currentModuleName, []);
      }
      modulesMap.get(currentModuleName)!.push(currentTask);
    }
  }

  // Ensure default module if empty
  if (modulesMap.size === 0) {
    const { projectTasks, subtaskSteps } = detectPresetCategory(projectName || 'Study Sprint');
    const defaultTasks: ProposedTask[] = projectTasks.map(pt => ({
      id: `prop-task-${Math.random().toString(36).slice(2, 9)}`,
      name: pt.name,
      targetRounds: pt.targetRounds,
      difficulty: pt.targetRounds > 2 ? 'intensive' : pt.targetRounds === 1 ? 'light' : 'standard',
      subTasks: subtaskSteps.map(s => ({
        id: `prop-sub-${Math.random().toString(36).slice(2, 9)}`,
        name: s,
      })),
      selected: true,
    }));
    modulesMap.set('Core Execution Sprint', defaultTasks);
  }

  // Post-process: ensure tasks without subtasks get grounded pedagogical subtasks
  for (const [, taskList] of modulesMap) {
    for (const t of taskList) {
      if (t.subTasks.length === 0) {
        if (archetype === 'study') {
          t.subTasks = [
            { id: `st-${Math.random().toString(36).slice(2, 7)}`, name: 'Active recall & concept mapping' },
            { id: `st-${Math.random().toString(36).slice(2, 7)}`, name: 'Solve practice problems / problem set' },
            { id: `st-${Math.random().toString(36).slice(2, 7)}`, name: 'Error analysis & review flashcards' },
          ];
        } else if (archetype === 'learning') {
          t.subTasks = [
            { id: `st-${Math.random().toString(36).slice(2, 7)}`, name: 'Deconstruct core mental model' },
            { id: `st-${Math.random().toString(36).slice(2, 7)}`, name: 'Hands-on toy sandbox exercise' },
            { id: `st-${Math.random().toString(36).slice(2, 7)}`, name: 'Feynman ELI5 summary notes' },
          ];
        } else if (archetype === 'writing') {
          t.subTasks = [
            { id: `st-${Math.random().toString(36).slice(2, 7)}`, name: 'Source citations & outline map' },
            { id: `st-${Math.random().toString(36).slice(2, 7)}`, name: 'Uninterrupted zero-draft sprint' },
            { id: `st-${Math.random().toString(36).slice(2, 7)}`, name: 'Structural revision & line edit' },
          ];
        } else {
          t.subTasks = [
            { id: `st-${Math.random().toString(36).slice(2, 7)}`, name: 'Architecture spec & acceptance criteria' },
            { id: `st-${Math.random().toString(36).slice(2, 7)}`, name: 'Deep implementation flow' },
            { id: `st-${Math.random().toString(36).slice(2, 7)}`, name: 'Test suite verification & edge cases' },
          ];
        }
      }
    }
  }

  const modules: ProposedModule[] = Array.from(modulesMap.entries()).map(([modName, tasks]) => ({
    id: `mod-${Math.random().toString(36).slice(2, 9)}`,
    name: modName,
    tasks,
  }));

  const totalRounds = modules.reduce((sum, m) => sum + m.tasks.reduce((ts, t) => ts + t.targetRounds, 0), 0);
  const pacing = calculatePacing(totalRounds, options?.deadline);

  return {
    projectName: projectName || 'Structured Study & Focus Plan',
    summary: `Structured ${modules.length} modules and ${modules.reduce((s, m) => s + m.tasks.length, 0)} concrete Pomodoro tasks.`,
    archetype,
    targetDeadline: options?.deadline,
    modules,
    totalRounds,
    totalMinutes: totalRounds * 25,
    daysRemaining: pacing.daysRemaining,
    roundsPerDay: pacing.roundsPerDay,
  };
};

/**
 * Deep Document Breakdown using Gemini 2.5 Flash API or On-Device Chrome AI.
 * Supports PDF documents (native inline multimodal base64), text files, and pasted outlines.
 */
export const analyzeDocumentWithAi = async (
  input: DocumentAnalysisInput,
): Promise<BreakdownPlan> => {
  const check = checkInputSufficiency(input.text || '', Boolean(input.fileBase64));
  if (!check.isSufficient) {
    throw new Error(
      `Insufficient Context: ${check.reason} To ensure an accurate breakdown without generic guessing, please list 2-3 specific topics or paste your syllabus/outline.`
    );
  }

  const config = getAiConfig();

  // If in offline mode, or no key for remote providers, use offline parser
  if (config.provider === 'offline' || (!config.apiKey && config.provider !== 'local')) {
    return parseOutlineOffline(input.text || '', {
      archetype: input.archetype,
      deadline: input.deadline,
      fileName: input.fileName,
    });
  }

  const systemInstruction = `You are an expert cognitive learning scientist and principal engineering architect.
Your goal is to transform the provided document (course syllabus, lecture schedule, PRD, or topic list) into a sequenced, deeply understood Pomodoro study/work plan.
CRITICAL RULES FOR ACTUAL UNDERSTANDING:
1. Taxonomy: Group related topics into 2-5 logical modules or units matching the document.
2. Prerequisite Sequence: Order tasks so foundational dependencies come first.
3. Cognitive Load Budgeting:
   - Light (1 round = 25m): Definitions, reading overview, setup, vocabulary.
   - Standard (2 rounds = 50m): Core exercises, coding features, labs, practice problem sets.
   - Intensive (3-4 rounds = 75-100m): Mathematical derivations, complex architectural components, proofs, mock exams.
4. Grounded Pedagogical Subtasks: Provide 2-4 concrete, non-generic subtasks derived directly from the document material.
5. Return ONLY valid, raw JSON with this exact schema:
{
  "projectName": "Precise Course / Spec Title",
  "summary": "1-sentence executive overview of the curriculum or sprint scope",
  "archetype": "study" | "learning" | "working" | "writing",
  "modules": [
    {
      "name": "Module 1: Title",
      "tasks": [
        {
          "name": "Concrete Task Name",
          "targetRounds": 2,
          "difficulty": "standard",
          "topicTag": "Key concept tag",
          "subTasks": ["Grounded step 1", "Grounded step 2"]
        }
      ]
    }
  ]
}
Do NOT include markdown backticks like \`\`\`json. Output raw JSON only.`;

  try {
    let rawText = '';

    // If Gemini provider with raw PDF base64
    if (config.provider === 'gemini' && input.fileBase64 && input.mimeType) {
      const parts: Array<Record<string, unknown>> = [
        {
          inline_data: {
            mime_type: input.mimeType,
            data: input.fileBase64,
          },
        },
        {
          text: `Please analyze this uploaded document (${input.fileName || 'Document'}) and break it down into an actionable Pomodoro curriculum. Target Archetype: ${input.archetype || 'auto'}.`,
        },
      ];

      const baseUrl = (config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
      const model = config.model || 'gemini-2.0-flash';
      const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2500,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // Universal text-based breakdown via configured provider (OpenRouter, Ollama, OpenAI, Gemini text)
      const prompt = input.text
        ? `Please analyze this topic list / syllabus text (${input.fileName || 'Outline'}) and break it down into an actionable Pomodoro plan:\n\n${input.text}`
        : `Please break down the following topic curriculum into an actionable Pomodoro study plan: ${input.fileName || 'Curriculum'}`;

      rawText = await queryAi(prompt, systemInstruction);
    }

    if (!rawText) throw new Error('Empty AI response');

    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    if (parsed && Array.isArray(parsed.modules)) {
      const modules: ProposedModule[] = parsed.modules.map((m: any, mIdx: number) => ({
        id: `mod-${mIdx}-${Math.random().toString(36).slice(2, 6)}`,
        name: String(m.name || `Module ${mIdx + 1}`).slice(0, 100),
        tasks: Array.isArray(m.tasks)
          ? m.tasks.map((t: any, tIdx: number) => {
              const diff: CognitiveDifficulty =
                t.difficulty === 'intensive' || t.difficulty === 'light' ? t.difficulty : 'standard';
              const targetRounds = Math.min(6, Math.max(1, Number(t.targetRounds) || (diff === 'intensive' ? 3 : diff === 'light' ? 1 : 2)));
              return {
                id: `prop-task-${mIdx}-${tIdx}-${Math.random().toString(36).slice(2, 6)}`,
                name: String(t.name || 'Next Concept').slice(0, 120),
                targetRounds,
                difficulty: diff,
                topicTag: t.topicTag ? String(t.topicTag).slice(0, 40) : undefined,
                subTasks: Array.isArray(t.subTasks)
                  ? t.subTasks.map((st: any, sIdx: number) => ({
                      id: `sub-${mIdx}-${tIdx}-${sIdx}`,
                      name: String(st).slice(0, 120),
                    }))
                  : [],
                selected: true,
              };
            })
          : [],
      }));

      const totalRounds = modules.reduce((sum, m) => sum + m.tasks.reduce((ts, t) => ts + t.targetRounds, 0), 0);
      const pacing = calculatePacing(totalRounds, input.deadline);

      return {
        projectName: String(parsed.projectName || input.fileName || 'Structured Study Curriculum').slice(0, 80),
        summary: String(parsed.summary || 'AI-structured curriculum with cognitive round budgeting.').slice(0, 300),
        archetype: (parsed.archetype as PresetCategory) || input.archetype || 'study',
        targetDeadline: input.deadline,
        modules,
        totalRounds,
        totalMinutes: totalRounds * 25,
        daysRemaining: pacing.daysRemaining,
        roundsPerDay: pacing.roundsPerDay,
      };
    }
  } catch (err) {
    console.warn('AI document breakdown encountered error; falling back to offline outline parser:', err);
  }

  // Graceful offline fallback
  return parseOutlineOffline(input.text || '', {
    archetype: input.archetype,
    deadline: input.deadline,
    fileName: input.fileName,
  });
};

/**
 * Curated Sample Templates for instant 1-click testing
 */
export const SAMPLE_TEMPLATES = [
  {
    id: 'calculus',
    title: '🎓 Calculus & Differential Equations Syllabus',
    archetype: 'study' as PresetCategory,
    content: `# Advanced Calculus & Differential Equations
## Unit 1: Foundations & Limits
- 1.1 Epsilon-Delta Limit Definitions & Continuity (review notes)
- 1.2 Derivative Rules & Chain Rule practice problem set
- 1.3 Implicit Differentiation & Related Rates problems

## Unit 2: Integration & Fundamental Theorems
- 2.1 Riemann Sums & Definite Integrals
- 2.2 Integration by Parts & Trigonometric Substitution
- 2.3 Partial Fraction Decomposition lab exercises

## Unit 3: Differential Equations & Series
- 3.1 First-Order Separable Equations
- 3.2 Second-Order Linear Homogeneous Equations
- 3.3 Taylor & Maclaurin Series comprehensive proof and exam problem set`,
  },
  {
    id: 'prd',
    title: '💼 Production Microservice PRD & Engineering Spec',
    archetype: 'working' as PresetCategory,
    content: `# Real-Time Analytics Ingestion Engine
## Milestone 1: Data Contracts & Ingestion Service
- Event Schema Validation & Protobuf definitions
  - Draft Protobuf schema with timestamp and user event enum
  - Unit test deserialization performance
- Ingestion HTTP API Gateway endpoint
  - Implement POST /v1/events rate-limited route
  - Add JWT authentication middleware & error responses

## Milestone 2: Stream Processing & Aggregations
- Kafka Producer & Consumer Pipeline
  - Configure partition keys for high-throughput ordering
  - Implement dead-letter queue (DLQ) retry consumer
- Sliding Window Aggregation Worker
  - Build 1-minute and 5-minute rolling counters in Redis
  - Benchmark memory footprints under 10k req/sec load

## Milestone 3: Observability & Production Verification
- Distributed Tracing & Prometheus Metrics exporter
- End-to-end chaos engineering tests and graceful shutdown`,
  },
  {
    id: 'language',
    title: '📚 Japanese JLPT N4 Accelerator Curriculum',
    archetype: 'learning' as PresetCategory,
    content: `# Japanese JLPT N4 Comprehensive Study Plan
## Week 1: Essential Grammar Forms
- Te-form and Nai-form verb conjugations practice
- Conditional forms: Tara, Nara, and Ba derivations
- Potential and Passive verb transformations drill

## Week 2: Kanji & High-Frequency Vocabulary
- 50 Core Travel and Work Kanji characters
  - Stroke order practice and mnemonic creation
  - Compound word readings (On'yomi vs Kun'yomi)
- 120 Essential Adjectives and Adverbs flashcard drill

## Week 3: Listening Comprehension & Mock Dialogue
- Daily Conversation Audio Passages (tracks 1-10)
- Short Passage Reading & Timed Question Answering`,
  },
];
