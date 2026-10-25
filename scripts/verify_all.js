import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Gg/.gemini/antigravity/brain/4ecd6f56-37e5-4910-bfc2-4fa7fa97b445';

async function run() {
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop verification (1280x800)
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Populate mock data with tasks so summary bar has active numbers
  await page.goto('http://127.0.0.1:4173/?welcome=0');
  await page.evaluate(() => {
    const sampleProjects = [
      {
        id: 'p-1',
        name: 'Deep Learning Research',
        color: '#dc2626',
        tasks: [
          {
            id: 't-1',
            name: 'Read Attention is All You Need',
            completed: false,
            targetRounds: 4,
            pomodoroLength: 25,
            timeSpent: 25,
            subTasks: [
              { id: 'st-1', name: 'Self-attention derivation', completed: true, minutes: 25, timeSpent: 25 },
              { id: 'st-2', name: 'Multi-head projection notes', completed: false, minutes: 25, timeSpent: 0 },
            ]
          },
          {
            id: 't-2',
            name: 'Transformer architecture diagrams',
            completed: false,
            targetRounds: 2,
            pomodoroLength: 25,
            timeSpent: 0,
            subTasks: []
          }
        ]
      },
      {
        id: 'p-2',
        name: 'Design System & Washi Polish',
        color: '#3b82f6',
        tasks: [
          {
            id: 't-3',
            name: 'Audit collapsed sidebar layout',
            completed: true,
            targetRounds: 2,
            pomodoroLength: 25,
            timeSpent: 50,
            subTasks: []
          },
          {
            id: 't-4',
            name: 'Fine-tune tactile dial detents',
            completed: false,
            targetRounds: 3,
            pomodoroLength: 25,
            timeSpent: 0,
            subTasks: []
          }
        ]
      }
    ];
    localStorage.setItem('kairo_projects', JSON.stringify(sampleProjects));
    localStorage.setItem('kairo_active_task', JSON.stringify('t-1'));
    localStorage.setItem('kairo_seen_welcome', '1');
  });

  await page.reload();
  await page.waitForTimeout(600);

  // Capture 1: Desktop expanded with Pomofocus Summary Bar
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'verify_pomofocus_summary_bar.png'),
    fullPage: false,
  });
  console.log('Captured: verify_pomofocus_summary_bar.png');

  // Capture 2: Open Pomodoro Target Popover on task 't-1'
  const targetBadge = await page.$('.k-target-badge-compact');
  if (targetBadge) {
    await targetBadge.click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'verify_target_popover_duration_chips.png'),
      fullPage: false,
    });
    console.log('Captured: verify_target_popover_duration_chips.png');
    // Click outside to close popover
    await page.mouse.click(600, 200);
    await page.waitForTimeout(300);
  }

  // Capture 3: Sound Studio with Windows-style mute icon and YouTube focus streams
  const soundBtn = await page.$('.k-sound-pill-btn');
  if (soundBtn) {
    await soundBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'verify_sound_studio_windows_mute.png'),
      fullPage: false,
    });
    console.log('Captured: verify_sound_studio_windows_mute.png');

    // Click mute on first channel
    const muteBtn = await page.$('.k-channel-mute-btn');
    if (muteBtn) {
      await muteBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'verify_sound_studio_muted_state.png'),
        fullPage: false,
      });
      console.log('Captured: verify_sound_studio_muted_state.png');
    }

    // Close Sound Studio
    await page.click('.k-sound-close-btn');
    await page.waitForTimeout(400);
  }

  // Capture 4: Desktop Collapsed Sidebar
  const collapseBtn = await page.$('.k-head-icon.k-collapse');
  if (collapseBtn) {
    await collapseBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'verify_desktop_collapsed_sidebar.png'),
      fullPage: false,
    });
    console.log('Captured: verify_desktop_collapsed_sidebar.png');
  }

  await context.close();

  // 2. Mobile verification (375x667 - iPhone SE / standard mobile)
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 667 },
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://127.0.0.1:4173/?welcome=0');
  await mobilePage.waitForTimeout(600);

  // Capture 5: Mobile View (Closed Drawer)
  await mobilePage.screenshot({
    path: path.join(ARTIFACT_DIR, 'verify_mobile_view_closed.png'),
    fullPage: false,
  });
  console.log('Captured: verify_mobile_view_closed.png');

  // Open mobile drawer by clicking hamburger
  const hamburgerBtn = await mobilePage.$('.k-head-icon.k-collapse');
  if (hamburgerBtn) {
    await hamburgerBtn.click();
    await mobilePage.waitForTimeout(400);
    // Capture 6: Mobile Drawer Open
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'verify_mobile_drawer_open.png'),
      fullPage: false,
    });
    console.log('Captured: verify_mobile_drawer_open.png');
  }

  await mobileContext.close();
  await browser.close();
  console.log('All visual verifications completed successfully!');
}

run().catch(err => {
  console.error('Error running verification:', err);
  process.exit(1);
});
