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
    localStorage.setItem('kairo_seen_welcome', '1');
  });

  console.log('Navigating to http://127.0.0.1:4173 ...');
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
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

  await browser.close();
  if (failures.length > 0) {
    process.exit(1);
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
