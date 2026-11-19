import React, { useMemo, useState } from 'react';
import { SUPABASE_SETUP_SQL } from '../utils/supabaseSync';

export type FaqItem = {
  q: string;
  a: React.ReactNode;
  text: string;
};

export type FaqSection = {
  id: string;
  title: string;
  items: FaqItem[];
};

const SQL_PRETTY = SUPABASE_SETUP_SQL.split('; ').join(';\n');

export const Code: React.FC<{ children: string }> = ({ children }) => <code className="k-faq-code">{children}</code>;

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

const ALL_SECTIONS: FaqSection[] = [
  {
    id: 'planning',
    title: 'Planning and sessions',
    items: [
      item('How do sessions and breaks work?', 'focus break short long session pomodoro locked unlock every', (
        <>
          <p>A session is one block of focus (25 minutes unless you change it). After each focus session Kairo gives you a short break, and a long break after every Nth session.</p>
          <ul>
            <li>Choose N under the timer: <b>Long break every [N] sessions</b> (1 to 12).</li>
            <li>Breaks are earned: Short break unlocks after a focus session, Long break after every Nth one. You can always go back to <b>Focus</b> to skip a break.</li>
            <li>The break lengths are the <b>Break</b> chips and number under the timer.</li>
          </ul>
        </>
      )),
      item('Can I plan less than one session for a task?', 'half 0.5 less than one short task partial session', (
        <p>
          Yes. Open the plan popover (click the tomato badge on a task or subtask) and pick <b>½</b>, or press − when it is at 1.
          A half session is half the session length (12 or 13 minutes for a 25 minute session) and counts progress in halves.
        </p>
      )),
      item('How do subtasks work?', 'subtask checklist enter add next checkbox time counts', (
        <ul>
          <li>Click the plus on a task, type a name and press <Code>Enter</Code>: it is added and the box stays open for the next one. <Code>Esc</Code> (or Enter on an empty box) finishes.</li>
          <li>Subtasks are a plain checklist. A subtask's session counter appears only once you use it or set a target, or when you point at it.</li>
          <li>Time you focus on a subtask also counts toward its task.</li>
        </ul>
      )),
      item('How do I copy a task?', 'duplicate copy clone task', (
        <p>Click the copy button on a task row. The copy appears right below with a fresh checklist and no progress.</p>
      )),
      item('What does "Done by 9:36 PM" mean?', 'finish estimate done by time left breaks', (
        <p>It is an estimate of when you would finish everything remaining if you started now, including your breaks. It uses your own clock format.</p>
      )),
      item('What do Schedule my day and Plan exam revision do?', 'schedule sprint exam mode timed plan day revision', (
        <p>
          <b>Schedule my day</b> lays out today's sessions and breaks as a timed schedule. <b>Plan exam revision</b>
          appears when a deadline is 7 days away or less and builds a revision schedule from the hours you have.
        </p>
      )),
      item('Can I make the text bigger?', 'font size text bigger larger readable accessibility', (
        <p>Yes: Settings, then <b>Text size</b> (Small, Default, Large, Extra large). It changes all text in Kairo.</p>
      )),
    ],
  },
  {
    id: 'why',
    title: 'Why it works',
    items: [
      item('Why work in short timed sessions?', 'pomodoro technique timebox procrastination start focus cirillo', (
        <p>
          A fixed block with a clear end is easier to start than "study until it is done". The Pomodoro Technique, created by Francesco Cirillo in
          the 1980s with a tomato-shaped kitchen timer, turns time into something you protect for the next 25 minutes instead of something you never have enough of.
        </p>
      )),
      item('Why take breaks?', 'break rest attention fatigue ultradian long break', (
        <p>
          Attention fades over long unbroken stretches. A short break lets it recover, and a longer one after several sessions covers the slower rhythm of
          alertness that many people feel across a few hours. Step away from the screen during breaks; that is what makes them work.
        </p>
      )),
      item('What makes revision actually stick?', 'retrieval practice recall spacing interleaving testing effect study', (
        <ul>
          <li><b>Test yourself</b> with notes closed instead of rereading. Pulling an answer out of memory strengthens it.</li>
          <li><b>Space it out</b>: several short visits over days beat one long cram.</li>
          <li><b>Mix topics</b> (interleave) so you practise choosing the right method, not only using it.</li>
          <li>Kairo's exam revision plan follows these: recall, then practice, then fixing mistakes.</li>
        </ul>
      )),
      item('How long should a session be?', 'session length 25 minutes 15 50 shorter longer half', (
        <p>
          25 minutes is only a default. Pick a length you can repeat every day, from about 15 to 50 minutes. For small jobs plan a <b>half session</b>.
          If you keep stopping early, shorten it; if you hit the end in flow, press <Code>E</Code> to add 5 minutes.
        </p>
      )),
      item('Why does Kairo suggest stopping by 10 pm before an exam?', 'sleep memory consolidation exam night late', (
        <p>Sleep is when memories are consolidated. A late night of cramming usually costs more than it gives, so the exam plan protects your sleep.</p>
      )),
    ],
  },
  {
    id: 'sound',
    title: 'Sounds and alarms',
    items: [
      item('How do I use Sound Studio?', 'sound studio mix rain noise focus tones volume now playing', (
        <ul>
          <li>Open it with the <b>Sound Studio</b> button. Tap a tile (or a ready-made mix) to add it; tap again to remove it.</li>
          <li>Everything playing shows under <b>Now playing</b>, each with its own volume, plus a master volume.</li>
          <li>For fine control use the − and + buttons (2% each, hold Shift for 1%), the mouse wheel, or the arrow keys on a focused slider.</li>
        </ul>
      )),
      item('How do I choose the alarm when a session ends?', 'alarm bell chime end focus break sound ring volume', (
        <p>
          Settings, <b>How sessions run</b>: pick one sound for <b>when focus ends</b> and a different one for <b>when a break ends</b> (bell, chime, singing bowl, gong,
          digital alarm, marimba, doorbell, wood block, or none). Press <b>Test</b> to hear it, then set the alarm volume and how many times it rings.
        </p>
      )),
      item('Why does my sound keep playing when I pause?', 'pause sound keep playing toggle', (
        <p>By default pausing the timer leaves your sound as it is. Turn <b>Keep sound playing when paused</b> off in Settings if you want pausing to stop it too.</p>
      )),
      item('Can I use Kairo with no internet at all?', 'offline mode internet airplane local ollama', (
        <p>
          Yes. Settings, <b>Your data</b>, <b>Offline mode</b> stops all internet connections. The timer, plans, history, focus tones, sounds you already played
          and a local AI model (Ollama) keep working. Cloud AI, Kairo Cloud, casting, new sounds and music pause.
        </p>
      )),
    ],
  },
  {
    id: 'tv',
    title: 'Casting to a TV',
    items: [
      item('How do I show the timer on my TV?', 'cast chromecast google tv timer big screen dashcast', (
        <Steps>
          <li>Use Chrome or Edge on the same Wi-Fi as your Chromecast or Google TV.</li>
          <li>Click <b>TV</b>, then <b>Cast to Chromecast</b>, and pick your TV.</li>
          <li>After a few seconds the TV shows the big timer. Keep the Kairo tab open: it keeps the TV in sync.</li>
          <li>With <b>Play sound on the TV</b> on, the TV plays your focus tone, Sound Studio and the alarm, and this device stays quiet.</li>
        </Steps>
      )),
      item('My TV goes to sleep while casting', 'sleep screensaver ambient mode tv off idle', (
        <p>
          Kairo keeps its TV page awake, but Google TV starts its own screensaver after about 10 minutes. Turn it off on the TV: Settings, System,
          Ambient mode, screensaver off (or the longest delay), and switch off the TV's auto power-off.
        </p>
      )),
      item('The TV only shows a logo or nothing', 'cast blank logo dashcast stuck full page', (
        <ul>
          <li>Open the TV menu again and choose <b>Try full-page mode</b>.</li>
          <li>Make sure the TV and your computer are on the same Wi-Fi and you are using Chrome or Edge.</li>
          <li>In Brave, turn on <b>Media Router</b> in brave://settings/extensions and relaunch first.</li>
        </ul>
      )),
      item('I have another kind of TV', 'hdmi miracast airplay second screen tab cast tv mode', (
        <ul>
          <li><b>TV mode in this tab</b> shows a big timer here; then use the browser menu, Cast, to mirror the tab.</li>
          <li><b>Open on a second screen</b> opens a TV tab you can drag to a screen plugged in by HDMI, a Miracast display (Win+K) or AirPlay. Sound plays from the main tab.</li>
        </ul>
      )),
    ],
  },
  {
    id: 'cloud',
    title: 'Kairo Cloud and sign-in',
    items: [
      item('Do I need an account?', 'account sign in required optional free', (
        <p>No. Kairo works fully without one. Sign in only if you want an encrypted copy of your plan to open on another device. It is free.</p>
      )),
      item('How does sign-in work?', 'google sign in oauth password email', (
        <p>
          Settings, <b>Kairo Cloud</b>, <b>Continue with Google</b>. Google tells Kairo your email, name and picture link; Kairo never sees your Google password.
          Your local data is not changed by signing in.
        </p>
      )),
      item('What is saved in the cloud, and who can read it?', 'encrypted vault passphrase save load cloud forget', (
        <ul>
          <li><b>Save to cloud</b> encrypts your plan in your browser with a passphrase you choose, then uploads only the encrypted copy. Nobody, including us, can read it.</li>
          <li>If you forget the passphrase the copy cannot be recovered. <b>Load from cloud</b> asks for it and downloads a backup file of your current data first.</li>
        </ul>
      )),
      item('How do I delete my cloud data or account?', 'delete account cloud copy remove data gdpr', (
        <p>
          Settings, Kairo Cloud: <b>Delete cloud copy</b> removes your stored plan, and <b>Delete my account</b> erases your account, your email address and every cloud copy at once. Data in your browser stays.
        </p>
      )),
    ],
  },
  {
    id: 'assistants',
    title: 'Claude and ChatGPT connector',
    items: [
      item('How do I let Claude or ChatGPT use my plan?', 'connector mcp claude chatgpt assistant connect share ai', (
        <Steps>
          <li>Sign in to Kairo Cloud, then turn on <b>Share with AI assistants</b> (this stores a readable copy of your projects and sessions).</li>
          <li>In Claude or ChatGPT, add a custom connector with the address <Code>https://kairo-mcp.makekairo.workers.dev/mcp</Code>.</li>
          <li>Approve the connection on the Kairo page that opens and continue with Google.</li>
          <li>Back in Kairo, <b>Send my plan</b> shares your latest plan and <b>Get AI changes</b> brings back what the assistant added.</li>
        </Steps>
      )),
      item('What can the assistant see or change?', 'assistant permissions read add plans tasks safe revoke', (
        <p>
          It can read your projects, deadlines and study history and add plans, subtasks and deadlines. It cannot see your encrypted backup, your AI keys or your email.
          Turn <b>Share with AI assistants</b> off to revoke access and delete the readable copy.
        </p>
      )),
    ],
  },

  {
    id: 'start',
    title: 'Getting started',
    items: [
      item('What is Kairo and where is my data stored?', 'local-first localStorage browser private offline', (
        <p>
          Kairo is a local-first focus workspace. Your projects, sessions, settings and timers live in this browser's
          storage. Nothing leaves your device unless you turn on AI (your prompts go to the provider you choose), sign in
          to Kairo Cloud (an encrypted copy of your plan), or cast to a TV (the timer passes through a private room while casting).
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
          sign in to Kairo Cloud and save an encrypted copy (see the Kairo Cloud section). Clearing site data removes everything Kairo stores.
        </p>
      )),
      item('How do I move my data to another browser or device?', 'export import snapshot json transfer', (
        <p>
          Settings, Export on the old browser, then Settings, Import on the new one (JSON files up to 5 MB). Or use
          Kairo Cloud on both. AI keys and Supabase credentials are never included in exports, so re-enter them.
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
          <li>Open <b>New plan</b>, then <b>Use ChatGPT or Claude instead</b>.</li>
          <li>Paste it into your chatbot and add your exam, topics and date at the end.</li>
          <li>Copy the chatbot's reply, open the <b>Paste its plan</b> tab, review the preview, and import.</li>
          <li>Kairo keeps your history. Next time the copied text includes how fast you really work, so the next plan is more realistic.</li>
        </Steps>
      )),
      item('What is Exam Mode?', 'exam mode sprint crunch last minute short time revision deadline cramming', (
        <>
          <p>
            When a project's deadline is 7 days away or less, Today shows an Exam Mode banner with advice for that stage, and a <b>Plan exam revision</b> button.
            Tell it how many hours you have right now and it builds a timed schedule.
          </p>
          <ul>
            <li>Topics are mixed, not blocked, because mixing helps you remember more.</li>
            <li>Each topic goes Recall (notes closed), then Practice (past questions), then Fix mistakes. There is no passive rereading.</li>
            <li>Short breaks, and a longer one after every fourth session (you can change this). It can stop by 10 pm to protect your sleep.</li>
            <li>In the last 3 days it advises no new topics, and the day before it advises a light pass and rest.</li>
          </ul>
        </>
      )),
      item('What does the AI do, and do I need it?', 'slicing breakdown syllabus offline heuristics optional', (
        <p>
          AI powers the New plan interview, task slicing and syllabus file import. It is optional: with no key, Kairo falls
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
    title: 'Your own Supabase (advanced)',
    items: [
      item('What does Supabase backup do?', 'supabase cloud backup sync what', (
        <p>
          Most people should use Kairo Cloud (sign in with Google). This advanced option is only for running your own backend. It stores one encrypted-in-transit snapshot of your Kairo data in your own Supabase project, so you can
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
          <li><b>Kairo Cloud</b>: only if you sign in. Your plan is encrypted in your browser first; the readable AI copy exists only if you turn on sharing.</li>
          <li><b>Casting</b>: while casting, the timer, task name and sound choices pass through a private, random room (Supabase Realtime) to your TV. Nothing is stored.</li>
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
      item('Google sign-in says the app is blocked or fails', 'google sign in blocked error access denied redirect', (
        <ul>
          <li>Try again from Settings, Kairo Cloud. Make sure the browser allows cookies and storage for this site and is not in a private window.</li>
          <li>Open the sign-in link in the same browser you started in.</li>
          <li>If it still fails, check the message Kairo shows after returning, and tell us what it says.</li>
        </ul>
      )),
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

const ORDER = ['start', 'planning', 'why', 'sound', 'tv', 'cloud', 'assistants', 'ai', 'supabase', 'privacy', 'trouble'];
/** Sections in reading order: basics first, setup and troubleshooting last. */
export const SECTIONS: FaqSection[] = ORDER.map(id => ALL_SECTIONS.find(section => section.id === id)).filter((section): section is FaqSection => Boolean(section));
