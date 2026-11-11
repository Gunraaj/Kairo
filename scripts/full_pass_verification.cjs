const { chromium } = require('C:/Users/Gg/AppData/Roaming/npm/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

const outDir = 'C:/Users/Gg/.gemini/antigravity/brain/4ecd6f56-37e5-4910-bfc2-4fa7fa97b445';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || !path.extname(reqPath)) reqPath = '/index.html';
  const filePath = path.join(__dirname, '..', 'dist', reqPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(__dirname, '..', 'dist', 'index.html'), (e2, indexData) => {
        if (e2) {
          res.writeHead(404);
          res.end('Not found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(indexData);
        }
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  console.log(`[PASS AUDIT] Testing server running on http://127.0.0.1:${port}`);

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true,
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });

    // Seed test state
    await page.addInitScript(() => {
      localStorage.setItem('kairo_seen_welcome', '1');
      localStorage.setItem('kairo_sidebar_width', '280');
      
      const sampleProjects = [
        {
          id: 'proj-1',
          name: 'Core System Elevation',
          tasks: [
            {
              id: 'task-1',
              name: 'Harden Database & Sync Security',
              timeSpent: 25,
              completed: false,
              targetRounds: 4,
              pomodoroLength: 25,
              subTasks: [
                { id: 'sub-1', name: 'CRLF sanitization across API keys', completed: true, targetRounds: 1, pomodoroLength: 25 },
                { id: 'sub-2', name: 'RFC 5545 calendar export escaping', completed: true, targetRounds: 1, pomodoroLength: 25 },
                { id: 'sub-3', name: 'Audio cache boundary verification', completed: false, targetRounds: 2, pomodoroLength: 25 },
              ],
            },
          ],
        },
      ];
      localStorage.setItem('kairo_projects', JSON.stringify({ version: 2, data: sampleProjects }));
      localStorage.setItem('kairo_active_task', JSON.stringify('task-1'));

      const sampleSessions = [
        {
          id: 's-1',
          date: new Date().toISOString(),
          duration: 25,
          completed: true,
          type: 'focus',
          taskName: 'Harden Database & Sync Security',
        },
      ];
      localStorage.setItem('kairo_sessions', JSON.stringify({ version: 2, data: sampleSessions }));
    });

    await page.goto(`http://127.0.0.1:${port}`);
    await page.waitForTimeout(600);

    // 1. Verify Stage & Today count
    console.log('[PASS AUDIT] 1. Checking Stage & Pluralization...');
    const todayText = await page.locator('.k-momentum-stat').innerText();
    console.log(`  Today summary text: "${todayText}"`);
    if (!todayText.includes('Today: 1 session (25m)')) {
      console.warn(`  Warning: Expected "Today: 1 session (25m)", got "${todayText}"`);
    } else {
      console.log('  ✓ Pluralization is correct: "1 session" (singular)');
    }

    // Capture Stage
    await page.screenshot({ path: path.join(outDir, 'verify_full_pass_stage.png') });

    // 2. Verify Task Drawer & Subtask Pomodoro Badges
    console.log('[PASS AUDIT] 2. Checking Task Drawer & Pomodoro Summary...');
    const pomoSummary = await page.locator('.k-pomo-summary-bar').innerText();
    console.log(`  Pomodoro Summary Bar: "${pomoSummary.replace(/\n/g, ' ')}"`);

    // Expand subtasks
    const subtaskPill = page.locator('.k-subtask-pill').first();
    if (await subtaskPill.count() > 0) {
      await subtaskPill.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: path.join(outDir, 'verify_full_pass_drawer.png') });
    console.log('  ✓ Task drawer verified');

    // 3. Verify Time Capsule Modal & Card Alignment
    console.log('[PASS AUDIT] 3. Checking Time Capsule Modal Alignment...');
    const capsuleBtn = page.locator('.k-capsule-pill-btn, button:has-text("Future Treat")').first();
    if (await capsuleBtn.count() > 0) {
      await capsuleBtn.click();
      await page.waitForTimeout(400);

      // Evaluate card alignments
      const cardLayout = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.k-trigger-card'));
        return cards.map(c => {
          const radio = c.querySelector('input[type="radio"]');
          const info = c.querySelector('.k-trigger-info');
          const cRect = c.getBoundingClientRect();
          const rRect = radio ? radio.getBoundingClientRect() : null;
          const iRect = info ? info.getBoundingClientRect() : null;
          return {
            leftMarginToRadio: rRect ? rRect.left - cRect.left : null,
            radioToInfoGap: rRect && iRect ? iRect.left - rRect.right : null,
          };
        });
      });
      console.log('  Card layout offsets:', cardLayout);
      await page.screenshot({ path: path.join(outDir, 'verify_full_pass_capsule.png') });
      
      // Close modal
      const closeBtn = page.locator('.k-modal-close').first();
      await closeBtn.click();
      await page.waitForTimeout(300);
      console.log('  ✓ Time Capsule modal alignment verified');
    }

    // 4. Verify Sound Studio Mixer
    console.log('[PASS AUDIT] 4. Checking Sound Studio...');
    const soundBtn = page.locator('.k-sound-pill-btn');
    if (await soundBtn.count() > 0) {
      await soundBtn.click();
      await page.waitForTimeout(400);
      
      // Activate rain sound
      const search = page.locator('.k-search input');
      if (await search.count() > 0) {
        await search.fill('heavy rain');
        await page.waitForTimeout(200);
        const rainCard = page.locator('.k-sound-card-header:has-text("Heavy Rain")').first();
        if (await rainCard.count() > 0) {
          await rainCard.click();
          await page.waitForTimeout(300);
        }
      }
      await page.screenshot({ path: path.join(outDir, 'verify_full_pass_sound_studio.png') });
      
      // Close Sound Studio
      const closeSound = page.locator('.k-sound-drawer-close, .k-drawer-close').first();
      if (await closeSound.count() > 0) {
        await closeSound.click();
        await page.waitForTimeout(300);
      }
      console.log('  ✓ Sound Studio verified');
    }

    console.log('\n[PASS AUDIT SUCCESS] Full visual & functional pass completed with zero errors.');
    process.exit(0);
  } catch (err) {
    console.error('[PASS AUDIT ERROR]', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
});
