import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const PAPER_COUNT = 14;
const DUST_COUNT = 220;

// Seeded pseudo-random so texture is deterministic each mount
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; };
}

// Build a canvas-texture that looks like a ruled document page
function makePaperTexture() {
  const w = 210, h = 280;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rng = seeded(7);

  // Page body — warm off-white parchment
  ctx.fillStyle = '#ede8de';
  ctx.fillRect(0, 0, w, h);

  // Header block (title + subtitle)
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(18, 14, w * 0.52, 9);
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.fillRect(18, 28, w * 0.32, 6);

  // Ruled lines
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 0.8;
  for (let y = 50; y < h - 16; y += 19) {
    ctx.beginPath();
    ctx.moveTo(14, y);
    ctx.lineTo(w - 14, y);
    ctx.stroke();
  }

  // Red margin line
  ctx.strokeStyle = 'rgba(170,55,55,0.16)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(42, 10);
  ctx.lineTo(42, h - 10);
  ctx.stroke();

  // Simulated text blocks on each line
  ctx.fillStyle = 'rgba(0,0,0,0.11)';
  for (let y = 50; y < h - 22; y += 19) {
    const len = 60 + rng() * 108;
    ctx.fillRect(48, y - 6, len, 6);
    if (rng() > 0.45) ctx.fillRect(48 + 10 + rng() * 20, y - 6, 15 + rng() * 30, 6);
  }

  // Subtle right-edge page shadow
  const grad = ctx.createLinearGradient(w - 14, 0, w, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.07)');
  ctx.fillStyle = grad;
  ctx.fillRect(w - 14, 0, 14, h);

  return new THREE.CanvasTexture(canvas);
}

export default function ThreeBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    // Renderer — low power, alpha canvas
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,   // prevents dark fringe on transparent alpha
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    // Blend mode:
    //   Dark mode  → screen  : cream papers glow softly on dark backgrounds
    //   Light mode → multiply: dark-tinted papers darken light backgrounds gently
    renderer.domElement.style.mixBlendMode = isDark ? 'screen' : 'multiply';

    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 0, 30);

    const paperTex = makePaperTexture();
    const WORLD_DEPTH = 90;
    const papers = [];
    const rng = seeded(42);

    for (let i = 0; i < PAPER_COUNT; i++) {
      const pw = 2.8 + rng() * 1.8;
      const ph = pw * (280 / 210);
      const geo = new THREE.PlaneGeometry(pw, ph);

      // Dark mode: warm cream at very low opacity so text stays readable
      // Light mode: mid-gray-brown via multiply so papers darken the light bg subtly
      const col = isDark ? 0xe8dfd0 : 0x7a6a58;
      const opacity = isDark
        ? (0.08 + rng() * 0.10)   // 0.08–0.18 — atmospheric, not dominating
        : (0.18 + rng() * 0.18);  // 0.18–0.36 — multiply mode needs more signal

      const mat = new THREE.MeshBasicMaterial({
        map: paperTex,
        color: new THREE.Color(col),
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geo, mat);
      const yFrac = i / PAPER_COUNT;

      mesh.position.set(
        (rng() - 0.5) * 30,
        WORLD_DEPTH * 0.55 - yFrac * WORLD_DEPTH * 1.1,
        -(10 + rng() * 18)
      );
      mesh.rotation.set(
        (rng() - 0.5) * 0.28,
        (rng() - 0.5) * 0.38,
        (rng() - 0.5) * Math.PI * 0.5
      );

      mesh.userData = {
        baseY: mesh.position.y,
        floatAmp: 0.4 + rng() * 0.8,
        floatFreq: 0.18 + rng() * 0.22,
        floatOff: rng() * Math.PI * 2,
        rotDrift: (rng() - 0.5) * 0.00010,
      };

      scene.add(mesh);
      papers.push(mesh);
    }

    // Warm dust motes
    const dustPos = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      dustPos[i * 3 + 0] = (Math.random() - 0.5) * 50;
      dustPos[i * 3 + 1] = WORLD_DEPTH * 0.6 - Math.random() * WORLD_DEPTH * 1.3;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      size: isDark ? 0.07 : 0.05,
      color: isDark ? 0xd4c4a8 : 0x8a7060,
      transparent: true,
      opacity: isDark ? 0.38 : 0.20,
      depthWrite: false,
    });
    scene.add(new THREE.Points(dustGeo, dustMat));

    // Mouse parallax (smooth lerp)
    const mouse = { tx: 0, ty: 0, x: 0, y: 0 };
    const onMouse = (e) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5);
      mouse.ty = -(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('mousemove', onMouse, { passive: true });

    const onResize = () => {
      const W = window.innerWidth, H = window.innerHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    };
    window.addEventListener('resize', onResize, { passive: true });

    let rafId;
    let t = 0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      t += 0.016;

      // Camera follows scroll — world-space descent through the paper field
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const scrollRatio = window.scrollY / maxScroll;
      const targetCamY = scrollRatio * -WORLD_DEPTH * 0.88;
      camera.position.y += (targetCamY - camera.position.y) * 0.04;

      // Mouse X parallax
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      camera.position.x += (mouse.x * 2.5 - camera.position.x) * 0.03;

      for (const p of papers) {
        const { baseY, floatAmp, floatFreq, floatOff, rotDrift } = p.userData;
        p.position.y = baseY + Math.sin(t * floatFreq + floatOff) * floatAmp;
        p.rotation.z += rotDrift;
      }

      renderer.render(scene, camera);
    };

    tick();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
      paperTex.dispose();
      for (const p of papers) { p.geometry.dispose(); p.material.dispose(); }
      dustGeo.dispose();
      dustMat.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ position: 'fixed', inset: 0, zIndex: 40, pointerEvents: 'none' }}
      aria-hidden="true"
    />
  );
}
