import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { createCharmPhysics } from "./physics.js";
import { createSoftBody } from "./softbody.js";

// const MODEL_URL = '/charm-opt.glb';
const MODEL_URL = "/charm-opt-2.glb";
const TARGET_HEIGHT = 2; // tinggi model setelah dinormalisasi (satuan scene)
const FOV = 35;
const MOBILE_QUERY = "(max-width: 767px)";
const MOBILE_ZOOM = 1.45; // kamera menjauh di layar kecil supaya muat
const MOBILE_LIFT = 0.36; // fraksi setengah-tinggi viewport: objek naik ke atas

/**
 * Menyiapkan scene three.js: renderer, lighting, load GLB, normalisasi model,
 * render loop, resize, dan dispose.
 *
 * @param {{canvas: HTMLCanvasElement, initial?: object, onProgress?: (p:number)=>void, onError?: (e:Error)=>void}} opts
 */
export async function createScene({
  canvas,
  initial = null,
  onProgress = () => {},
  onError = () => {},
}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    const e = new Error("WebGL tidak tersedia di peramban ini.");
    onError(e);
    throw e;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  // --- Lighting: RoomEnvironment (PMREM) + 1 directional light lembut -------
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTarget = pmrem.fromScene(room, 0.04);
  scene.environment = envTarget.texture;
  room.dispose?.();
  pmrem.dispose();

  const keyLight = new THREE.DirectionalLight(0xfff4f8, 1.5);
  keyLight.position.set(2.4, 3.6, 3.2);
  scene.add(keyLight);

  const camera = new THREE.PerspectiveCamera(
    FOV,
    window.innerWidth / window.innerHeight,
    0.1,
    60,
  );
  camera.position.set(0, 0, 4.3);

  // --- Load model -----------------------------------------------------------
  let gltf;
  try {
    gltf = await new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder); // GLB dikompresi EXT_meshopt_compression
      loader.load(
        MODEL_URL,
        resolve,
        (xhr) => {
          if (xhr.total > 0) onProgress(Math.min(0.96, xhr.loaded / xhr.total));
        },
        (err) =>
          reject(err instanceof Error ? err : new Error("GLB gagal dimuat")),
      );
    });
  } catch (err) {
    const e = new Error(
      "Charm 3D tidak bisa dimuat. Pastikan file public/charm-opt.glb ada, lalu coba lagi.",
    );
    e.cause = err;
    onError(e);
    throw e;
  }
  onProgress(1);

  // --- Normalisasi: tegakkan, center, dan scale supaya muat di layar --------
  // GLB datar (panjang di sumbu Z); kita putar +90° di sumbu X supaya tegak
  // dengan klip di atas, lalu skala tingginya ke TARGET_HEIGHT dan center.
  const upright = new THREE.Group();
  upright.add(gltf.scene);
  upright.rotation.x = Math.PI / 2;
  upright.updateMatrixWorld(true);

  let box = new THREE.Box3().setFromObject(upright);
  const size = box.getSize(new THREE.Vector3());
  upright.scale.setScalar(TARGET_HEIGHT / Math.max(size.y, 1e-6));
  upright.updateMatrixWorld(true);

  box = new THREE.Box3().setFromObject(upright);
  const center = box.getCenter(new THREE.Vector3());
  upright.position.sub(center);

  const spinner = new THREE.Group(); // rotasi idle (putaran pelan di hero)
  const pivot = new THREE.Group(); // rotasi dari scroll timeline
  // sway = titik gantung soft-body: berada di puncak model (y = +1 pada pivot)
  // dan jadi poros ayunan; spinner digeser -1 supaya model tetap di tengah.
  const sway = new THREE.Group();
  sway.position.y = TARGET_HEIGHT / 2;
  spinner.position.y = -TARGET_HEIGHT / 2;
  spinner.add(upright);
  sway.add(spinner);
  pivot.add(sway);
  scene.add(pivot);
  pivot.updateMatrixWorld(true);

  // Material glossy: dorong sedikit pantulan environment-nya
  gltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (mat && "envMapIntensity" in mat) mat.envMapIntensity = 1.3;
    }
  });

  // Soft-body: clone material + hook shader (bend kuadratik dari titik gantung)
  const soft = createSoftBody(gltf.scene, sway);
  const physics = createCharmPhysics();

  // --- State kamera yang digerakkan scroll ---------------------------------
  const view = {
    cx: 0,
    cy: 0.05,
    cz: 4.3,
    tx: 0,
    ty: 0,
    tz: 0,
    rotY: 0,
  };
  if (initial) Object.assign(view, initial);
  let idleWeight = 1; // 1 = putaran pelan aktif (hero), 0 = mati
  let idleAngle = 0;
  const halfTan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const mobile = window.matchMedia(MOBILE_QUERY);
  const tmpDir = new THREE.Vector3();
  const tmpTarget = new THREE.Vector3();
  const tmpCam = new THREE.Vector3();

  function applyView() {
    // Vektor kamera → target pada data author (desktop)
    tmpDir.set(view.cx - view.tx, view.cy - view.ty, view.cz - view.tz);
    const dist = tmpDir.length() || 1;
    tmpDir.divideScalar(dist);

    if (mobile.matches) {
      // Layar kecil: abaikan geser-x, jauhkan kamera, naikkan objek ke atas.
      const d = dist * MOBILE_ZOOM;
      const halfH = d * halfTan;
      const lift = -MOBILE_LIFT * halfH;
      tmpTarget.set(0, view.ty + lift, 0);
      tmpCam.copy(tmpTarget).addScaledVector(tmpDir, d);
    } else {
      tmpTarget.set(view.tx, view.ty, view.tz);
      tmpCam.copy(tmpTarget).addScaledVector(tmpDir, dist);
    }

    camera.position.copy(tmpCam);
    camera.lookAt(tmpTarget);
    pivot.rotation.y = view.rotY;
  }

  // --- Render loop (dijeda saat tab tidak aktif) ----------------------------
  let rafId = null;
  let last = performance.now();

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Putaran idle hanya di hero; saat scroll menjauh kembali halus ke 0
    // supaya rotasi tiap section selalu deterministik.
    if (idleWeight > 0) idleAngle += dt * 0.32 * idleWeight;
    spinner.rotation.y = idleAngle * idleWeight;
    // Soft-body: ayun pegas di titik gantung + lentur (bend) di shader
    const s = physics.update(dt, view.cz);
    sway.rotation.x = s.rx;
    sway.rotation.z = s.rz;
    applyView();
    scene.updateMatrixWorld(true);
    soft.update(s.bendX, s.bendZ);
    renderer.render(scene, camera);
  }

  function start() {
    if (rafId === null) {
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    }
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function onVisibility() {
    if (document.hidden) stop();
    else start();
  }

  // --- Resize ---------------------------------------------------------------
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
  }

  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);

  function dispose() {
    stop();
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    scene.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!mat) continue;
        for (const key of Object.keys(mat)) {
          const val = mat[key];
          if (val && val.isTexture) val.dispose();
        }
        mat.dispose();
      }
    });
    envTarget.dispose();
    renderer.dispose();
  }

  window.addEventListener("pagehide", dispose, { once: true });

  applyView();
  start();

  return {
    view,
    camera,
    /** Batas model di layar (koordinat NDC: -1..1) — untuk QA framing. */
    getScreenBounds() {
      pivot.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(pivot);
      let minX = 1;
      let maxX = -1;
      let minY = 1;
      let maxY = -1;
      const corner = new THREE.Vector3();
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            corner.set(x, y, z).project(camera);
            minX = Math.min(minX, corner.x);
            maxX = Math.max(maxX, corner.x);
            minY = Math.min(minY, corner.y);
            maxY = Math.max(maxY, corner.y);
          }
        }
      }
      return { minX, maxX, minY, maxY };
    },
    /** 0..1 — seberapa jauh scroll sudah berjalan (untuk putaran idle). */
    setScrollProgress(p) {
      idleWeight = Math.max(0, 1 - p * 9);
    },
    dispose,
  };
}
