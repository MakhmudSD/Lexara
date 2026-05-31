import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';
import { LexaraLogo } from '../assets/LexaraLogo';
import { useTranslation } from '../i18n/useTranslation';

gsap.registerPlugin(ScrollTrigger);

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeDocTexture(accentColor, docType, lines) {
  const W = 512, H = 700;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Paper gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(1, '#f4f5f8');
  ctx.fillStyle = bg;
  ctx.roundRect(0, 0, W, H, 18);
  ctx.fill();

  // Drop shadow (inner)
  ctx.shadowColor = 'rgba(0,0,0,0.06)';
  ctx.shadowBlur = 20;

  // Left accent bar
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = accentColor;
  ctx.roundRect(0, 0, 10, H, [18, 0, 0, 18]);
  ctx.fill();

  // Header area
  ctx.fillStyle = accentColor + '18';
  ctx.fillRect(10, 0, W - 10, 72);

  // Doc type badge
  ctx.fillStyle = accentColor;
  ctx.roundRect(W - 80, 18, 60, 26, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(docType, W - 50, 36);

  // Header title lines
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1a1a2e';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(lines[0] || 'Document Title', 28, 42);

  // Paragraph lines
  const lineColors = ['#c8ccd8', '#b8bcc8', '#d0d4de', '#a8acb8', '#c0c4d0'];
  let y = 100;
  for (let i = 0; i < 12; i++) {
    const w = 200 + Math.sin(i * 1.7) * 140 + Math.cos(i * 0.9) * 60;
    ctx.fillStyle = lineColors[i % lineColors.length];
    ctx.roundRect(28, y, Math.min(w, W - 56), 9, 4);
    ctx.fill();
    y += 20;
    if (i === 3 || i === 7) y += 14; // paragraph break
  }

  // Highlight block
  ctx.fillStyle = accentColor + '22';
  ctx.roundRect(28, y + 10, W - 56, 40, 8);
  ctx.fill();
  ctx.fillStyle = accentColor;
  ctx.roundRect(28, y + 10, 4, 40, 2);
  ctx.fill();
  ctx.fillStyle = '#666';
  ctx.font = '12px sans-serif';
  ctx.fillText(lines[1] || 'Key excerpt from document...', 40, y + 35);

  // Page number
  ctx.fillStyle = '#aaa';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('— ' + (lines[2] || '1') + ' —', W / 2, H - 20);

  // Corner fold
  ctx.fillStyle = '#e8eaf0';
  ctx.beginPath();
  ctx.moveTo(W - 36, 0);
  ctx.lineTo(W, 36);
  ctx.lineTo(W, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#cdd1dc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W - 36, 0);
  ctx.lineTo(W, 36);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

const DOC_CONFIG = [
  { accent: '#2356d8', type: 'PDF',  lines: ['Contract Agreement', 'Per clause 14.2, either party may...', '1'] },
  { accent: '#7c3aed', type: 'DOCX', lines: ['Research Report Q4', 'Key findings indicate growth of 23%...', '2'] },
  { accent: '#0891b2', type: 'TXT',  lines: ['Meeting Notes', 'Action items from last session...', '3'] },
  { accent: '#059669', type: 'PDF',  lines: ['Policy Handbook v3', 'Section 4 outlines compliance...', '4'] },
  { accent: '#d97706', type: 'DOCX', lines: ['Financial Summary', 'Q3 revenue exceeded projections...', '5'] },
  { accent: '#dc2626', type: 'PDF',  lines: ['Legal Brief', 'The defendant hereby contests...', '6'] },
  { accent: '#7c3aed', type: 'TXT',  lines: ['User Manual', 'Installation requires Node 18+...', '7'] },
];

// ─── Custom Cursor ─────────────────────────────────────────────────────────────

function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const mouse = useRef({ x: 0, y: 0 });
  const ring = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const dot = dotRef.current;
    const ringEl = ringRef.current;
    if (!dot || !ringEl) return;

    const onMove = (e) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      gsap.to(dot, { x: e.clientX, y: e.clientY, duration: 0, overwrite: true });
    };

    const onEnterBtn = () => gsap.to(ringEl, { width: 60, height: 60, duration: 0.2 });
    const onLeaveBtn = () => gsap.to(ringEl, { width: 36, height: 36, duration: 0.2 });

    let raf;
    const loop = () => {
      ring.current.x += (mouse.current.x - ring.current.x) * 0.12;
      ring.current.y += (mouse.current.y - ring.current.y) * 0.12;
      gsap.set(ringEl, { x: ring.current.x, y: ring.current.y });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    window.addEventListener('mousemove', onMove);
    document.querySelectorAll('button, a, [role=button]').forEach((el) => {
      el.addEventListener('mouseenter', onEnterBtn);
      el.addEventListener('mouseleave', onLeaveBtn);
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} style={{
        position: 'fixed', top: 0, left: 0, width: 10, height: 10,
        borderRadius: '50%', background: '#fff',
        mixBlendMode: 'difference', pointerEvents: 'none',
        zIndex: 9999, transform: 'translate(-50%, -50%)',
      }} />
      <div ref={ringRef} style={{
        position: 'fixed', top: 0, left: 0, width: 36, height: 36,
        borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.6)',
        mixBlendMode: 'difference', pointerEvents: 'none',
        zIndex: 9998, transform: 'translate(-50%, -50%)',
      }} />
    </>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', background: 'none', border: 'none',
          color: '#e8eaf6', padding: '20px 0', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 15, fontFamily: 'inherit', textAlign: 'left', gap: 16,
        }}
      >
        <span>{question}</span>
        <span style={{ fontSize: 20, opacity: 0.6, flexShrink: 0 }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <p style={{ color: 'rgba(200,204,230,0.75)', fontSize: 14, lineHeight: 1.7, paddingBottom: 20, margin: 0 }}>
          {answer}
        </p>
      )}
    </div>
  );
}

