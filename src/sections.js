/**
 * ============================================================================
 *  CAMERA KEYFRAMES — edit manual di sini
 * ============================================================================
 *
 *  Ruang koordinat model (scene.js selalu menormalkan GLB otomatis):
 *    - Tinggi model = 2 satuan, pusat tepat di (0, 0, 0)
 *    - y = +1  → bagian PALING ATAS  (klip lobster)
 *    - y = -1  → bagian PALING BAWAH (simpul benang)
 *    - Model pipih, menghadap kamera dari arah +Z
 *
 *  Tiap entri section punya:
 *    cam    : posisi kamera [x, y, z]
 *    target : titik yang dilihat kamera [x, y, z]
 *    rotY   : rotasi model pada section tersebut (satuan: radian)
 *
 *  POSISI BAGIAN (hasil ukur model, rentang y setelah normalisasi):
 *    +1.00 … +0.62  klip lobster putih
 *    +0.60 … +0.55  sambungan swivel (klip berputar)
 *    +0.55 … -0.35  rantai curb chain (menjuntai di samping manik)
 *    +0.42 … +0.25  manik hati puffy pink pertama
 *    +0.19 … +0.10  manik bulat pink kecil & mutiara putih
 *    +0.03 … -0.08  manik kupu-kupu putih pearlescent
 *    -0.13 … -0.29  manik bulat pink kecil & krem & putih
 *    -0.34 … -0.46  pony merah tua / gelap, pearl pink-lavender
 *    -0.52 … -0.64  MANIK UTAMA: hati besar pink (tengah menonjol, bingkai putih)
 *    -0.68 … -0.85  manik bulat pink kecil, mutiara, simpul benang
 *
 *  CATATAN ROTASI: model pipih — tampilan paling bagus saat rotY mendekati
 *  0 atau kelipatan 2π (menghadap kamera) atau π (menghadap belakang).
 *  Hindari rotY di sekitar π/2 (3π/2) untuk section dekat: model terlihat
 *  pinggir/tipis. Kecuali untuk rantai yang justru seru dilihat dari sisi.
 *
 *  CARA MENGUBAH:
 *    • Geser model ke KIRI layar  → beri x POSITIF serupa pada cam DAN target
 *      (contoh: cam[0] = 1.1 dan target[0] = 1.1)
 *    • Geser model ke KANAN layar → beri x NEGATIF serupa pada cam DAN target
 *    • Zoom in / out              → ubah z cam (makin kecil = makin dekat)
 *    • Menyorot bagian atas/bawah → ubah y cam & target bersamaan
 *      (y positif = atas, y negatif = bawah)
 *    • Putar model                → ubah rotY (kelipatan Math.PI = setengah
 *      putaran penuh, Math.PI * 2 = putaran penuh)
 *
 *  CATATAN:
 *    - x pada cam dan target sebaiknya SAMA AGAR murni geser (bukan memutar
 *      arah pandang kamera). Kalau dibuat beda, model akan tampak melenceng.
 *    - Nilai y di bawah adalah posisi vertikal bagian yang dibahas, diukur
 *      dari rentang -1..+1 (klip +1, simpul -1).
 *    - Layout desktop: x negatif = teks kiri / model kanan, dan sebaliknya.
 *    - Di layar kecil (< 768px) geser-x otomatis diabaikan, kamera otomatis
 *      menjauh, dan objek dinaikkan ke atas layar oleh scene.js.
 */

export const cameraKeyframes = [
  // 01 · HERO — full body, model di kanan, teks di kiri
  {
    id: 'hero',
    cam: [-1.15, 0.05, 4.3],
    target: [-1.15, 0.0, 0],
    rotY: -0.4,
  },

  // 02 · TENTANG OBJEK — full body lagi, model di kiri, teks di kanan
  {
    id: 'tentang',
    cam: [1.1, 0.08, 4.0],
    target: [1.1, 0.0, 0],
    rotY: 0.5,
  },

  // 03 · KLIP — zoom ke puncak (klip di y +0.62…+1.0), model di kanan
  {
    id: 'klip',
    cam: [-0.4, 0.86, 1.45],
    target: [-0.4, 0.8, 0],
    rotY: 0.1,
  },

  // 04 · RANTAI — zoom ke rantai (y +0.55…-0.35), model di kiri
  {
    id: 'rantai',
    cam: [0.42, 0.31, 1.5],
    target: [0.42, 0.25, 0],
    rotY: 0.55,
  },

  // 05 · MANIK ATAS — hati puffy + pink kecil + mutiara + kupu-kupu (y +0.42…-0.08)
  {
    id: 'atas',
    cam: [-0.4, 0.21, 1.45],
    target: [-0.4, 0.15, 0],
    rotY: -0.3,
  },

  // 06 · MANIK TENGAH — pink kecil, krem, putih, pony merah tua (y -0.13…-0.46)
  {
    id: 'tengah',
    cam: [0.27, -0.24, 1.15],
    target: [0.27, -0.3, 0],
    rotY: 0.6,
  },

  // 07 · MANIK UTAMA — hati besar (y -0.52…-0.64), zoom dekat, menghadap depan
  {
    id: 'utama',
    cam: [-0.2, -0.52, 1.0],
    target: [-0.2, -0.58, 0],
    rotY: 0.12,
  },

  // 08 · UJUNG — bulat pink kecil, mutiara, simpul (y -0.68…-0.85)
  {
    id: 'ujung',
    cam: [0.16, -0.68, 0.95],
    target: [0.16, -0.74, 0],
    rotY: -0.45,
  },

  // 09 · MATERIAL — tarik jauh, model di tengah di belakang kartu
  {
    id: 'material',
    cam: [0, 0.05, 5.4],
    target: [0, 0.0, 0],
    rotY: -0.15,
  },

  // 10 · PENUTUP — full body, model berputar 360° penuh (-0.15 → -0.15 + 2π)
  {
    id: 'penutup',
    cam: [0, 0.05, 4.1],
    target: [0, 0.0, 0],
    rotY: -0.15 + Math.PI * 2,
  },
];

/** Nama section (urutannya harus sama dengan cameraKeyframes). */
export const sectionIds = [
  'sec-hero',
  'sec-tentang',
  'sec-klip',
  'sec-rantai',
  'sec-atas',
  'sec-tengah',
  'sec-utama',
  'sec-ujung',
  'sec-material',
  'sec-penutup',
];
