let chromium;
try {
  chromium = require('playwright').chromium;
} catch {
  try {
    chromium = require('C:/Users/Gg/AppData/Roaming/npm/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright').chromium;
  } catch (e) {
    console.error('Playwright could not be loaded:', e.message);
    process.exit(1);
  }
}

const path = require('path');
const http = require('http');
const fs = require('fs');

const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('[TEXT AUDIT ERROR] dist/index.html does not exist. Please run "npm run build" first.');
  process.exit(1);
}

const outDir = process.env.AUDIT_OUT_DIR || path.join(__dirname, '..', '.audit-reports');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

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
  const filePath = path.join(distDir, reqPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(distDir, 'index.html'), (e2, indexData) => {
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
  console.log(`[TEXT AUDIT] Testing server running on http://127.0.0.1:${port}`);

  let browser;
  let hasFailure = false;

  try {
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
    };
    if (process.env.CHROME_PATH) {
      launchOptions.executablePath = process.env.CHROME_PATH;
    } else if (fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')) {
      launchOptions.executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    }

    browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    await page.addInitScript(() => {
      localStorage.setItem('kairo_seen_welcome', '1');
    });

    console.log(`Navigating to http://127.0.0.1:${port} ...`);
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    // Open Sound Studio
    const soundBtn = page.locator('.k-sound-pill-btn');
    await soundBtn.click();
    await page.waitForTimeout(400);

    // Activate "Wind In Trees"
    const searchInput = page.locator('.k-search input');
    await searchInput.fill('wind in trees');
    await page.waitForTimeout(200);
    const windInTrees = page.locator('.k-sound-card-header:has-text("Wind In Trees")').first();
    if (await windInTrees.count() > 0) await windInTrees.click();

    // Activate "Wind Chimes"
    await searchInput.fill('wind chimes');
    await page.waitForTimeout(200);
    const windChimes = page.locator('.k-sound-card-header:has-text("Wind Chimes")').first();
    if (await windChimes.count() > 0) await windChimes.click();

    // Activate "Temple"
    await searchInput.fill('temple');
    await page.waitForTimeout(200);
    const temple = page.locator('.k-sound-card-header:has-text("Temple")').first();
    if (await temple.count() > 0) await temple.click();

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(200);

    // Switch to Brainwaves tab and toggle tone
    const beatsTab = page.locator('#tab-beats');
    await beatsTab.click();
    await page.waitForTimeout(300);

    const startToneBtn = page.locator('.k-btn-synth-toggle, button:has-text("Start Tone"), button:has-text("Play")').first();
    if (await startToneBtn.count() > 0) {
      await startToneBtn.click();
      await page.waitForTimeout(300);
    }

    // Switch back to Ambient tab to see the unified mixer rack
    const soundsTab = page.locator('#tab-sounds');
    await soundsTab.click();
    await page.waitForTimeout(400);

    // Ensure rack is open
    const mixerToggle = page.locator('.k-mixer-collapse-toggle');
    if (await mixerToggle.count() > 0) {
      const isOpen = (await page.locator('.k-mixer-rack').count()) > 0;
      if (!isOpen) {
        await mixerToggle.click();
        await page.waitForTimeout(300);
      }
    }

    // AUDIT: Check all channel names for truncation or overflow
    const auditResults = await page.evaluate(() => {
      const channelNames = Array.from(document.querySelectorAll('.k-channel-strip .k-channel-name'));
      return channelNames.map(el => {
        const text = el.textContent ? el.textContent.trim() : '';
        const clientWidth = el.clientWidth;
        const scrollWidth = el.scrollWidth;
        const isClipped = scrollWidth > clientWidth + 1;
        const hasEllipsis = text.includes('...') || text.includes('…');
        return {
          text,
          clientWidth: `${clientWidth}px`,
          scrollWidth: `${scrollWidth}px`,
          isClipped,
          hasEllipsis,
          status: isClipped || hasEllipsis ? 'TRUNCATED' : 'OK',
        };
      });
    });

    console.log('\n=== MULTI-LAYER TEXT PLACEMENT & TRUNCATION AUDIT REPORT ===');
    console.table(auditResults);

    const failures = auditResults.filter(r => r.isClipped || r.hasEllipsis);
    if (failures.length > 0) {
      console.error(`FAILED: ${failures.length} channel names are truncated!`);
      hasFailure = true;
    } else {
      console.log(`PASSED: All ${auditResults.length} channel names are 100% visible and unclipped!`);
    }

    // Capture crop of the active mixer rack
    const mixerRack = page.locator('.k-mixer-rack');
    if (await mixerRack.count() > 0) {
      await mixerRack.screenshot({ path: path.join(outDir, 'verify_sound_studio_all_channels_crop.png') });
      console.log('Saved verify_sound_studio_all_channels_crop.png');
    }

    // AUDIT PART 2: Subtask Text Placement & Badge Visibility
    await page.evaluate(() => {
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
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);

    const subtaskAudit = await page.evaluate(() => {
      const subtaskNames = Array.from(document.querySelectorAll('.k-tree-subtask-name > span:first-child'));
      return subtaskNames.map(el => {
        const text = el.textContent ? el.textContent.trim() : '';
        const clientWidth = el.clientWidth;
        const scrollWidth = el.scrollWidth;
        const isClipped = scrollWidth > clientWidth + 1;
        return {
          name: text,
          clientWidth: `${clientWidth}px`,
          scrollWidth: `${scrollWidth}px`,
          isClipped,
          status: isClipped ? 'CLIPPED' : 'OK',
        };
      });
    });

    console.log('\n=== SUBTASK TEXT PLACEMENT REPORT ===');
    console.table(subtaskAudit);
  } catch (err) {
    console.error('[TEXT AUDIT ERROR]', err);
    hasFailure = true;
  } finally {
    if (browser) await browser.close();
    server.close();
    process.exit(hasFailure ? 1 : 0);
  }
});