// ─── Pricing Modal ────────────────────────────────────────────────────────────

function PricingModal({ plan, onClose, onSignUp, onSignIn }) {
  const dialogRef = useRef(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { dialogRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isFree = plan === 'Free';
  const desc = isFree
    ? 'Create a free account — 100 queries/month, 1 workspace, 5 documents. No credit card required.'
    : plan === 'Pro'
    ? 'Get 1,000 queries/month and 5 workspaces for $19/mo. Billed monthly via Paddle.'
    : 'Get 5,000 queries/month and unlimited workspaces for $49/mo. Billed monthly via Paddle.';

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(8px)',
    }}>
      <div ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} style={{
        background: 'rgba(15,17,35,0.95)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20, padding: '40px 36px', maxWidth: 420, width: '90%',
        outline: 'none',
      }}>
        <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 16 }}>✦</div>
        <h3 style={{ color: '#e8eaf6', fontSize: 22, fontWeight: 700, textAlign: 'center', margin: '0 0 12px' }}>
          {isFree ? 'Start for free' : `Upgrade to ${plan}`}
        </h3>
        <p style={{ color: 'rgba(200,204,230,0.75)', fontSize: 14, textAlign: 'center', lineHeight: 1.6, margin: '0 0 24px' }}>{desc}</p>
        <button onClick={() => { sessionStorage.setItem('intended_plan', plan.toLowerCase()); setLoading(true); onClose(); onSignUp(); }}
          disabled={loading} style={{
            width: '100%', padding: '14px', background: 'linear-gradient(135deg, #2356d8, #7c3aed)',
            border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', marginBottom: 10,
          }}>
          {loading ? '…' : isFree ? 'Create free account →' : 'Create account to upgrade →'}
        </button>
        <button onClick={() => { onClose(); onSignIn(); }} style={{
          width: '100%', padding: '12px', background: 'transparent',
          border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12,
          color: 'rgba(200,204,230,0.8)', fontSize: 14, cursor: 'pointer',
        }}>
          Sign in to existing account
        </button>
        <p style={{ color: 'rgba(200,204,230,0.4)', fontSize: 12, textAlign: 'center', margin: '16px 0 0' }}>
          {isFree ? 'No credit card · Your data stays private' : 'Email support@lexara.app to cancel'}
        </p>
      </div>
    </div>
  );
}

// ─── Three.js Scene ───────────────────────────────────────────────────────────

