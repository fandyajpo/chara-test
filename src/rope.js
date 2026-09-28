import * as THREE from "three";

/**
 * Simulasi tali (Verlet) untuk charm yang menggantung — "real rope physics".
 *
 * Tali = rantai node dari titik gantung (klip, dipaku di asal) sampai ujung
 * model. Tiap frame:
 *   1. (Opsional) user menarik node via seretan pointer → node di-lerp ke
 *      target; saat dilepas, kecepatan seret diteruskan sebagai fling.
 *   2. Integrasikan Verlet dengan gravitasi, turbulensi halus, impuls "gust"
 *      acak; plus gaya fiktif dari rotasi scroll (Coriolis + centrifugal) —
 *      saat scroll memutar charm, ekornya ikut meleset/whip.
 *   3. Proyeksikan constraint jarak (panjang tali konstan) + batas amplitudo.
 *   4. Hitung "bone" per segmen (pusat + kuarternion arah) → dikirim ke
 *      shader sebagai skinning, sehingga mesh melengkung mengikuti kurva
 *      tali (bukan cuma miring kaku).
 *
 * Amplitudo gaya diskalakan jarak kamera supaya section closeup tidak
 * kehilangan framing. prefers-reduced-motion → hanya gerakan dari user
 * (seretan) yang aktif; gust/turbulensi/whip dimatikan.
 */
