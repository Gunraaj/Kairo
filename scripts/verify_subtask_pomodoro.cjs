const { chromium } = require('C:/Users/Gg/AppData/Roaming/npm/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright');
const path = require('path');

const outDir = 'C:/Users/Gg/.gemini/antigravity/brain/4ecd6f56-37e5-4910-bfc2-4fa7fa97b445';

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.addInitScript(() => {
    const sampleProjects = [
      {
        id: 'p-1',
        name: 'Deep Learning Research',
        color: '#dc2626',
        isExpanded: true,
        tasks: [
          {
            id: 't-1',
            name: 'Read Attention is All You Need',
            completed: false,
            targetRounds: 4,
            pomodoroLength: 25,
            timeSpent: 25,
            subTasks: [
              {
                id: 'st-1',
                name: 'Self-attention derivation',
                completed: false,
                timeSpent: 25,
                targetRounds: 2,
                pomodoroLength: 25,
              },
              {
                id: 'st-2',
                name: 'Multi-head projection notes',
                completed: false,
                timeSpent: 0,
                targetRounds: 1,
                pomodoroLength: 25,
              },
            ]
          }
        ]
      }
    ];
    localStorage.setItem('kairo_projects', JSON.stringify(sampleProjects));
    localStorage.setItem('kairo_active_task', JSON.stringify('st-1'));
    localStorage.setItem('kairo_seen_welcome', '1');
    localStorage.setItem('kairo_sidebar_width', '260');
  });

  console.log('Navigating to http://127.0.0.1:4173 ...');
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  // Capture subtask rows with Pomodoro badge
  const subtasksList = page.locator('.k-tree-subtasks');
  if (await subtasksList.count() > 0) {
    await subtasksList.screenshot({ path: path.join(outDir, 'verify_subtask_pomodoro_badge_crop.png') });
    console.log('Saved verify_subtask_pomodoro_badge_crop.png');
  }

  // Click the subtask Pomodoro badge on 'st-1'
  const subtaskBadge = page.locator('.k-subtask-pomo-badge').first();
  if (await subtaskBadge.count() > 0) {
    await subtaskBadge.click();
    await page.waitForTimeout(400);

    const popover = page.locator('.k-pomo-popover');
    if (await popover.count() > 0) {
      await popover.screenshot({ path: path.join(outDir, 'verify_subtask_pomodoro_popover_crop.png') });
      console.log('Saved verify_subtask_pomodoro_popover_crop.png');
    }
  }

  // Capture full view showing the subtask focused on stage with its Pomodoro target dots
  await page.screenshot({ path: path.join(outDir, 'verify_subtask_focus_stage.png') });
  console.log('Saved verify_subtask_focus_stage.png');

  await browser.close();
  console.log('Subtask Pomodoro verification finished!');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