function ThreeScene({ scrollY, heroRef }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060608, 0.018);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 10);

    // ── Particles ──
    const pCount = 3000;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    const pCol = new Float32Array(pCount * 3);
    const palette = [
      [0.14, 0.34, 0.85], // indigo
      [0.49, 0.23, 0.93], // violet
      [0.03, 0.57, 0.70], // cyan
      [0.06, 0.59, 0.41], // teal
    ];
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3]     = (Math.random() - 0.5) * 60;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      const c = palette[Math.floor(Math.random() * palette.length)];
      pCol[i * 3] = c[0]; pCol[i * 3 + 1] = c[1]; pCol[i * 3 + 2] = c[2];
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.045, vertexColors: true,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8,
    });
    scene.add(new THREE.Points(pGeo, pMat));

    // ── Document planes ──
    const docGroup = new THREE.Group();
    scene.add(docGroup);
    const docs = [];
    const orbitRadius = 6;

    DOC_CONFIG.forEach((cfg, i) => {
      const geo = new THREE.PlaneGeometry(4, 5.5);
      const tex = makeDocTexture(cfg.accent, cfg.type, cfg.lines);
      const mat = new THREE.MeshStandardMaterial({
        map: tex, transparent: true, opacity: 0,
        side: THREE.DoubleSide, roughness: 0.4, metalness: 0.05,
      });
      const mesh = new THREE.Mesh(geo, mat);

      // Final orbital positions
      const angle = (i / DOC_CONFIG.length) * Math.PI * 2;
      const finalX = Math.cos(angle) * orbitRadius * 0.9;
      const finalY = Math.sin(angle) * 2.5;
      const finalZ = Math.sin(angle) * orbitRadius * 0.5 - 2;

      // Start far back
      mesh.position.set(
        finalX + (Math.random() - 0.5) * 8,
        finalY + (Math.random() - 0.5) * 6,
        -28 - Math.random() * 12
      );
      mesh.rotation.y = angle + Math.PI * 0.1;
      mesh.userData = { finalX, finalY, finalZ, angle, i, baseRotY: angle + Math.PI * 0.1 };
      docGroup.add(mesh);
      docs.push(mesh);
    });

    // ── Fly-in animation ──
    docs.forEach((mesh, i) => {
      const { finalX, finalY, finalZ, baseRotY } = mesh.userData;
      gsap.to(mesh.position, {
        x: finalX, y: finalY, z: finalZ,
        duration: 1.6, ease: 'expo.out',
        delay: 0.4 + i * 0.12,
      });
      gsap.to(mesh.material, {
        opacity: 0.92,
        duration: 0.8, ease: 'power2.out',
        delay: 0.4 + i * 0.12,
      });
      gsap.to(mesh.rotation, {
        y: baseRotY,
        duration: 1.6, ease: 'expo.out',
        delay: 0.4 + i * 0.12,
      });
    });

    // ── Orbiting lights ──
    const lights = [
      { color: 0x4466ff, intensity: 3, r: 8, speed: 0.4, phase: 0 },
      { color: 0x9933ff, intensity: 2.5, r: 6, speed: 0.5, phase: Math.PI * 0.66 },
      { color: 0x00ccdd, intensity: 2, r: 7, speed: 0.3, phase: Math.PI * 1.33 },
    ];
    const pointLights = lights.map((l) => {
      const pl = new THREE.PointLight(l.color, l.intensity, 20);
      scene.add(pl);
      return { pl, ...l };
    });
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    // ── Mouse tracking ──
    const mouse = { x: 0, y: 0 };
    const camTarget = { x: 0, y: 0 };

    const onMouseMove = (e) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;

      // Per-doc proximity tilt
      docs.forEach((mesh) => {
        const screenX = (mesh.position.x / 10 + 0.5) * window.innerWidth;
        const screenY = (-mesh.position.y / 6 + 0.5) * window.innerHeight;
        const dx = e.clientX - screenX;
        const dy = e.clientY - screenY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 300) {
          const strength = (1 - dist / 300) * 0.4;
          gsap.to(mesh.rotation, {
            x: (dy / 300) * strength,
            duration: 0.3, overwrite: 'auto',
          });
        }
      });
    };
    window.addEventListener('mousemove', onMouseMove);

    // ── Resize ──
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // ── Animate loop ──
    let t = 0;
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      t += 0.008;

      // Camera parallax
      camTarget.x += (mouse.x * 3 - camTarget.x) * 0.05;
      camTarget.y += (mouse.y * 2 - camTarget.y) * 0.05;
      camera.position.x = camTarget.x;
      camera.position.y = camTarget.y;
      camera.lookAt(0, 0, 0);

      // Group subtle mouse rotation
      docGroup.rotation.y = mouse.x * 0.12;
      docGroup.rotation.x = mouse.y * 0.06;

      // Orbital lights
      pointLights.forEach(({ pl, r, speed, phase }) => {
        pl.position.x = Math.cos(t * speed + phase) * r;
        pl.position.y = Math.sin(t * speed * 0.7 + phase) * 3;
        pl.position.z = Math.sin(t * speed + phase) * r * 0.5;
      });

      // Doc bob + scroll spread
      const scrollFrac = (scrollY.current || 0) / Math.max(window.innerHeight, 1);
      docs.forEach((mesh, i) => {
        const { finalX, finalY, finalZ, angle } = mesh.userData;
        mesh.position.x = finalX + Math.sin(t * 0.4 + i) * 0.18 + scrollFrac * Math.cos(angle) * 4;
        mesh.position.y = finalY + Math.cos(t * 0.35 + i * 0.7) * 0.22 + scrollFrac * Math.sin(angle) * 2;
        mesh.material.opacity = Math.max(0, 0.92 - scrollFrac * 1.4);
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      docs.forEach((m) => { m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose(); });
      pGeo.dispose(); pMat.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      zIndex: 0, pointerEvents: 'none',
    }} />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LandingPage3D({ onSignIn, onSignUp, onPrivacy, onTerms }) {
  const { t, lang, setLang, languageOptions } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [pricingModal, setPricingModal] = useState(null);
  const scrollY = useRef(0);
  const heroRef = useRef(null);
  const heroTextRef = useRef(null);
  const featuresSectionRef = useRef(null);
  const featureCardsRef = useRef(null);
  const pricingRef = useRef(null);
  const faqRef = useRef(null);
  const featuresScrollRef = useRef(null);
  const lenisRef = useRef(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored) return stored === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
    lenisRef.current = lenis;

    lenis.on('scroll', ({ scroll }) => {
      scrollY.current = scroll;
      setScrolled(scroll > 80);
      ScrollTrigger.update();
    });

    const tick = (time) => {
      lenis.raf(time);
      gsap.ticker.tick(time / 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  // Body overflow
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Hero text stagger in
  useEffect(() => {
    const container = heroTextRef.current;
    if (!container || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = container.querySelectorAll('[data-anim]');
    const ctx = gsap.context(() => {
      gsap.from(els, {
        y: 40, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.12, delay: 0.5,
      });
    });
    return () => ctx.revert();
  }, []);

  // Feature cards
  useEffect(() => {
    const el = featureCardsRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = el.querySelectorAll('[data-feature-card]');
    const ctx = gsap.context(() => {
      gsap.from(cards, {
        y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.1,
        scrollTrigger: { trigger: el, start: 'top 78%', toggleActions: 'play none none none' },
      });
    });
    return () => ctx.revert();
  }, []);

  // Pricing
  useEffect(() => {
    const el = pricingRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = el.querySelectorAll('[data-pricing-card]');
    const ctx = gsap.context(() => {
      gsap.from(cards, {
        y: 48, opacity: 0, rotateX: 8, transformPerspective: 800,
        duration: 0.65, ease: 'power3.out', stagger: 0.12,
        scrollTrigger: { trigger: el, start: 'top 80%', toggleActions: 'play none none none' },
      });
    });
    return () => ctx.revert();
  }, []);

  // FAQ
  useEffect(() => {
    const el = faqRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const items = el.querySelectorAll('[data-faq-item]');
    const ctx = gsap.context(() => {
      gsap.from(items, {
        x: -24, opacity: 0, duration: 0.5, ease: 'power2.out', stagger: 0.08,
        scrollTrigger: { trigger: el, start: 'top 82%', toggleActions: 'play none none none' },
      });
    });
    return () => ctx.revert();
  }, []);

  // Horizontal feature cards pin
  useEffect(() => {
    const el = featuresScrollRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const inner = el.querySelector('[data-features-inner]');
    if (!inner) return;
    const ctx = gsap.context(() => {
      gsap.to(inner, {
        x: () => -(inner.scrollWidth - el.offsetWidth),
        ease: 'none',
        scrollTrigger: {
          trigger: el, start: 'top top', end: () => '+=' + inner.scrollWidth,
          scrub: 1, pin: true, anticipatePin: 1,
        },
      });
    });
    return () => ctx.revert();
  }, []);

  const scrollTo = (e, id) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (target) lenisRef.current?.scrollTo(target, { offset: -80 });
  };

  const featureCards = [
    { num: '01', title: 'Upload. Instantly indexed.', body: 'PDF, DOCX, TXT parsing with chunking and local embeddings.', detail: 'Optimized for fast first-query time.' },
    { num: '02', title: 'Ask anything, naturally.', body: 'Grounded responses with references and retrieval fallback mode.', detail: 'Low-latency streaming responses.' },
    { num: '03', title: 'Conversations, not sessions.', body: 'Context-aware answers with short memory for continuity.', detail: 'Built for multi-turn work.' },
    { num: '04', title: 'Every token accounted for.', body: 'Track model usage, token counts, cost, and latency.', detail: 'Admin visibility for production ops.' },
  ];

  const pricingPlans = [
    { key: 'free', name: t('pricing_plan_free') || 'Free', price: '$0', feats: [t('pricing_feat_free_1') || '100 queries/month', t('pricing_feat_free_2') || '1 workspace', t('pricing_feat_free_3') || '5 documents'], cta: t('pricing_cta_free') || 'Try free', active: false },
    { key: 'pro',  name: t('pricing_plan_pro')  || 'Pro',  price: '$19/mo', feats: [t('pricing_feat_pro_1') || '1,000 queries/month', t('pricing_feat_pro_2') || '5 workspaces', t('pricing_feat_pro_3') || 'Usage analytics'], cta: t('pricing_cta_pro') || 'Choose Pro', active: true },
    { key: 'biz',  name: t('pricing_plan_business') || 'Business', price: '$49/mo', feats: [t('pricing_feat_biz_1') || '5,000 queries/month', t('pricing_feat_biz_2') || 'Unlimited workspaces*', t('pricing_feat_biz_3') || 'Priority support'], cta: t('pricing_cta_business') || 'Choose Business', active: false },
  ];

  const s = styles; // alias

  return (
    <div style={s.root}>
      <CustomCursor />
      <ThreeScene scrollY={scrollY} heroRef={heroRef} />

      {/* ── Nav ── */}
      <nav style={{ ...s.nav, ...(scrolled ? s.navScrolled : {}) }}>
        <div style={s.navInner}>
          <div style={s.navLogo}>
            <LexaraLogo height={30} style={{ color: '#fff' }} textColor="#fff" />
            <span style={s.navPulse} />
          </div>
          <div style={s.navLinks}>
            {[['features', t('landing_nav_features') || 'Features'], ['pricing', t('landing_nav_pricing') || 'Pricing'], ['faq', t('landing_nav_faq') || 'FAQ']].map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={(e) => scrollTo(e, id)} style={s.navLink}>{label}</a>
            ))}
          </div>
          <div style={s.navRight}>
            <button onClick={onSignIn} style={s.navGhostBtn}>{t('landing_cta_secondary') || 'Sign in'}</button>
            <select value={lang} onChange={(e) => setLang(e.target.value)} style={s.langSelect}>
              {languageOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.flag} {o.code.toUpperCase()}</option>
              ))}
            </select>
            <button onClick={() => setDarkMode(!darkMode)} style={s.iconBtn} aria-label="Toggle theme">
              {darkMode ? '☀' : '☾'}
            </button>
            <button onClick={onSignUp} style={s.navCta}>{t('landing_cta_primary') || 'Start free'}</button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section ref={heroRef} style={s.hero}>
        <div ref={heroTextRef} style={s.heroText}>
          <div data-anim style={s.heroBadge}>{t('landing_hero_badge') || 'Early access · 100 free queries'}</div>
          <h1 data-anim style={s.heroH1}>{t('landing_headline') || 'Your documents,\nanswering questions'}</h1>
          <p data-anim style={s.heroSub}>{t('landing_subhead') || 'Upload PDFs, DOCX, or TXT files and ask questions in plain language. Grounded, cited answers in seconds.'}</p>
          <div data-anim style={s.heroCtas}>
            <button onClick={onSignUp} style={s.ctaPrimary}>{t('landing_cta_primary') || 'Start free →'}</button>
            <button onClick={onSignIn} style={s.ctaGhost}>{t('landing_cta_secondary') || 'Sign in'}</button>
          </div>
          <div data-anim style={s.trustRow}>
            {['🔒 Private', '⚡ Fast', '📄 Cited sources'].map((chip) => (
              <span key={chip} style={s.trustChip}>{chip}</span>
            ))}
          </div>
        </div>
        {/* Scroll hint */}
        <div style={s.scrollHint}>
          <div style={s.scrollDot} />
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={s.statsSection}>
        <div style={s.statsInner}>
          {[['1,200+', t('stat_docs_label') || 'documents indexed'], ['50,000+', t('stat_queries_label') || 'queries answered'], ['99%', t('stat_uptime_label') || 'uptime']].map(([val, lbl]) => (
            <div key={lbl} style={s.stat}>
              <span style={s.statNum}>{val}</span>
              <span style={s.statLbl}>{lbl}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features (horizontal scroll) ── */}
      <section id="features" style={s.featuresPin} ref={featuresScrollRef}>
        <div data-features-inner style={s.featuresInner}>
          <div style={s.featuresHeader}>
            <h2 style={s.sectionTitle}>{t('landing_features_title') || 'Features'}</h2>
            <p style={s.sectionSub}>Built for deep document work</p>
          </div>
          <div ref={featureCardsRef} style={s.featureCards}>
            {featureCards.map((card) => (
              <div key={card.num} data-feature-card style={s.featureCard}>
                <div style={s.featureNum}>{card.num}</div>
                <h3 style={s.featureTitle}>{card.title}</h3>
                <p style={s.featureBody}>{card.body}</p>
                <div style={s.featureDetail}>{card.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo mockup ── */}
      <section style={s.demoSection}>
        <div style={s.demoWindow}>
          <div style={s.demoTitlebar}>
            <span style={{ ...s.demoDot, background: '#ff5f57' }} />
            <span style={{ ...s.demoDot, background: '#febc2e' }} />
            <span style={{ ...s.demoDot, background: '#28c840' }} />
            <span style={{ marginLeft: 8, fontSize: 12, color: 'rgba(200,204,230,0.5)' }}>Lexara</span>
          </div>
          <div style={s.demoBody}>
            <div style={s.demoUser}>{t('demo_question') || 'What are the termination conditions?'}</div>
            <div style={s.demoAssistant}>
              <p style={{ margin: '0 0 10px' }}>{t('demo_answer') || 'Per clause 14.2, either party may terminate this agreement with 30 days written notice.'}</p>
              <div style={s.demoSources}>
                {['contract.pdf · clause 14.2', 'contract.pdf · clause 14.3'].map((src) => (
                  <span key={src} style={s.demoSource}>📄 {src}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={s.demoInput}>
            <span style={{ opacity: 0.4, fontSize: 13 }}>{t('input_placeholder_ready') || 'Ask about your documents…'}</span>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={s.pricingSection} ref={pricingRef}>
        <div style={s.sectionInner}>
          <h2 style={{ ...s.sectionTitle, textAlign: 'center', marginBottom: 12 }}>{t('landing_pricing_title') || 'Pricing'}</h2>
          <p style={{ ...s.sectionSub, textAlign: 'center', marginBottom: 48 }}>Start free, scale when ready</p>
          <div style={s.pricingGrid}>
            {pricingPlans.map(({ key, name, price, feats, cta, active }) => (
              <div key={key} data-pricing-card style={{ ...s.pricingCard, ...(active ? s.pricingCardPro : {}) }}>
                {active && <div style={s.proBadge}>Most popular</div>}
                <h3 style={s.pricingName}>{name}</h3>
                <div style={s.pricingPrice}>{price}</div>
                <ul style={s.pricingFeats}>
                  {feats.map((f, i) => (
                    <li key={i} style={s.pricingFeat}>✓ {f}</li>
                  ))}
                </ul>
                <button onClick={() => setPricingModal(name)} style={{ ...s.pricingBtn, ...(active ? s.pricingBtnActive : {}) }}>{cta}</button>
              </div>
            ))}
          </div>
          <p style={s.pricingNote}>{t('landing_pricing_note') || 'Billed monthly via Paddle · Email support to cancel'}</p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={s.faqSection}>
        <div style={s.sectionInner}>
          <h2 style={{ ...s.sectionTitle, marginBottom: 40 }}>{t('faq_title') || 'Frequently Asked Questions'}</h2>
          <div ref={faqRef} style={{ maxWidth: 680 }}>
            {[
              { q: t('faq_q1') || 'How fast is document indexing?', a: t('faq_a1') || 'Most PDFs and DOCX files are searchable within seconds of upload.' },
              { q: t('faq_q2') || 'Can I use Lexara without a credit card?', a: t('faq_a2') || 'Yes. The Free plan requires no payment.' },
              { q: t('faq_q3') || 'Does it support multilingual documents?', a: t('faq_a3') || 'Yes. Upload in any language and ask in English, Uzbek, Russian, Korean, or Japanese.' },
              { q: t('faq_q4') || 'Are my documents private?', a: t('faq_a4') || 'Your documents are stored in isolated workspaces and never used to train models.' },
              { q: t('faq_q5') || 'What file formats are supported?', a: t('faq_a5') || 'PDF, DOCX, and TXT files up to 50MB.' },
              { q: t('faq_q6') || 'Can I cancel anytime?', a: t('faq_a6') || 'Yes. Email support@lexara.app to cancel.' },
            ].map((item, i) => (
              <div key={i} data-faq-item>
                <FAQItem question={item.q} answer={item.a} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={s.ctaBanner}>
        <div style={s.ctaBannerInner}>
          <h3 style={s.ctaBannerH}>{t('landing_cta_headline') || 'Ready to make documents answerable?'}</h3>
          <button onClick={onSignUp} style={s.ctaPrimaryLg}>{t('landing_cta_start') || 'Start with Lexara →'}</button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <LexaraLogo height={28} textColor="rgba(200,204,230,0.7)" />
          <div style={s.footerLinks}>
            © {new Date().getFullYear()} ·&nbsp;
            <button onClick={onPrivacy} style={s.footerLink}>{t('landing_footer_privacy') || 'Privacy'}</button>
            &nbsp;·&nbsp;
            <button onClick={onTerms} style={s.footerLink}>{t('landing_footer_terms') || 'Terms'}</button>
          </div>
        </div>
      </footer>

      {pricingModal && (
        <PricingModal plan={pricingModal} onClose={() => setPricingModal(null)} onSignUp={onSignUp} onSignIn={onSignIn} />
      )}
    </div>
  );
}

// ─── Inline styles ─────────────────────────────────────────────────────────────

const styles = {
  root: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #06060c 0%, #0c0e1e 40%, #080c18 100%)',
    color: '#e8eaf6',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    position: 'relative',
    overflowX: 'hidden',
  },
  nav: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    transition: 'background 0.3s, backdrop-filter 0.3s, border-color 0.3s',
    borderBottom: '1px solid transparent',
  },
  navScrolled: {
    background: 'rgba(6,6,18,0.75)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  navInner: {
    maxWidth: 1200, margin: '0 auto', padding: '0 24px',
    height: 64, display: 'flex', alignItems: 'center', gap: 32,
  },
  navLogo: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  navPulse: {
    width: 8, height: 8, borderRadius: '50%', background: '#4ade80',
    boxShadow: '0 0 8px #4ade80', animation: 'pulse 2s infinite',
  },
  navLinks: { display: 'flex', gap: 28, flex: 1 },
  navLink: {
    color: 'rgba(200,204,230,0.7)', textDecoration: 'none', fontSize: 14,
    fontWeight: 500, transition: 'color 0.2s',
  },
  navRight: { display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' },
  navGhostBtn: {
    background: 'none', border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(200,204,230,0.8)', padding: '7px 16px', borderRadius: 8,
    fontSize: 13, cursor: 'pointer',
  },
  navCta: {
    background: 'linear-gradient(135deg, #2356d8 0%, #7c3aed 100%)',
    border: 'none', color: '#fff', padding: '8px 18px',
    borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  langSelect: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(200,204,230,0.8)', padding: '6px 10px', borderRadius: 7,
    fontSize: 12, cursor: 'pointer',
  },
  iconBtn: {
    background: 'none', border: 'none', color: 'rgba(200,204,230,0.6)',
    cursor: 'pointer', fontSize: 16, padding: '4px 6px',
  },
  hero: {
    position: 'relative', zIndex: 1,
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    padding: '120px 24px 80px',
  },
  heroText: { maxWidth: 680, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 },
  heroBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '6px 16px', borderRadius: 100,
    background: 'rgba(35,86,216,0.18)', border: '1px solid rgba(35,86,216,0.35)',
    color: '#93b4ff', fontSize: 13, fontWeight: 500,
  },
  heroH1: {
    fontSize: 'clamp(38px, 6vw, 72px)', fontWeight: 800, lineHeight: 1.12,
    letterSpacing: '-0.03em', margin: 0,
    background: 'linear-gradient(135deg, #ffffff 30%, #a5b4fc 70%, #818cf8 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    backgroundClip: 'text', whiteSpace: 'pre-line',
  },
  heroSub: {
    fontSize: 17, color: 'rgba(200,204,230,0.72)', lineHeight: 1.7,
    margin: 0, maxWidth: 520,
  },
  heroCtas: { display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' },
  ctaPrimary: {
    padding: '14px 32px', borderRadius: 12,
    background: 'linear-gradient(135deg, #2356d8 0%, #7c3aed 100%)',
    border: 'none', color: '#fff', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', boxShadow: '0 0 32px rgba(35,86,216,0.4)',
  },
  ctaGhost: {
    padding: '14px 28px', borderRadius: 12,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(200,204,230,0.85)', fontSize: 15, cursor: 'pointer',
  },
  trustRow: { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  trustChip: {
    padding: '5px 14px', borderRadius: 100,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    fontSize: 12, color: 'rgba(200,204,230,0.65)',
  },
  scrollHint: {
    position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
    width: 22, height: 36, borderRadius: 11,
    border: '2px solid rgba(255,255,255,0.2)',
    display: 'flex', justifyContent: 'center', paddingTop: 6,
  },
  scrollDot: {
    width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.5)',
    animation: 'scrollBounce 1.8s ease-in-out infinite',
  },
  statsSection: {
    position: 'relative', zIndex: 1,
    borderTop: '1px solid rgba(255,255,255,0.05)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    background: 'rgba(255,255,255,0.02)',
    padding: '48px 24px',
  },
  statsInner: {
    maxWidth: 800, margin: '0 auto',
    display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 32,
  },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  statNum: {
    fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em',
    background: 'linear-gradient(135deg, #a5b4fc, #7c3aed)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  },
  statLbl: { fontSize: 13, color: 'rgba(200,204,230,0.55)' },
  featuresPin: {
    position: 'relative', zIndex: 1,
    height: '100vh', overflow: 'hidden',
  },
  featuresInner: {
    display: 'flex', alignItems: 'center',
    height: '100vh', paddingLeft: '5vw', gap: 60,
    width: 'max-content',
  },
  featuresHeader: { flexShrink: 0, width: 280 },
  sectionTitle: { fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.02em', color: '#e8eaf6', margin: 0 },
  sectionSub: { fontSize: 15, color: 'rgba(200,204,230,0.55)', marginTop: 12 },
  featureCards: { display: 'flex', gap: 24 },
  featureCard: {
    width: 280, flexShrink: 0, padding: '32px 28px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    backdropFilter: 'blur(12px)',
  },
  featureNum: { fontSize: 11, fontWeight: 700, color: '#7c3aed', letterSpacing: '0.1em', marginBottom: 16 },
  featureTitle: { fontSize: 18, fontWeight: 700, color: '#e8eaf6', margin: '0 0 10px' },
  featureBody: { fontSize: 14, color: 'rgba(200,204,230,0.7)', lineHeight: 1.6, margin: '0 0 16px' },
  featureDetail: {
    fontSize: 12, color: 'rgba(200,204,230,0.45)',
    paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)',
  },
  demoSection: {
    position: 'relative', zIndex: 1,
    display: 'flex', justifyContent: 'center', padding: '80px 24px',
  },
  demoWindow: {
    width: '100%', maxWidth: 640,
    background: 'rgba(15,17,35,0.8)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16, overflow: 'hidden',
    backdropFilter: 'blur(20px)',
  },
  demoTitlebar: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: 'rgba(255,255,255,0.03)',
  },
  demoDot: { width: 11, height: 11, borderRadius: '50%' },
  demoBody: { padding: '20px 20px 12px' },
  demoUser: {
    background: 'rgba(35,86,216,0.18)', border: '1px solid rgba(35,86,216,0.2)',
    borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#93b4ff',
    marginBottom: 14, display: 'inline-block',
  },
  demoAssistant: {
    background: 'rgba(255,255,255,0.04)', borderRadius: 10,
    padding: '14px 16px', fontSize: 14, color: 'rgba(200,204,230,0.85)',
    lineHeight: 1.65,
  },
  demoSources: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 },
  demoSource: {
    fontSize: 11, color: 'rgba(200,204,230,0.5)',
    padding: '3px 10px', borderRadius: 6,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
  },
  demoInput: {
    padding: '12px 20px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', alignItems: 'center',
    color: 'rgba(200,204,230,0.4)', fontSize: 13,
  },
  pricingSection: {
    position: 'relative', zIndex: 1,
    padding: '100px 24px',
    background: 'rgba(255,255,255,0.01)',
  },
  sectionInner: { maxWidth: 1100, margin: '0 auto' },
  pricingGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 24, maxWidth: 900, margin: '0 auto',
  },
  pricingCard: {
    padding: '36px 28px', borderRadius: 20,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    position: 'relative', overflow: 'hidden',
  },
  pricingCardPro: {
    background: 'rgba(35,86,216,0.12)',
    border: '1px solid rgba(35,86,216,0.35)',
    boxShadow: '0 0 60px rgba(35,86,216,0.15)',
  },
  proBadge: {
    position: 'absolute', top: 16, right: 16,
    background: 'linear-gradient(135deg, #2356d8, #7c3aed)',
    color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100,
  },
  pricingName: { fontSize: 18, fontWeight: 700, color: '#e8eaf6', margin: '0 0 8px' },
  pricingPrice: { fontSize: 36, fontWeight: 800, color: '#fff', margin: '0 0 24px', letterSpacing: '-0.02em' },
  pricingFeats: { listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10 },
  pricingFeat: { fontSize: 14, color: 'rgba(200,204,230,0.75)' },
  pricingBtn: {
    width: '100%', padding: '12px', borderRadius: 10,
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
    color: '#e8eaf6', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  pricingBtnActive: {
    background: 'linear-gradient(135deg, #2356d8, #7c3aed)',
    border: 'none', boxShadow: '0 4px 20px rgba(35,86,216,0.4)',
  },
  pricingNote: { textAlign: 'center', fontSize: 12, color: 'rgba(200,204,230,0.35)', marginTop: 24 },
  faqSection: { position: 'relative', zIndex: 1, padding: '80px 24px 100px' },
  ctaBanner: {
    position: 'relative', zIndex: 1,
    background: 'linear-gradient(135deg, rgba(35,86,216,0.2) 0%, rgba(124,58,237,0.2) 100%)',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    padding: '80px 24px',
  },
  ctaBannerInner: { maxWidth: 600, margin: '0 auto', textAlign: 'center' },
  ctaBannerH: { fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 800, color: '#e8eaf6', margin: '0 0 28px', letterSpacing: '-0.02em' },
  ctaPrimaryLg: {
    padding: '16px 40px', borderRadius: 14,
    background: 'linear-gradient(135deg, #2356d8, #7c3aed)',
    border: 'none', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 0 40px rgba(35,86,216,0.5)',
  },
  footer: {
    position: 'relative', zIndex: 1,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    padding: '32px 24px',
  },
  footerInner: {
    maxWidth: 1100, margin: '0 auto',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
  },
  footerLinks: { fontSize: 13, color: 'rgba(200,204,230,0.45)', display: 'flex', alignItems: 'center', gap: 4 },
  footerLink: {
    background: 'none', border: 'none', color: 'rgba(200,204,230,0.55)',
    cursor: 'pointer', fontSize: 13, padding: 0,
  },
};
