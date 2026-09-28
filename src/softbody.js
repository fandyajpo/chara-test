import * as THREE from "three";

/**
 * Lapisan "soft-body" di level shader.
 *
 * Setiap mesh diberi material clone + dua uniform per-mesh:
 *   uMeshM   : matriks geometry → ruang sway (titik gantung charm)
 *   uMeshInv : kebalikan linier uMeshM (untuk mengubah offset balik ke lokal)
 * Plus dua uniform bersama:
 *   uSoftBend : offset lentur di dasar model (dari fisika pegas)
 *   uSoftY    : (tinggi titik gantung, 1/tinggi model) → falloff kuadratik
 *
 * Vertex shader menggeser puncak sebesar uSoftBend * t² (t = jarak dari
 * titik gantung), sehingga bagian bawah tertinggal saat charm mengayun —
 * terlihat seperti benda lunak, bukan benda kaku.
 */

const shared = {
  uSoftBend: { value: new THREE.Vector3() },
  // Titik gantung di y=0 ruang sway, model setinggi 2 satuan → t = -y/2
  uSoftY: { value: new THREE.Vector2(0, 0.5) },
};

function softHook(shader) {
  shader.uniforms.uMeshM = this.userData.soft.uMeshM;
  shader.uniforms.uMeshInv = this.userData.soft.uMeshInv;
  shader.uniforms.uSoftBend = shared.uSoftBend;
  shader.uniforms.uSoftY = shared.uSoftY;

  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
uniform mat4 uMeshM;
uniform mat3 uMeshInv;
uniform vec3 uSoftBend;
uniform vec2 uSoftY;`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
{
  vec3 softQ = (uMeshM * vec4(transformed, 1.0)).xyz;
  float softT = clamp((uSoftY.x - softQ.y) * uSoftY.y, 0.0, 1.0);
  transformed += uMeshInv * (uSoftBend * (softT * softT));
}`,
    );
}

/** Clone material mesh dan pasang hook soft-body-nya. */
function attach(mesh) {
  const src = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const out = src.map((m) => {
    const c = m.clone();
    c.userData.soft = {
      uMeshM: { value: new THREE.Matrix4() },
      uMeshInv: { value: new THREE.Matrix3() },
    };
    c.onBeforeCompile = softHook;
    return c;
  });
  mesh.material = Array.isArray(mesh.material) ? out : out[0];
}

const _invSway = new THREE.Matrix4();
const _m3 = new THREE.Matrix3();

/**
 * @param {THREE.Object3D} root akar gltf.scene (semua mesh)
 * @param {THREE.Object3D} sway grup titik gantung (posisi/rotasi ayun)
 */
export function createSoftBody(root, sway) {
  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    attach(o);
    meshes.push(o);
  });

  return {
    /** Panggil tiap frame SETELAH scene.updateMatrixWorld. */
    update(bendX, bendZ) {
      shared.uSoftBend.value.set(bendX, 0, bendZ);
      _invSway.copy(sway.matrixWorld).invert();
      for (const m of meshes) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const u = mat.userData.soft;
          if (!u) continue;
          u.uMeshM.value.multiplyMatrices(_invSway, m.matrixWorld);
          _m3.setFromMatrix4(u.uMeshM.value).invert();
          u.uMeshInv.value.copy(_m3);
        }
      }
    },
  };
}
