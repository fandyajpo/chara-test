import { chromium } from 'playwright';
import fs from 'node:fs';

import { PNG } from 'pngjs';

const OUT = '/tmp/shots';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForSelector('#loader.loader--hidden', { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(1200);
await page.addStyleTag({
  content: `
    html { scroll-behavior: auto !important; }
    html, body { background: #000 !important; background-image: none !important; }
    .glow { display: none !important; }
    .section-inner, #scrollHint, #progressBar, #topbar, #backToTop, #loader { display: none !important; }
  `,
});
await page.waitForTimeout(400);

const ids = await page.$$eval('.sec', (els) => els.map((e) => e.id));
const COLS = 100;
for (let i = 0; i < ids.length; i++) {
  await page.evaluate((idx) => {
    const el = document.querySelectorAll('.sec')[idx];
    window.scrollTo({ top: el.offsetTop, behavior: 'instant' });
  }, i);
  await page.waitForTimeout(2400);
  const file = `${OUT}/shape-${ids[i].replace('sec-', '')}.png`;
  await page.screenshot({ path: file });

  const png = PNG.sync.read(fs.readFileSync(file));
  const W = png.width;
  const H = png.height;
  const cellW = W / COLS;
  const cellH = cellW * 2.1;
  const ROWS = Math.floor(H / cellH);
  console.log(`\n=== ${ids[i]} ===`);
  for (let r = 0; r < ROWS; r++) {
    let line = '';
    for (let c = 0; c < COLS; c++) {
      const x0 = Math.floor(c * cellW);
      const x1 = Math.min(W, Math.floor((c + 1) * cellW));
      const y0 = Math.floor(r * cellH);
      const y1 = Math.min(H, Math.floor((r + 1) * cellH));
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let n = 0;
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const j = (y * W + x) * 4;
          sr += png.data[j];
          sg += png.data[j + 1];
          sb += png.data[j + 2];
          n++;
        }
      }
      const L = (0.299 * sr + 0.587 * sg + 0.114 * sb) / n;
      line += L > 120 ? '#' : L > 45 ? '+' : ' ';
    }
    console.log(line.replace(/\s+$/, '·'));
  }
}

await browser.close();
console.log('\ndone');
