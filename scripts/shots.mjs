import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:5173/';
const OUT = '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];

async function shoot(label, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`);
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('#loader.loader--hidden', { timeout: 30000 });
  await page.waitForTimeout(1600);

  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
  await page.evaluate(() => {
    window.__charm = window.__charm || null;
  });
  const ids = await page.$$eval('.sec', (els) => els.map((e) => e.id));
  for (let i = 0; i < ids.length; i++) {
    await page.evaluate((idx) => {
      const el = document.querySelectorAll('.sec')[idx];
      window.scrollTo({ top: el.offsetTop, behavior: 'instant' });
    }, i);
    await page.waitForTimeout(2600);
    const info = await page.evaluate(() => {
      const center = document.elementFromPoint(30, window.innerHeight / 2);
      const centerSec = center ? center.closest('.sec')?.id : null;
      const b = window.__charm ? window.__charm.getBounds() : null;
      const v = window.__charm ? window.__charm.getView() : null;
      const pct = (n) => Math.round(((n + 1) / 2) * 100);
      return {
        centerSec,
        scrollY: Math.round(window.scrollY),
        model: b
          ? `x ${pct(b.minX)}%..${pct(b.maxX)}%  y ${pct(-b.maxY)}%..${pct(-b.minY)}%`
          : null,
        view: v ? `cx${v.cx.toFixed(2)} cy${v.cy.toFixed(2)} cz${v.cz.toFixed(2)} rot${v.rotY.toFixed(2)}` : null,
      };
    });
    console.log(`${label}${i}-${ids[i].replace('sec-', '')} =>`, JSON.stringify(info));
    await page.screenshot({ path: `${OUT}/${label}${i}-${ids[i].replace('sec-', '')}.png` });
  }
  await page.close();
}

await shoot('d', { width: 1440, height: 900 });
await shoot('m', { width: 390, height: 844 });
await browser.close();

if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'));
} else {
  console.log('no page errors');
}
console.log('done ->', OUT);
