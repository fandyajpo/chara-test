# Pink Heart Charm — scroll storytelling 3D

Website satu halaman yang menampilkan **satu** objek 3D (gantungan manik handmade,
`public/charm-opt.glb`) dengan cerita per section. Objek tetap sticky di layar,
kamera bergerak mengikuti scroll, teks muncul per section.

Stack: **Vite + vanilla JS · three.js · GSAP ScrollTrigger · @fontsource** (semua via npm, tanpa CDN).

## Menjalankan

```bash
npm install
npm run dev       # buka http://localhost:5173
npm run build     # build produksi ke dist/
npm run preview   # cek hasil build
npm run lint      # oxlint
```

## Struktur file

```
index.html          # seluruh teks/section (10 section) + loader + progress bar
src/main.js         # bootstrap, timeline GSAP ScrollTrigger, reveal teks
src/scene.js        # three.js: renderer, lighting, load GLB, resize, dispose
src/sections.js     # cameraKeyframes (posisi kamera / rotasi per section)
src/rope.js         # fisika tali Verlet (gantungan charm: gravitasi, gust, whip)
src/softbody.js     # skin bone-tali di shader (mesh melengkung ikut kurva tali)
src/style.css       # tema pastel dreamy, layout, responsif
public/charm-opt.glb  # model 3D
```

## Cara mengganti file GLB

1. Timpa `public/charm-opt.glb` dengan file baru (nama harus sama), **atau**
   ubah konstanta `MODEL_URL` di `src/scene.js`.
2. Tidak perlu khawatir soal ukuran/orientasi: bounding box dihitung otomatis,
   lalu model di-center dan di-scale supaya pas di layar (tinggi = 2 satuan,
   pusat di `(0, 0, 0)`, klip di `y = +1`, ujung di `y = -1`).

## Cara mengedit teks section

Semua teks ada di `index.html` — cari komentar `<!-- 01 · HERO -->` sampai
`<!-- 10 · PENUTUP -->`. Setiap section memakai `data-side="left|right|center"`
untuk menentukan sisi teks (model otomatis di sisi berlawanan).

## Cara mengedit keyframe kamera

Buka `src/sections.js`. Ada array `cameraKeyframes` berisi satu entri per section:

```js
{
  id: 'klip',
  cam: [-0.4, 0.86, 1.45],   // posisi kamera [x, y, z]
  target: [-0.4, 0.8, 0],    // titik yang dilihat [x, y, z]
  rotY: 0.1,                 // rotasi model (radian)
}
```

Panduan singkat (detail lengka di komentar file `sections.js`):

- **Geser model ke kiri/kanan layar** → ubah nilai `x` pada `cam` **dan**
  `target` (positif = model ke kiri, negatif = model ke kanan; sebaiknya sama
  agar murni geser).
- **Zoom** → ubah `z` pada `cam` (makin kecil = makin dekat).
- **Menyorot bagian atas/bawah model** → ubah `y` pada `cam` dan `target`.
  Model dinormalisasi ke rentang `y = +1` (klip) sampai `y = -1` (simpul),
  jadi misalnya rantai ≈ `y +0.25`, manik utama ≈ `y -0.58`.
- **Putar model** → ubah `rotY` (radian; `Math.PI * 2` = putaran penuh 360°).

Jumlah entri `cameraKeyframes` harus sama dengan jumlah section di `index.html`
(10). Urutan `sectionIds` di file yang sama dipakai untuk validasi.

## Catatan performa & aksesibilitas

- Render loop dijeda saat tab tidak aktif (`visibilitychange`).
- Resource three.js di-dispose saat halaman ditutup (`pagehide`).
- Resize menyesuaikan aspek kamera, ukuran renderer, dan pixel ratio (maks 2).
- `prefers-reduced-motion: reduce` → putaran idle & animasi slide dimatikan,
  scrub scroll dibuat tanpa smoothing.

## QA (opsional)

`scripts/` berisi tool verifikasi framing (butuh dev server jalan di
port 5173, plus `npx playwright install chromium` sekali saja):

```bash
node scripts/shots.mjs   # screenshot per section + posisi model di layar (%)
node scripts/shapes.mjs  # siluet model per section (latar hitam, ASCII)
node scripts/ascii.mjs <file.png>  # render screenshot sebagai ASCII
```

`shots.mjs` mencetak batas model dalam % layar per section —
pakai untuk cek model tidak terpotong / tidak menabrak kartu teks.
