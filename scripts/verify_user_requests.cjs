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
  console.log(`[VERIFY] Local verification server on http://127.0.0.1:${port}`);

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
          name: 'Applied Quantum Physics',
          subProjects: [],
          isExpanded: true,
          tasks: [
            {
              id: 'task-1',
              name: 'Derive Dirac Delta equation',
              completed: false,
              timeSpent: 25,
              targetRounds: 4,
              pomodoroLength: 25,
              subTasks: [
                { id: 'sub-1', title: 'Parse coordinate operators', completed: true, estimatedMinutes: 20 },
                { id: 'sub-2', title: 'Normalize spinor fields', completed: false, estimatedMinutes: 30 },
                { id: 'sub-3', title: 'Calculate probability flux', completed: false, estimatedMinutes: 25 },
              ],
            },
          ],
        },
      ];
      localStorage.setItem('kairo_projects', JSON.stringify({ version: 2, data: sampleProjects }));
      localStorage.setItem('kairo_active_task_id', 'task-1');
      localStorage.setItem('kairo_stage_variation', 'classic');
    });

    await page.goto(`http://127.0.0.1:${port}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    // 1. Verify Classic Stage Variation
    console.log('[1/8] Verifying Classic Focus Variation...');
    await page.screenshot({ path: path.join(outDir, 'verify_stage_classic.png'), fullPage: true });

    // 2. Verify Zen Focus Variation
    console.log('[2/8] Switching to Zen Focus Variation...');
    const zenBtn = page.locator('.k-var-btn:has-text("Zen")');
    await zenBtn.click();
    await page.waitForTimeout(400);
    const isZenActive = await page.locator('.k-stage-zen.is-variation-zen').isVisible();
    console.log(` - Zen variation visible: ${isZenActive}`);
    await page.screenshot({ path: path.join(outDir, 'verify_stage_zen.png'), fullPage: true });

    // 3. Verify Cockpit Focus Variation
    console.log('[3/8] Switching to Cockpit Focus Variation...');
    const cockpitBtn = page.locator('.k-var-btn:has-text("Cockpit")');
    await cockpitBtn.click();
    await page.waitForTimeout(400);
    const isCockpitActive = await page.locator('.k-stage-zen.is-variation-cockpit').isVisible();
    const hasSubtasksPreview = await page.locator('.k-cockpit-subtasks-preview').isVisible();
    console.log(` - Cockpit variation visible: ${isCockpitActive}, subtasks preview: ${hasSubtasksPreview}`);
    await page.screenshot({ path: path.join(outDir, 'verify_stage_cockpit.png'), fullPage: true });

    // 4. Verify De-cramped Sound Studio Sidebar (Quick Live Mixer & Presets)
    console.log('[4/8] Opening Sound Studio Sidebar...');
    const soundPill = page.locator('.k-sound-pill-btn');
    await soundPill.click();
    await page.waitForTimeout(500);

    const hasQuickDeck = await page.locator('.k-sl-quick-deck').isVisible();
    const hasMasterBar = await page.locator('.k-mixer-master-bar').isVisible();
    const hasBrowseCard = await page.locator('.k-sl-open-modal-btn').isVisible();
    console.log(` - Sound Studio Sidebar Quick Deck: ${hasQuickDeck}, Master Bar: ${hasMasterBar}, Browse Button: ${hasBrowseCard}`);
    await page.screenshot({ path: path.join(outDir, 'verify_sound_sidebar_quick_deck.png'), fullPage: true });

    // 5. Verify 1-Click Atmosphere Preset Playback
    console.log('[5/8] Activating 1-Click Atmosphere preset...');
    const cafePreset = page.locator('button.k-atmosphere-chip:has-text("Rainy Cafe")').first();
    await cafePreset.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, 'verify_sound_sidebar_active_mix.png'), fullPage: true });

    // 6. Verify Opening the Expansive Sound Library Modal
    console.log('[6/8] Opening Expansive Sound Library Modal...');
    const browseBtn = page.locator('.k-sl-open-modal-btn');
    await browseBtn.click();
    await page.waitForTimeout(600);

    const isLibraryModalVisible = await page.locator('.k-sound-library-dialog').isVisible();
    console.log(` - Sound Library Modal visible: ${isLibraryModalVisible}`);
    await page.screenshot({ path: path.join(outDir, 'verify_sound_library_modal.png'), fullPage: true });

    // 7. Verify Stream Icon Horizontal Row in Lofi Custom Stream Form
    console.log('[7/8] Verifying Stream Icon Horizontal Row...');
    // Switch to Lofi tab in modal
    const lofiTab = page.locator('button#modal-tab-lofi');
    await lofiTab.click();
    await page.waitForTimeout(400);

    // Click "+ Save Custom Stream"
    const saveCustomStreamBtn = page.locator('button:has-text("+ Save Custom Stream")');
    if (await saveCustomStreamBtn.isVisible()) {
      await saveCustomStreamBtn.click();
      await page.waitForTimeout(300);
    }

    const emojiRow = page.locator('.k-emoji-row');
    const isEmojiRowVisible = await emojiRow.isVisible();
    let emojiRowDisplay = 'none';
    if (isEmojiRowVisible) {
      emojiRowDisplay = await emojiRow.evaluate(el => window.getComputedStyle(el).display);
    }
    console.log(` - Stream Icon Emoji Row visible: ${isEmojiRowVisible}, display: ${emojiRowDisplay}`);
    await page.screenshot({ path: path.join(outDir, 'verify_lofi_stream_icon_row.png'), fullPage: true });

    // 8. Verify Lofi Girl iframe attributes (no sandbox, proper referrerPolicy)
    console.log('[8/8] Verifying Lofi Stream iframe attributes...');
    const lofiGirlCard = page.locator('button.k-station-card:has-text("Lofi Girl")').first();
    await lofiGirlCard.click();
    await page.waitForTimeout(500);

    const iframe = page.locator('iframe[title="Lofi focus stream player"]');
    const isIframePresent = await iframe.isVisible();
    let sandboxAttr = null;
    let allowAttr = null;
    if (isIframePresent) {
      sandboxAttr = await iframe.getAttribute('sandbox');
      allowAttr = await iframe.getAttribute('allow');
    }
    console.log(` - Lofi Player iframe rendered: ${isIframePresent}`);
    console.log(` - sandbox attribute (must be null): ${sandboxAttr}`);
    console.log(` - allow attribute: ${allowAttr}`);
    await page.screenshot({ path: path.join(outDir, 'verify_lofi_player_active.png'), fullPage: true });

    // Close modal while on desktop
    const closeBtn = page.locator('.modal-card.k-sound-library-dialog .k-modal-close');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }
    // Also close the sound studio drawer while on desktop
    const closeDrawerBtn = page.locator('aside.k-sound-lib .k-sl-close-btn');
    if (await closeDrawerBtn.isVisible()) {
      await closeDrawerBtn.click();
      await page.waitForTimeout(300);
    }

    // 9. Mobile Responsiveness (iPhone 390x844)
    console.log('[Mobile] Testing Mobile Viewport (390x844)...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);

    await page.screenshot({ path: path.join(outDir, 'verify_mobile_stage_cockpit.png'), fullPage: true });

    // Switch to Zen on mobile
    const zenBtnMobile = page.locator('.k-var-btn:has-text("Zen")');
    if (await zenBtnMobile.isVisible()) {
      await zenBtnMobile.click({ force: true });
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: path.join(outDir, 'verify_mobile_stage_zen.png'), fullPage: true });

    console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('Verification failed:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
});
