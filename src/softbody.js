import * as THREE from "three";

/**
 * Skin bone-tali di level shader (linear blend skinning 2 bone).
 *
 * Simulasi tali (src/rope.js) menghasilkan N bone: tiap bone punya pusat
 * (posisi node tengah segmen) dan kuarternion arah. Vertex shader:
 *   1. Peta posisi vertex ke ruang tali (uMeshM) → tinggi rest y (0 … −2).
 *   2. Cari 2 bone terdekat (segmentasi sepanjang tali) + bobot.
 *   3. Skinning: v' = (1−f)·(R0·(v−c0_rest) + c0) + f·(R1·(v−c1_rest) + c1)
 * Hasilnya mesh MENGIKUTI KURVA TALI secara kontinu — mesh meja/manik yang
 * melewati batas segmen tidak "patah" karena blend mulus antar bone.
 *
 * Uniform per-mesh: uMeshM (geometry → ruang tali), uMeshInv (kebalikan
 * linernya). Uniform bersama: uBoneQ/uBoneC (hasil simulasi tiap frame).
 */

export const BONE_COUNT = 10;
const REST_LENGTH = 2; // model dinormalisasi setinggi 2 (y 0 … −2 di ruang tali)

const shared = {
  uBoneQ: {
    value: Array.from({ length: BONE_COUNT }, () => new THREE.Vector4(0, 0, 0, 1)),
  },
  uBoneC: {
    value: Array.from({ length: BONE_COUNT }, () => new THREE.Vector3()),
  },
};

function softHook(shader) {
  shader.uniforms.uMeshM = this.userData.soft.uMeshM;
  shader.uniforms.uMeshInv = this.userData.soft.uMeshInv;
  shader.uniforms.uBoneQ = shared.uBoneQ;
  shader.uniforms.uBoneC = shared.uBoneC;

  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
#define BONE_N ${BONE_COUNT}
uniform mat4 uMeshM;
uniform mat3 uMeshInv;
uniform vec4 uBoneQ[BONE_N];
uniform vec3 uBoneC[BONE_N];
vec3 charmQrot(vec4 q, vec3 v) {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
{
  vec3 softQ = (uMeshM * vec4(transformed, 1.0)).xyz;
  float ft = clamp(-softQ.y * ${((BONE_COUNT / REST_LENGTH).toFixed(4))}, 0.0, float(BONE_N));
  int i0 = int(min(floor(ft), float(BONE_N - 1)));
  float f = clamp(ft - float(i0), 0.0, 1.0);
  int i1 = min(i0 + 1, BONE_N - 1);
  float restY0 = -(float(i0) + 0.5) * ${(REST_LENGTH / BONE_COUNT).toFixed(4)};
  float restY1 = -(float(i1) + 0.5) * ${(REST_LENGTH / BONE_COUNT).toFixed(4)};
  vec3 o0 = softQ - vec3(0.0, restY0, 0.0);
  vec3 o1 = softQ - vec3(0.0, restY1, 0.0);
  vec3 sk0 = charmQrot(uBoneQ[i0], o0) + uBoneC[i0];
  vec3 sk1 = charmQrot(uBoneQ[i1], o1) + uBoneC[i1];
  vec3 bent = mix(sk0, sk1, f);
  transformed += uMeshInv * (bent - softQ);
}`,
    );
}

/** Clone material mesh dan pasang hook skinning-nya. */
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

const _invTali = new THREE.Matrix4();
const _m3 = new THREE.Matrix3();

/**
 * @param {THREE.Object3D} root akar gltf.scene (semua mesh)
 * @param {THREE.Object3D} tali grup titik gantung (ruang simulasinya)
 */
export function createSoftBody(root, tali) {
  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    attach(o);
    meshes.push(o);
  });

  return {
    /**
     * Panggil tiap frame SETELAH scene.updateMatrixWorld.
     * @param {Array<{center: THREE.Vector3, quat: THREE.Quaternion}>} bones
     */
    update(bones) {
      for (let i = 0; i < BONE_COUNT; i++) {
        const b = bones[i];
        shared.uBoneQ.value[i].set(b.quat.x, b.quat.y, b.quat.z, b.quat.w);
        shared.uBoneC.value[i].copy(b.center);
      }
      _invTali.copy(tali.matrixWorld).invert();
      for (const m of meshes) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const u = mat.userData.soft;
          if (!u) continue;
          u.uMeshM.value.multiplyMatrices(_invTali, m.matrixWorld);
          _m3.setFromMatrix4(u.uMeshM.value).invert();
          u.uMeshInv.value.copy(_m3);
        }
      }
    },
  };
}