export function createRope({ segments = 10, length = 2 } = {}) {
  const reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const N = segments; // jumlah segmen; node = N + 1
  const NODES = N + 1;
  const SEG = length / N;

  const pos = [];
  const prev = [];
  for (let i = 0; i < NODES; i++) {
    const y = -SEG * i;
    pos.push(new THREE.Vector3(0, y, 0));
    prev.push(new THREE.Vector3(0, y, 0));
  }

  // Bone output (pusat segmen + orientasi) untuk skinning di shader
  const bones = [];
  for (let i = 0; i < N; i++) {
    bones.push({
      center: new THREE.Vector3(0, -SEG * (i + 0.5), 0),
      quat: new THREE.Quaternion(),
    });
  }

  const G = 26; // gravitasi units/s² (periode penuh ±1.7s → ayun anggun)
  const DRAG_DAMP = 1.1; // redaman velocity per detik
  const TURB_AMP = 0.7; // turbulensi konstan (units/s²)
  const KICK_MIN = 2.5;
  const KICK_SPAN = 3.5;
  const KICK_V = [0.4, 0.95]; // kecepatan impuls gust (units/s)
  const HOLD_LERP = 26; // kaku-nya tarikan pointer (1/s)
  const FLING_MAX = 5; // batas kecepatan fling saat dilepas (units/s)

  const restDir = new THREE.Vector3(0, -1, 0);
  const _d = new THREE.Vector3();

  let time = Math.random() * 20;
  let nextKick = 0.4 + Math.random() * 1.6; // kick awal biar langsung hidup
  const tw1 = 0.7 + Math.random() * 0.4;
  const tw2 = 1.5 + Math.random() * 0.5;
  const tp1 = Math.random() * 6.28;
  const tp2 = Math.random() * 6.28;

  // --- State interaksi (seret pointer) --------------------------------------
  let grabbed = -1; // index node yang dipegang, -1 = tidak ada
  let lastD = 1 / 60;
  const holdTarget = new THREE.Vector3();
  const _fling = new THREE.Vector3();

  /** Pegang node tali (index). Node 0 dipaku — jangan dipegang. */
  function grab(i) {
    grabbed = i > 0 ? i : 1;
    nextKick = Math.max(nextKick, 1.2); // jangan gust saat sedang dimainkan
  }

  /** Target posisi (ruang tali) saat node dipegang. */
  function dragTo(v) {
    if (grabbed >= 0) holdTarget.copy(v);
  }

  /** Lepas pegangan; `vel` (units/s, ruang tali) jadi fling awal. */
  function release(vel) {
    if (grabbed >= 0) {
      _fling.copy(vel);
      const m = _fling.length();
      if (m > FLING_MAX) _fling.multiplyScalar(FLING_MAX / m);
      // velocity = (pos - prev)/dt → prev = pos - vel·dt
      prev[grabbed].copy(pos[grabbed]).addScaledVector(_fling, -lastD);
    }
    grabbed = -1;
  }

  /** Dorongan horizontal mendadak (velocity delta), bobot makin besar ke bawah. */
  function kick(fx, fz) {
    for (let i = 1; i < NODES; i++) {
      const w = 0.2 + (0.8 * i) / N;
      prev[i].x -= fx * w; // velocity += fx*w
      prev[i].z -= fz * w;
    }
  }

  /**
   * @param {number} dt detik
   * @param {number} dist jarak kamera (view.cz)
   * @param {number} omega kecepatan sudut pivot (rotY, rad/s)
   */
  function update(dt, dist, omega) {
    const d = (lastD = Math.min(0.033, Math.max(0.001, dt)));
    time += d;
    const scale = Math.min(1, Math.max(0.25, (dist - 0.8) / 3.5));
    const damp = Math.exp(-DRAG_DAMP * d);
    const autonomous = !reduced; // gerakan dari lingkungan (bukan user)

    // --- Pegangan pointer: tarik node ke target, tanpa kecepatan warisan ----
    if (grabbed >= 0) {
      const p = pos[grabbed];
      p.lerp(holdTarget, Math.min(1, d * HOLD_LERP));
      prev[grabbed].copy(p);
    }

    // --- Gust acak (dimatikan saat node dipegang / reduced motion) ----------
    if (autonomous && grabbed < 0) {
      nextKick -= d;
      if (nextKick <= 0) {
        const ang = Math.random() * Math.PI * 2;
        const v =
          (KICK_V[0] + Math.random() * (KICK_V[1] - KICK_V[0])) * scale;
        kick(Math.cos(ang) * v, Math.sin(ang) * v);
        nextKick = KICK_MIN + Math.random() * KICK_SPAN;
      }
    }

    const w = autonomous ? THREE.MathUtils.clamp(omega, -8, 8) : 0;
    const w2 = w * w;
    const turbX = autonomous ? TURB_AMP * scale * Math.sin(time * tw1 + tp1) : 0;
    const turbZ = autonomous ? TURB_AMP * scale * Math.sin(time * tw2 + tp2) : 0;

    // --- Integrasi Verlet ----------------------------------------------------
    for (let i = 1; i < NODES; i++) {
      const p = pos[i];
      const pr = prev[i];
      const h = i / N;

      let ax = turbX * (0.3 + 0.7 * h) + w2 * p.x;
      let ay = -G;
      let az = turbZ * (0.3 + 0.7 * h) + w2 * p.z;

      // Coriolis: -2 ω × v (ω di sumbu Y) — dari kecepatan langkah sebelumnya
      if (w !== 0) {
        ax += -2 * w * ((p.z - pr.z) / d);
        az += 2 * w * ((p.x - pr.x) / d);
      }

      // x' = x + (x - prev)·damp + a·dt²
      const nx = p.x + (p.x - pr.x) * damp + ax * d * d;
      const ny = p.y + (p.y - pr.y) * damp + ay * d * d;
      const nz = p.z + (p.z - pr.z) * damp + az * d * d;
      pr.set(p.x, p.y, p.z);
      p.set(nx, ny, nz);
    }

    // --- Constraint jarak (panjang tali konstan) ---------------------------
    for (let iter = 0; iter < 5; iter++) {
      pos[0].set(0, 0, 0); // paku titik gantung
      for (let i = 0; i < N; i++) {
        const a = pos[i];
        const b = pos[i + 1];
        _d.subVectors(b, a);
        const len = _d.length() || 1e-6;
        const diff = (len - SEG) / len;
        const wa = i === 0 ? 0 : 0.5;
        const wb = i === 0 ? 1 : 0.5;
        a.addScaledVector(_d, diff * wa);
        b.addScaledVector(_d, -diff * wb);
      }
      // Batas amplitudo horizontal (pengaman framing; node yang dipegang
      // dibebaskan supaya bebas ditarik ke mana pun)
      for (let i = 1; i < NODES; i++) {
        if (i === grabbed) continue;
        const p = pos[i];
        const maxR = (i / N) * (0.12 + 0.55 * scale);
        const r = Math.hypot(p.x, p.z);
        if (r > maxR) {
          const s = maxR / r;
          p.x *= s;
          p.z *= s;
        }
      }
    }

    // --- Hitung bone: pusat segmen + kuarternion arah ----------------------
    for (let i = 0; i < N; i++) {
      const a = pos[i];
      const b = pos[i + 1];
      bones[i].center.addVectors(a, b).multiplyScalar(0.5);
      _d.subVectors(b, a).normalize();
      bones[i].quat.setFromUnitVectors(restDir, _d);
    }
    return bones;
  }

  return { update, grab, dragTo, release, kick, reduced, bones, pos };
}
