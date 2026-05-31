import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const PAPER_COUNT = 14;
const DUST_COUNT = 200;

function seeded(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; };
}

function makePaperTexture(isDark) {
  const w = 210, h = 280;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rng = seeded(7);

  // Page body
  ctx.fillStyle = isDark ? '#e8e0d0' : '#c8bfb0';
  ctx.fillRect(0, 0, w, h);

  // Header block
  ctx.fillStyle = isDark ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.15)';
  ctx.fillRect(18, 14, w * 0.52, 9);
  ctx.fillStyle = isDark ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.10)';
  ctx.fillRect(18, 28, w * 0.32, 6);

  // Ruled lines
  ctx.strokeStyle = isDark ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 0.8;
  for (let y = 50; y < h - 16; y += 19) {
    ctx.beginPath();
    ctx.moveTo(14, y);
    ctx.lineTo(w - 14, y);
    ctx.stroke();
  }

  // Margin line
  ctx.strokeStyle = isDark ? 'rgba(170,55,55,0.16)' : 'rgba(140,40,40,0.22)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(42, 10);
  ctx.lineTo(42, h - 10);
  ctx.stroke();

  // Simulated text
  ctx.fillStyle = isDark ? 'rgba(0,0,0,0.11)' : 'rgba(0,0,0,0.20)';
  for (let y = 50; y < h - 22; y += 19) {
    const len = 60 + rng() * 108;
    ctx.fillRect(48, y - 6, len, 6);
    if (rng() > 0.45) ctx.fillRect(48 + 10 + rng() * 20, y - 6, 15 + rng() * 30, 6);
  }

  // Right edge shadow
  const grad = ctx.createLinearGradient(w - 14, 0, w, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, isDark ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.12)');
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

    // Read theme from localStorage (same source as LandingPage useState).
    // data-theme attribute is set by a parent useEffect that runs AFTER this
    // child effect, so reading the attribute here always returns null (= isDark=true).
    const isDark = (() => {
      try { const s = localStorage.getItem('theme'); if (s) return s === 'dark'; } catch { /* no-op */ }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    // No mix-blend-mode — straight alpha compositing keeps the page visible in all modes
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 0, 30);

    const paperTex = makePaperTexture(isDark);
    const WORLD_DEPTH = 90;
    const papers = [];
    const rng = seeded(42);

    for (let i = 0; i < PAPER_COUNT; i++) {
      const pw = 2.8 + rng() * 1.8;
      const ph = pw * (280 / 210);
      const geo = new THREE.PlaneGeometry(pw, ph);

      // Dark mode: warm cream (barely visible against dark backgrounds)
      // Light mode: medium warm grey — clearly visible against light sections
      const opacity = isDark
        ? (0.06 + rng() * 0.08)   // 0.06–0.14
        : (0.20 + rng() * 0.18);  // 0.20–0.38 — must punch through white

      const mat = new THREE.MeshBasicMaterial({
        map: paperTex,
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

    // Dust motes
    const dustPos = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      dustPos[i * 3 + 0] = (Math.random() - 0.5) * 50;
      dustPos[i * 3 + 1] = WORLD_DEPTH * 0.6 - Math.random() * WORLD_DEPTH * 1.3;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 0.07,
      color: isDark ? 0xd4c4a8 : 0x8a7060,
      transparent: true,
      opacity: isDark ? 0.35 : 0.30,
      depthWrite: false,
    });
    scene.add(new THREE.Points(dustGeo, dustMat));

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

      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const scrollRatio = window.scrollY / maxScroll;
      const targetCamY = scrollRatio * -WORLD_DEPTH * 0.88;
      camera.position.y += (targetCamY - camera.position.y) * 0.04;

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
