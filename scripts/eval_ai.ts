/**
 * Scores a model on the sample syllabi in evals/syllabi.
 *   npx tsx scripts/eval_ai.ts --provider local --base http://localhost:11434/v1 --model qwen2.5:7b-instruct
 *   npx tsx scripts/eval_ai.ts --provider openrouter --key $KEY --model meta-llama/llama-3.3-70b-instruct:free
 * Provider keys come from --key or the KAIRO_EVAL_KEY environment variable. Not part of `npm run check`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLAN_SCHEMA, PLAN_SYSTEM_PROMPT } from '../utils/documentBreakdown.ts';
import { DEFAULT_AI_CONFIGS, type AiProviderType } from '../utils/geminiAi.ts';
import { generateStructured } from '../utils/structuredAi.ts';

const args = new Map<string, string>();
process.argv.slice(2).forEach((arg, i, all) => { if (arg.startsWith('--')) args.set(arg.slice(2), all[i + 1] ?? ''); });
const provider = (args.get('provider') ?? 'local') as AiProviderType;
const defaults = DEFAULT_AI_CONFIGS[provider];
const config = {
  provider,
  apiKey: args.get('key') ?? process.env.KAIRO_EVAL_KEY ?? '',
  baseUrl: args.get('base') ?? defaults.baseUrl,
  model: args.get('model') ?? defaults.model,
  temperature: 0.2,
};

type Plan = { modules: Array<{ name: string; tasks: Array<{ name: string; targetRounds: number; difficulty: string; subTasks?: string[] }> }> };

const keywords = (text: string): string[] =>
  Array.from(new Set(text.toLowerCase().match(/[a-z][a-z-]{4,}/g) ?? []));

const dir = join(import.meta.dirname, '..', 'evals', 'syllabi');
const rows: string[][] = [['syllabus', 'valid', 'coverage', 'rounds', 'tasks', 'sec']];
let validCount = 0;
let files = readdirSync(dir).filter(f => f.endsWith('.md')).sort();
if (args.get('only')) files = files.filter(f => f.includes(args.get('only')!));

for (const file of files) {
  const text = readFileSync(join(dir, file), 'utf-8');
  const started = Date.now();
  let row: string[];
  try {
    const plan = await generateStructured<Plan>({
      schemaName: 'study_plan',
      schema: PLAN_SCHEMA,
      system: PLAN_SYSTEM_PROMPT,
      prompt: `Please analyze this topic list / syllabus text (${file}) and break it down into an actionable Pomodoro plan:\n\n${text}`,
      maxTokens: 3500,
      timeoutMs: 240_000,
    }, { config });
    const tasks = plan.modules.flatMap(m => m.tasks);
    const planText = JSON.stringify(plan).toLowerCase();
    const wanted = keywords(text).filter(w => !['week', 'weeks', 'final', 'exam', 'covers', 'units'].includes(w));
    const covered = wanted.filter(w => planText.includes(w.slice(0, Math.max(5, w.length - 2)))).length;
    const rounds = tasks.reduce((sum, t) => sum + t.targetRounds, 0);
    validCount += 1;
    row = [file, 'yes', `${Math.round((covered / Math.max(1, wanted.length)) * 100)}%`, String(rounds), String(tasks.length), ((Date.now() - started) / 1000).toFixed(1)];
  } catch (err) {
    row = [file, 'NO', '-', '-', '-', ((Date.now() - started) / 1000).toFixed(1)];
    console.error(`${file}: ${(err as Error).message}`);
  }
  rows.push(row);
}

const widths = rows[0]!.map((_, c) => Math.max(...rows.map(r => r[c]!.length)));
console.log(`\nmodel: ${config.provider} / ${config.model}`);
rows.forEach(r => console.log(r.map((cell, c) => cell.padEnd(widths[c]!)).join('  ')));
console.log(`\nvalid plans: ${validCount}/${files.length}`);
