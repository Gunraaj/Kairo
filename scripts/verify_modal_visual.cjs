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
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true,
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.addInitScript(() => {
      localStorage.setItem('kairo_seen_welcome', '1');
    });

    await page.goto(`http://127.0.0.1:${port}`);
    await page.waitForTimeout(600);

    // Click "Import Syllabus" button in sidebar
    const importBtn = page.locator('button:has-text("Import Syllabus")');
    if (await importBtn.count() > 0) {
      await importBtn.click();
      await page.waitForTimeout(400);

      // Verify modal is open
      const modal = page.locator('.k-doc-breakdown-modal');
      await modal.waitFor({ state: 'visible' });

      // Capture initial modal input view with engine chips
      await page.screenshot({ path: path.join(outDir, 'verify_doc_breakdown_modal.png') });
      console.log('Saved verify_doc_breakdown_modal.png');

      // Click "Ollama & API Guide" FAQ toggle
      const faqToggle = page.locator('.k-doc-engine-faq-toggle');
      if (await faqToggle.count() > 0) {
        await faqToggle.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(outDir, 'verify_doc_breakdown_faq.png') });
        console.log('Saved verify_doc_breakdown_faq.png');
      }

      // Click "Calculus" sample starter to populate
      const calculusBtn = page.locator('button:has-text("Calculus")');
      if (await calculusBtn.count() > 0) {
        await calculusBtn.click();
        await page.waitForTimeout(300);
      }

      // Click Analyze & Stage Plan
      const analyzeBtn = page.locator('.k-doc-analyze-btn');
      await analyzeBtn.click();
      await page.waitForTimeout(600);

      // Staging view capture
      await page.screenshot({ path: path.join(outDir, 'verify_doc_breakdown_staging.png') });
      console.log('Saved verify_doc_breakdown_staging.png');
    }

    console.log('[MODAL VISUAL SUCCESS]');
    process.exit(0);
  } catch (err) {
    console.error('[MODAL VISUAL ERROR]', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
});
