import './style.css';
import '@fontsource-variable/fraunces/index.css';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/inter/index.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { createScene } from './scene.js';
import { cameraKeyframes, sectionIds } from './sections.js';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const loader = document.getElementById('loader');
const loaderPct = document.getElementById('loaderPct');
const loaderMsg = document.getElementById('loaderMsg');
const loaderRetry = document.getElementById('loaderRetry');
const scrollHint = document.getElementById('scrollHint');
const backToTop = document.getElementById('backToTop');

if (cameraKeyframes.length !== sectionIds.length) {
  console.warn(
    `[sections] cameraKeyframes (${cameraKeyframes.length}) tidak sama dengan jumlah section (${sectionIds.length}).`,
  );
}

function setProgress(p) {
  loaderPct.textContent = `${Math.round(Math.min(1, Math.max(0, p)) * 100)}%`;
}

function showLoadError(message) {
  loader.classList.add('loader--error');
  loaderMsg.textContent = message;
  loaderPct.textContent = '—';
  loaderRetry.hidden = false;
}

function hideLoader() {
  loader.classList.add('loader--hidden');
}

loaderRetry.addEventListener('click', () => window.location.reload());

function viewFromKeyframe(k) {
  return {
    cx: k.cam[0],
    cy: k.cam[1],
    cz: k.cam[2],
    tx: k.target[0],
    ty: k.target[1],
    tz: k.target[2],
    rotY: k.rotY,
  };
}

async function boot() {
  let scene = null;
  let failed = false;
  try {
    scene = await createScene({
      canvas: document.getElementById('webgl'),
      initial: viewFromKeyframe(cameraKeyframes[0]),
      onProgress: setProgress,
      onError: showLoadError,
    });
  } catch (err) {
    failed = true;
    console.error('[charm] gagal menyiapkan scene:', err);
  }

  // Saat gagal, loader tetap tampil berisi pesan error + tombol muat ulang.
  if (failed) {
    initStory(null);
    return;
  }

  hideLoader();
  initStory(scene);
}

function initStory(scene) {
  // --- Scroll timeline tunggal: kamera + rotasi model -----------------------
  if (scene) {
    if (import.meta.env.DEV) {
      // Hook QA di dev saja (dipakai scripts/shots.mjs untuk verifikasi framing).
      window.__charm = {
        getView: () => ({ ...scene.view }),
        getBounds: () => scene.getScreenBounds(),
      };
    }
    const view = scene.view;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '#story',
        start: 'top top',
        end: 'bottom bottom',
        scrub: reduced ? true : 1,
        onUpdate: (self) => {
          scene.setScrollProgress(self.progress);
          scrollHint.classList.toggle('is-hidden', self.progress > 0.012);
        },
      },
    });

    for (let i = 1; i < cameraKeyframes.length; i++) {
      const k = cameraKeyframes[i];
      tl.to(
        view,
        {
          cx: k.cam[0],
          cy: k.cam[1],
          cz: k.cam[2],
          tx: k.target[0],
          ty: k.target[1],
          tz: k.target[2],
          rotY: k.rotY,
          duration: 1,
        },
        i - 1,
      );
    }
  } else {
    scrollHint.classList.add('is-hidden');
  }

  // --- Progress bar scroll --------------------------------------------------
  gsap.fromTo(
    '#progressBar',
    { scaleX: 0 },
    {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: '#story',
        start: 'top top',
        end: 'bottom bottom',
        scrub: reduced ? true : 0.4,
      },
    },
  );

  // --- Teks tiap section: fade-in + slide-up --------------------------------
  const inners = gsap.utils.toArray('.section-inner');
  if (reduced) {
    gsap.set(inners, { autoAlpha: 1 });
  } else {
    inners.forEach((el) => {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 44 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 82%',
            toggleActions: 'play none none reverse',
          },
        },
      );
    });
  }

  // --- Kembali ke atas -------------------------------------------------------
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

  // Pastikan posisi trigger terbaca penuh setelah font & model siap
  ScrollTrigger.refresh();
}

boot();
