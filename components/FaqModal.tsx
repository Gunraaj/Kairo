import React, { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { SUPABASE_SETUP_SQL } from '../utils/supabaseSync';

interface FaqModalProps {
  onClose: () => void;
  onOpenSettings?: () => void;
}

type FaqItem = {
  q: string;
  a: React.ReactNode;
  text: string;
};

type FaqSection = {
  id: string;
  title: string;
  items: FaqItem[];
};

const SQL_PRETTY = SUPABASE_SETUP_SQL.split('; ').join(';\n');

const Code: React.FC<{ children: string }> = ({ children }) => <code className="k-faq-code">{children}</code>;

const Steps: React.FC<{ children: React.ReactNode }> = ({ children }) => <ol className="k-faq-steps">{children}</ol>;

const SqlBlock: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SQL_PRETTY);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="k-faq-sql">
      <pre>{SQL_PRETTY}</pre>
      <button type="button" className="k-btn" onClick={copy}>{copied ? 'Copied' : 'Copy SQL'}</button>
    </div>
  );
};

const item = (q: string, text: string, a: React.ReactNode): FaqItem => ({ q, text: `${q} ${text}`, a });

const SECTIONS: FaqSection[] = [
  {
    id: 'start',
    title: 'Getting started',
    items: [
      item('What is Kairo and where is my data stored?', 'local-first localStorage browser private offline', (
        <p>
          Kairo is a local-first focus workspace. Your projects, sessions, settings and timers live in this browser's
          storage. Nothing leaves your device unless you turn on AI (your prompts go to the provider you choose) or
          cloud backup (your snapshot goes to your own Supabase project).
        </p>
      )),
      item('How do I start a focus session?', 'space start timer quick focus', (
        <p>
          Press <Code>Space</Code> or click Start Focus. Add a goal first if you like, or pick a task in the sidebar.
          Open the Shortcuts page (<Code>?</Code>) for every key.
        </p>
      )),
      item('I cleared my browser data and lost everything. Can I get it back?', 'lost data clear cache backup export restore', (
        <p>
          Only if you exported or backed up first. Use Settings, then Export, to download a JSON snapshot regularly, or
          set up Supabase backup (see the Cloud backup section). Clearing site data removes everything Kairo stores.
        </p>
      )),
      item('How do I move my data to another browser or device?', 'export import snapshot json transfer', (
        <p>
          Settings, Export on the old browser, then Settings, Import on the new one (JSON files up to 5 MB). Or use
          Supabase backup on both. AI keys and Supabase credentials are never included in exports, so re-enter them.
        </p>
      )),
    ],
  },
  {
    id: 'ai',
    title: 'AI setup',
    items: [
      item('Can I use my ChatGPT, Claude or Gemini subscription with Kairo?', 'chatgpt claude gemini subscription bridge paste plan copy chatbot free', (
        <Steps>
          <li>Open <b>Use my AI</b> in the sidebar and copy the text.</li>
          <li>Paste it into your chatbot and add your exam, topics and date at the end.</li>
          <li>Copy the chatbot's reply, open the <b>Paste its plan</b> tab, review the preview, and import.</li>
          <li>Kairo keeps your history. Next time the copied text includes how fast you really work, so the next plan is more realistic.</li>
        </Steps>
      )),
      item('What does the AI do, and do I need it?', 'slicing breakdown syllabus offline heuristics optional', (
        <p>
          AI powers task slicing and Import Syllabus (document breakdown). It is optional: with no key, Kairo falls
          back to built-in offline heuristics, so the timer, tasks and analytics all work without it.
        </p>
      )),
      item('Which provider should I pick? What is free?', 'free cheap gemini openrouter ollama cost', (
        <ul>
          <li><b>Google Gemini</b>: generous free tier, easiest start.</li>
          <li><b>OpenRouter</b>: several models tagged <Code>:free</Code>.</li>
          <li><b>Local (Ollama)</b>: free and fully private, runs on your computer.</li>
          <li><b>Anthropic Claude / OpenAI</b>: paid, billed by the provider.</li>
        </ul>
      )),
      item('How do I set up Google Gemini?', 'gemini google ai studio api key aizasy', (
        <Steps>
          <li>Create a key at Google AI Studio (aistudio.google.com/apikey).</li>
          <li>Open Settings, find the AI section, choose <b>Google Gemini</b>.</li>
          <li>Paste the key (starts with <Code>AIza</Code>), keep the default model <Code>gemini-2.0-flash</Code>.</li>
          <li>Click Test connection, then Save settings.</li>
        </Steps>
      )),
      item('How do I set up Anthropic Claude?', 'anthropic claude sk-ant console api key model', (
        <Steps>
          <li>Create a key in the Anthropic Console (console.anthropic.com), under API keys. It starts with <Code>sk-ant-</Code>.</li>
          <li>In Settings, choose <b>Anthropic Claude</b> and paste the key.</li>
          <li>The preset list may lag behind newest models. Choose the custom option and type any current model ID.</li>
          <li>Test connection, then Save. API usage is billed separately from any chat subscription.</li>
        </Steps>
      )),
      item('How do I set up OpenAI or OpenRouter?', 'openai gpt openrouter sk-proj sk-or key', (
        <Steps>
          <li>OpenAI: create a key at platform.openai.com/api-keys. OpenRouter: openrouter.ai/keys.</li>
          <li>Choose the provider in Settings and paste the key.</li>
          <li>Pick a preset model. On OpenRouter, models ending in <Code>:free</Code> cost nothing but are rate limited.</li>
          <li>Test connection, then Save.</li>
        </Steps>
      )),
      item('How do I use a local model with Ollama?', 'ollama local llama cors origins localhost private', (
        <Steps>
          <li>Install Ollama and run <Code>ollama pull llama3.2</Code>.</li>
          <li>Start it with browser access allowed: <Code>OLLAMA_ORIGINS="*" ollama serve</Code> (on Windows PowerShell, set the variable first, then run <Code>ollama serve</Code>).</li>
          <li>In Settings, choose <b>Local AI (Ollama)</b>. Base URL is <Code>http://localhost:11434/v1</Code>, no key needed.</li>
          <li>Test connection. If it fails, Ollama is not running or CORS is not enabled.</li>
        </Steps>
      )),
      item('Ollama works locally but not on the hosted site', 'ollama hosted netlify cors 403 local network access permission origins', (
        <ul>
          <li>Ollama only trusts localhost pages by default. Allow the site: <Code>OLLAMA_ORIGINS="https://makekairo.netlify.app"</Code> (or <Code>"*"</Code>), then restart Ollama.</li>
          <li>Chrome asks before a website can reach your own computer. When the "local network access" prompt appears, choose Allow.</li>
          <li>If Ollama runs on another machine, forward its port to this one (for example <Code>ssh -L 11434:127.0.0.1:11434 your-server</Code>) so Kairo can use <Code>localhost:11434</Code>.</li>
        </ul>
      )),
      item('Can I use Groq, Mistral or another OpenAI-compatible service?', 'custom endpoint groq mistral openai_custom csp base url', (
        <>
          <p>
            Yes, via <b>Custom OpenAI Endpoint</b> (https only). On the hosted site, the security policy only allows
            the built-in providers, so the browser will block other hosts.
          </p>
          <p>
            To use one, run Kairo yourself and add the host to <Code>connect-src</Code> in <Code>netlify.toml</Code> and
            <Code> vercel.json</Code>.
          </p>
        </>
      )),
      item('Is my API key safe?', 'key security storage plaintext privacy shared computer spend limit', (
        <>
          <p>
            Your key is stored in this browser's local storage and sent only to the provider you chose, in a request
            header. It is not included in exports or cloud backups.
          </p>
          <p>
            Anyone with access to this browser profile can read it, so avoid shared computers, and set a spend limit
            or use a restricted key at the provider.
          </p>
        </>
      )),
      item('I get an error when testing the AI connection', 'error 401 403 429 network cors model not found troubleshoot', (
        <ul>
          <li><b>401 / 403</b>: the key is wrong, expired or has no access to that model.</li>
          <li><b>429</b>: rate limit or no credit. Wait, or add billing.</li>
          <li><b>Network error</b>: check your connection, ad blockers, and for Ollama, that it is running with CORS enabled.</li>
          <li><b>Model not found</b>: the model ID is misspelled or not available to your account. Use a preset.</li>
        </ul>
      )),
    ],
  },
  {
    id: 'supabase',
    title: 'Cloud backup (Supabase)',
    items: [
      item('What does Supabase backup do?', 'supabase cloud backup sync what', (
        <p>
          It stores one encrypted-in-transit snapshot of your Kairo data in your own Supabase project, so you can
          restore it on another browser. It is optional and fully under your control. Kairo does not run a server.
        </p>
      )),
      item('Step-by-step setup', 'setup guide supabase project sql auth user url anon key', (
        <>
          <Steps>
            <li>Create a free project at supabase.com and wait for it to finish starting.</li>
            <li>Open the SQL Editor, paste the SQL below and run it. This creates the table and the security rule that keeps each account's data private.</li>
            <li>Go to Authentication, Users, Add user. Enter an email and a password, and tick auto-confirm.</li>
            <li>Go to Project Settings, API. Copy the <b>Project URL</b> and the <b>anon public</b> key.</li>
            <li>In Kairo Settings, Optional Cloud Sync: paste the URL and anon key, enter the email and password you created, then click Test Connection.</li>
            <li>Click Backup to Cloud. To restore later, click Restore from Cloud.</li>
          </Steps>
          <SqlBlock />
        </>
      )),
      item('Which key do I paste: anon or service_role?', 'anon service_role secret key public', (
        <p>
          Only the <b>anon public</b> key. Never paste the <Code>service_role</Code> key anywhere in a browser app, it
          bypasses all security. The anon key is designed to be public; the security rule in the SQL is what protects
          your data.
        </p>
      )),
      item('Why does Kairo ask for an email and password?', 'login auth account rls private password stored', (
        <p>
          So each backup belongs to one account and nobody else can read or overwrite it. Your password is used only
          to sign in, is kept in memory while Settings is open, and is never saved to disk or included in backups.
        </p>
      )),
      item('What does "The cloud backup is newer" mean?', 'conflict overwrite newer cloud last sync', (
        <p>
          Another device uploaded a backup after this one last synced. Overwriting replaces that newer copy. If
          unsure, cancel, restore from cloud first, then back up again.
        </p>
      )),
      item('What happens when I restore?', 'restore replace download confirm', (
        <p>
          Kairo asks for confirmation, downloads a copy of your current local data as a safety file, then replaces
          local data with the cloud snapshot and reloads.
        </p>
      )),
      item('Supabase errors and fixes', 'table not found sign-in failed 400 401 paused invalid login', (
        <ul>
          <li><b>Table "kairo_backups" not found</b>: run the SQL above.</li>
          <li><b>Sign-in failed</b>: check the email and password, and that the user exists and is confirmed.</li>
          <li><b>Authentication failed</b> on Test Connection: re-copy the anon key and the project URL.</li>
          <li><b>Timed out</b>: free projects pause after about a week of inactivity. Resume it in the Supabase dashboard.</li>
          <li><b>Larger than 5 MB</b>: export a local file instead and clear old sessions.</li>
        </ul>
      )),
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy and data',
    items: [
      item('What leaves my device, and where does it go?', 'privacy network sent third party google fonts youtube spotify github', (
        <ul>
          <li><b>AI prompts</b>: only to your chosen provider, only when you use an AI feature.</li>
          <li><b>Cloud backup</b>: only to your Supabase project, only when you press Backup.</li>
          <li><b>Ambient sounds</b>: downloaded from GitHub and cached on your device.</li>
          <li><b>Fonts</b>: loaded from Google Fonts.</li>
          <li><b>YouTube / Spotify</b>: only when you open an embedded stream.</li>
        </ul>
      )),
      item('Does Kairo track me?', 'analytics tracking telemetry cookies', (
        <p>Kairo has no analytics or telemetry of its own and does not set tracking cookies.</p>
      )),
    ],
  },
  {
    id: 'trouble',
    title: 'Troubleshooting',
    items: [
      item('A YouTube stream shows a blank box or an error', 'youtube blank embed video unavailable restricted stream', (
        <ul>
          <li>Some videos disallow embedding or go offline. Try another station, or use Open in new tab under the player.</li>
          <li>Ad blockers and strict privacy extensions can block the player.</li>
          <li>Custom links must be https YouTube or Spotify links.</li>
        </ul>
      )),
      item('Sounds do not play', 'audio sound mute autoplay silent', (
        <ul>
          <li>Browsers block audio until you interact with the page. Click once, then try again.</li>
          <li>Check the master volume and press <Code>M</Code> to make sure you are not muted.</li>
          <li>Sounds download from GitHub, so you need a connection the first time.</li>
        </ul>
      )),
      item('Does the timer keep running in a background tab?', 'timer background tab accuracy sleep', (
        <p>
          Yes. The timer counts to a saved end time, so it stays accurate when the tab is hidden or the computer
          sleeps, and recovers after a reload.
        </p>
      )),
      item('Import says my file is invalid', 'import json invalid failed 5mb', (
        <p>
          Use a JSON file exported from Kairo, under 5 MB. Hand-edited files with missing or wrong fields are cleaned
          up or skipped.
        </p>
      )),
    ],
  },
];

export const FaqModal: React.FC<FaqModalProps> = ({ onClose, onOpenSettings }) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string>('all');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return SECTIONS
      .filter(section => needle || active === 'all' || section.id === active)
      .map(section => ({
        ...section,
        items: needle ? section.items.filter(entry => entry.text.toLowerCase().includes(needle)) : section.items,
      }))
      .filter(section => section.items.length > 0);
  }, [query, active]);

  return (
    <Modal titleId="faq-title" onClose={onClose} className="faq-dialog">
      <header className="k-modal-header">
        <div>
          <h2 id="faq-title">Help &amp; FAQ</h2>
          <p className="k-modal-sub">Setup guides for AI, cloud backup and troubleshooting</p>
        </div>
        <button className="k-modal-close" onClick={onClose} aria-label="Close help">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      <div className="k-modal-body k-faq">
        <input
          type="search"
          className="k-faq-search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search, e.g. gemini, ollama, supabase, youtube"
          aria-label="Search help"
        />
        <div className="k-faq-tabs" role="tablist" aria-label="Help sections">
          {[{ id: 'all', title: 'All' }, ...SECTIONS].map(section => (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={active === section.id}
              className={`k-faq-tab ${active === section.id ? 'is-active' : ''}`}
              onClick={() => setActive(section.id)}
            >
              {section.title}
            </button>
          ))}
        </div>

        {visible.length === 0 && (
          <p className="k-faq-empty">No answers match "{query}". Try a shorter word.</p>
        )}

        {visible.map(section => (
          <section key={section.id} className="k-faq-section" aria-labelledby={`faq-${section.id}`}>
            <h3 id={`faq-${section.id}`} className="k-faq-heading">{section.title}</h3>
            {section.items.map(entry => (
              <details key={entry.q} className="k-faq-item" open={Boolean(query.trim())}>
                <summary>{entry.q}</summary>
                <div className="k-faq-answer">{entry.a}</div>
              </details>
            ))}
          </section>
        ))}

        {onOpenSettings && (
          <div className="k-faq-footer">
            <button type="button" className="k-btn" onClick={onOpenSettings}>Open Settings</button>
          </div>
        )}
      </div>
    </Modal>
  );
};
