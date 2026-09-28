import fs from 'node:fs';

import { PNG } from 'pngjs';

const files = process.argv.slice(2);
const COLS = Number(process.env.COLS || 110);
const CROP = process.env.CROP; // "x,y,w,h"

for (const file of files) {
  const full = PNG.sync.read(fs.readFileSync(file));
  let png = full;
  if (CROP) {
    const [x, y, w, h] = CROP.split(',').map(Number);
    png = new PNG({ width: w, height: h });
    PNG.bitblt(full, png, x, y, w, h, 0, 0);
  }
  const W = png.width;
  const H = png.height;
  const cellW = W / COLS;
  const cellH = cellW * 2.1; // karakter terminal ~2.1:1
  const ROWS = Math.floor(H / cellH);

  console.log(`\n=== ${file.split('/').pop()} (${W}x${H}) ===`);
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
          const i = (y * W + x) * 4;
          sr += png.data[i];
          sg += png.data[i + 1];
          sb += png.data[i + 2];
          n++;
        }
      }
      const R = sr / n;
      const G = sg / n;
      const B = sb / n;
      const L = 0.299 * R + 0.587 * G + 0.114 * B;
      const sat = Math.max(R, G, B) - Math.min(R, G, B);
      let ch;
      if (L < 175 || sat > 60) ch = '#'; // model / teks kuat / warna pekat
      else if (L < 225) ch = '+'; // tepi kartu / bayangan / teks
      else if (sat < 12 && L > 228) ch = '·'; // putih netral: klip / kartu
      else ch = '.'; // background pastel
      line += ch;
    }
    console.log(line.replace(/\s+$/, ''));
  }
}
