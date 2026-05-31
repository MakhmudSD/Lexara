import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const PAPER_COUNT = 22;
const DUST_COUNT = 280;

// Build a canvas-texture that looks like a ruled document page
function makePaperTexture() {
  const w = 210, h = 280;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Page body — warm off-white
  ctx.fillStyle = '#ede8de';
  ctx.fillRect(0, 0, w, h);

  // Faint top header block (like a document title area)
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(18, 14, w * 0.55, 9);
  ctx.fillRect(18, 28, w * 0.35, 6);

  // Ruled lines
  ctx.strokeStyle = 'rgba(0,0,0,0.09)';
  ctx.lineWidth = 0.8;
  for (let y = 50; y < h - 16; y += 19) {
    ctx.beginPath();
    ctx.moveTo(14, y);
    ctx.lineTo(w - 14, y);
    ctx.stroke();
  }

  // Red margin line
  ctx.strokeStyle = 'rgba(180, 60, 60, 0.14)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(42, 10);
  ctx.lineTo(42, h - 10);
  ctx.stroke();

  // Simulate text: variable-length gray bars on each ruled line
  const rng = (() => { let s = 42; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; }; })();
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  for (let y = 50; y < h - 20; y += 19) {
    const len = 60 + rng() * 110;
    ctx.fillRect(48, y - 6, len, 6.5);
    if (rng() > 0.55) {
      ctx.fillRect(48, y - 6, 20 + rng() * 40, 6.5); // second word group
    }
  }

  // Subtle page-edge shadow on right
  const grad = ctx.createLinearGradient(w - 12, 0, w, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = grad;
  ctx.fillRect(w - 12, 0, 12, h);

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

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    // Blend mode so papers glow over section backgrounds
    renderer.domElement.style.mixBlendMode = isDark ? 'screen' : 'multiply';

    mount.appendChild(renderer.domElement);

    // Scene / camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 0, 30);

    const paperTex = makePaperTexture();

    // Papers — spread across a large vertical world-space range so they
    // cover the full scroll journey (camera Y scrolls downward as user scrolls)
    const WORLD_DEPTH = 90; // world-units from top to bottom of "page"
    const papers = [];

    for (let i = 0; i < PAPER_COUNT; i++) {
      // A4-ish proportions, varied sizes
      const pw = 2.6 + Math.random() * 1.6;
      const ph = pw * (280 / 210);
      const geo = new THREE.PlaneGeometry(pw, ph);

      // In screen blend mode, brighter paper = more visible. Use warm off-white.
      // In multiply mode on light bg, use a cooler mid-tone so papers don't over-darken.
      const col = isDark ? 0xe8e0d0 : 0x9a9080;
      const mat = new THREE.MeshBasicMaterial({
        map: paperTex,
        color: new THREE.Color(col),
        transparent: true,
        opacity: isDark ? (0.18 + Math.random() * 0.22) : (0.09 + Math.random() * 0.10),
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geo, mat);

      // Distribute evenly from top to bottom, with a buffer zone past both ends
      const yFrac = (i / PAPER_COUNT);
      mesh.position.set(
        (Math.random() - 0.5) * 28,                        // left-right spread
        WORLD_DEPTH * 0.55 - yFrac * WORLD_DEPTH * 1.1,   // top → bottom
        -(8 + Math.random() * 16)                           // depth (z behind camera)
      );
      mesh.rotation.set(
        (Math.random() - 0.5) * 0.30,
        (Math.random() - 0.5) * 0.40,
        (Math.random() - 0.5) * Math.PI * 0.45
      );

      mesh.userData = {
        baseY: mesh.position.y,
        floatAmp: 0.5 + Math.random() * 0.9,
        floatFreq: 0.20 + Math.random() * 0.25,
        floatOff: Math.random() * Math.PI * 2,
        rotDrift: (Math.random() - 0.5) * 0.00012,
      };

      scene.add(mesh);
      papers.push(mesh);
    }

    // Dust motes — sparse warm particles
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
      color: isDark ? 0xd4c4a8 : 0x807060,
      transparent: true,
      opacity: isDark ? 0.45 : 0.22,
      depthWrite: false,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);

    // Mouse parallax (smooth interpolation)
    const mouse = { tx: 0, ty: 0, x: 0, y: 0 };
    const onMouse = (e) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5);
      mouse.ty = -(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('mousemove', onMouse, { passive: true });

    // Resize
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

      // Scroll: camera descends through world-space as user scrolls down
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const scrollRatio = window.scrollY / maxScroll;
      const targetCamY = scrollRatio * -WORLD_DEPTH * 0.88;
      camera.position.y += (targetCamY - camera.position.y) * 0.045;

      // Mouse parallax
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      camera.position.x += (mouse.x * 2.5 - camera.position.x) * 0.03;

      // Paper gentle float + slow rotation drift
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
