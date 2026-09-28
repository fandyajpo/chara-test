/**
 * Fisika "soft-body" sederhana untuk charm yang menggantung.
 *
 * Bukan simulasi mesh penuh — kombinasi dua lapis yang hasilnya menyerupai:
 *  1. Pegas-pegas (semi-implicit Euler) pada rotasi ayun sumbu X/Z,
 *     di-impuls acak tiap 2–5 detik + torsi noise lembut supaya selalu hidup.
 *  2. Bend/lag lentur (dihitung dari kecepatan sudut) yang dikirim ke shader
 *     sebagai offset kuadratik dari titik gantung → bagian bawah "tertinggal"
 *     saat bergerak, seperti manik lunak di tali.
 *
 * Semua gerak diskalakan dengan jarak kamera supaya di section zoom-in
 * (closeup) amplitudo di layar tetap kecil dan framing tidak rusak.
 */
export function createCharmPhysics() {
  const reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  // Konstanta pegas: omega = sqrt(K) ≈ 3.9 rad/s (periode ±1.6s),
  // zeta = C / (2*sqrt(K)) ≈ 0.2 → ayun meredam perlahan (underdamped).
  const K = 15;
  const C = 1.55;
  const MAX_ANGLE = 0.075; // ±4.3° di titik gantung
  const LAG_POS = 0.012; // bend dari sudut (melengkung mengikuti ayun)
  const LAG_VEL = 0.045; // bend dari kecepatan (tertinggal / whip)
  const NOISE_AMP = 0.5;
  const IMPULSE_MIN = 2.2;
  const IMPULSE_SPAN = 3.3;

  // Fase noise acak supaya tiap sesi terasa berbeda
  let phase = Math.random() * Math.PI * 2;
  const w1 = 0.55 + Math.random() * 0.2;
  const w2 = 1.2 + Math.random() * 0.4;
  const p1 = Math.random() * Math.PI * 2;
  const p2 = Math.random() * Math.PI * 2;

  let rx = 0;
  let rz = 0;
  let vx = 0;
  let vz = 0;
  let nextImpulse = IMPULSE_MIN * 0.4; // kick pertama biar langsung hidup

  if (!reduced) {
    // Awal sudah sedikit miring → terlihat mengayun sejak detik pertama
    const a = Math.random() * Math.PI * 2;
    vx = Math.cos(a) * 0.45;
    vz = Math.sin(a) * 0.45;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  /**
   * @param {number} dt detik sejak frame terakhir
   * @param {number} dist jarak kamera (view.cz) untuk skala amplitudo
   * @returns {{rx:number, rz:number, bendX:number, bendZ:number}}
   */
  function update(dt, dist) {
    if (reduced) return { rx: 0, rz: 0, bendX: 0, bendZ: 0 };

    phase += dt;
    nextImpulse -= dt;
    if (nextImpulse <= 0) {
      // Impuls acak: "sesuatu menyentuh charm"
      const mag = 0.45 + Math.random() * 0.55;
      const ang = Math.random() * Math.PI * 2;
      vx += Math.cos(ang) * mag;
      vz += Math.sin(ang) * mag;
      nextImpulse = IMPULSE_MIN + Math.random() * IMPULSE_SPAN;
    }

    // Torsi noise lembut (dua sinus tak harmonik) + pegas + redaman
    const nx =
      NOISE_AMP * (Math.sin(w1 * phase + p1) + 0.55 * Math.sin(w2 * phase + p2));
    const nz =
      NOISE_AMP * (Math.sin(w1 * phase + p2) + 0.55 * Math.sin(w2 * phase + p1));

    vx += (-K * rx - C * vx + nx) * dt;
    rx += vx * dt;
    vz += (-K * rz - C * vz + nz) * dt;
    rz += vz * dt;
    rx = clamp(rx, -MAX_ANGLE, MAX_ANGLE);
    rz = clamp(rz, -MAX_ANGLE, MAX_ANGLE);

    // Amplitudo di layar ≈ konstan: makin dekat kamera, makin kecil geraknya
    const scale = clamp((dist - 0.8) / 3.5, 0.28, 1);

    return {
      rx: rx * scale,
      rz: rz * scale,
      bendX: (LAG_POS * rx - LAG_VEL * vx) * scale,
      bendZ: (LAG_POS * rz - LAG_VEL * vz) * scale,
    };
  }

  return { update, get reduced() { return reduced; } };
}
