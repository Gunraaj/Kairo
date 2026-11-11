const { chromium } = require('C:/Users/Gg/AppData/Roaming/npm/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

const outDir = 'C:/Users/Gg/.gemini/antigravity/brain/4ecd6f56-37e5-4910-bfc2-4fa7fa97b445';

// Simple static server for dist
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
  console.log(`Internal test server on http://127.0.0.1:${port}`);

  try {
    const browser = await chromium.launch({
      executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true,
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(() => {
      localStorage.setItem('kairo_seen_welcome', '1');
    });

    await page.goto(`http://127.0.0.1:${port}`);
    await page.waitForTimeout(500);

    // Open Future Treat / Time Capsule modal
    const capsuleBtn = page.locator('.k-capsule-pill-btn, button:has-text("Future Treat")').first();
    await capsuleBtn.click();
    await page.waitForTimeout(400);

    // Select the 3rd radio button 'time' to reproduce the exact state from user's screenshot
    const timeRadio = page.locator('input[value="time"], .k-trigger-card:has-text("Today at Scheduled Time") input');
    if (await timeRadio.count() > 0) {
      await timeRadio.click();
      await page.waitForTimeout(300);
    }

    const modal = page.locator('.k-modal');
    if (await modal.count() > 0) {
      await modal.screenshot({ path: path.join(outDir, 'verify_capsule_alignment_after.png') });
      console.log('Saved verify_capsule_alignment_after.png');
    }

    // Capture specific crop of trigger options
    const triggerOptions = page.locator('.k-trigger-options');
    if (await triggerOptions.count() > 0) {
      await triggerOptions.screenshot({ path: path.join(outDir, 'verify_capsule_trigger_options_crop.png') });
      console.log('Saved verify_capsule_trigger_options_crop.png');
    }

    await browser.close();
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    server.close();
  }
});
