import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LexaraLogo } from '../assets/LexaraLogo';
import { useTranslation } from '../i18n/useTranslation';
import ThreeBackground from '../components/ThreeBackground';
import '../styles/LandingPage.css';

gsap.registerPlugin(ScrollTrigger);

function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? 'open' : ''}`}>
      <button
        className="faq-question"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{question}</span>
        <span className="faq-chevron">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="faq-answer">
          {answer}
        </div>
      )}
    </div>
  );
}


function TiltCard({ children, maxDeg = 8, className = '', style = {} }) {
  const ref = useRef(null);
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const onMouseMove = useCallback((e) => {
    if (prefersReducedMotion.current) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    // GSAP for smooth interpolated tilt
    gsap.to(el, {
      rotateY: x * maxDeg * 2,
      rotateX: -y * maxDeg * 2,
      transformPerspective: 1200,
      z: 6,
      duration: 0.18,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }, [maxDeg]);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    gsap.to(el, {
      rotateY: 0,
      rotateX: 0,
      z: 0,
      duration: 0.45,
      ease: 'power3.out',
      overwrite: 'auto',
    });
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}

function FloatingDocs({ heroRef }) {
  const wrapRef = useRef(null);
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || prefersReducedMotion.current) return;
    const cards = Array.from(wrap.querySelectorAll('.floating-doc-card'));
    if (!cards.length) return;

    const tl = gsap.timeline({ delay: 0.3 });
    cards.forEach((card, i) => {
      tl.fromTo(card, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, i * 0.12);
    });

    const bobs = cards.map((card, i) =>
      gsap.to(card, {
        y: i % 2 === 0 ? -8 : -12,
        duration: 2.8 + i * 0.4,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: i * 0.5,
      })
    );

    const onMouseMove = (e) => {
      const hero = heroRef?.current;
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      const xRatio = (e.clientX - rect.left) / rect.width - 0.5;
      const yRatio = (e.clientY - rect.top) / rect.height - 0.5;
      cards.forEach((card, i) => {
        const depth = (i + 1) * 6;
        gsap.to(card, { x: xRatio * depth, y: yRatio * depth * 0.4, duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
      });
    };

    const hero = heroRef?.current;
    if (hero) hero.addEventListener('mousemove', onMouseMove);
    return () => {
      tl.kill();
      bobs.forEach((b) => b.kill());
      if (hero) hero.removeEventListener('mousemove', onMouseMove);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className="floating-docs-wrap" aria-hidden="true">
      <div className="floating-doc-card" style={{ transform: 'rotateY(-14deg) scale(0.88)', zIndex: 1, opacity: 0 }}>
        <div className="floating-doc-topbar"><span className="floating-doc-dot" /><span className="floating-doc-dot" /><span className="floating-doc-dot" /></div>
        <div className="floating-doc-lines">
          <div className="floating-doc-line" style={{ opacity: 0.25 }}>████████████ ██████</div>
          <div className="floating-doc-line" style={{ opacity: 0.40 }}>██████████████ ███</div>
          <div className="floating-doc-line" style={{ opacity: 0.55 }}>████████ ██████████</div>
        </div>
        <div className="floating-doc-badge">PDF</div>
      </div>
      <div className="floating-doc-card" style={{ transform: 'rotateY(2deg) scale(0.94)', zIndex: 2, opacity: 0 }}>
        <div className="floating-doc-topbar"><span className="floating-doc-dot" /><span className="floating-doc-dot" /><span className="floating-doc-dot" /></div>
        <div className="floating-doc-lines">
          <div className="floating-doc-line" style={{ opacity: 0.25 }}>██████████████████</div>
          <div className="floating-doc-line" style={{ opacity: 0.40 }}>████████ █████████</div>
          <div className="floating-doc-line" style={{ opacity: 0.55 }}>██████████████ ███</div>
        </div>
        <div className="floating-doc-badge">DOCX</div>
      </div>
      <div className="floating-doc-card" style={{ transform: 'rotateY(16deg) scale(0.84)', zIndex: 1, opacity: 0 }}>
        <div className="floating-doc-topbar"><span className="floating-doc-dot" /><span className="floating-doc-dot" /><span className="floating-doc-dot" /></div>
        <div className="floating-doc-lines">
          <div className="floating-doc-line" style={{ opacity: 0.25 }}>███████ ██████████</div>
          <div className="floating-doc-line" style={{ opacity: 0.40 }}>████████████ █████</div>
          <div className="floating-doc-line" style={{ opacity: 0.55 }}>██████████ ███████</div>
        </div>
        <div className="floating-doc-badge">TXT</div>
      </div>
    </div>
  );
}

function CountUp({ target }) {
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [value, setValue] = useState(prefersReduced ? target : 0);
  const ref = useRef(null);
  const triggered = useRef(false);

  useEffect(() => {
    if (prefersReduced) return;
    const el = ref.current;
    if (!el) return;
    const counter = { val: 0 };
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      onEnter: () => {
        if (triggered.current) return;
        triggered.current = true;
        gsap.to(counter, {
          val: target,
          duration: 1.4,
          ease: 'power2.out',
          onUpdate: () => setValue(Math.round(counter.val)),
        });
      },
    });
    return () => st.kill();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return <span ref={ref}>{value.toLocaleString()}</span>;
}

function PricingModal({ plan, onClose, onSignUp, onSignIn }) {
  const dialogRef = useRef(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePrimary = () => {
    sessionStorage.setItem('intended_plan', plan.toLowerCase());
    setLoading(true);
    onClose();
    onSignUp();
  };

  const handleSecondary = () => {
    onClose();
    onSignIn();
  };

  const isFree = plan === 'Free';
  const title = isFree ? 'Start for free' : `Upgrade to ${plan}`;
  const titleId = 'pricing-modal-title';

  const desc = isFree
    ? 'Create a free account — 100 queries/month, 1 workspace, 5 documents. No credit card required.'
    : plan === 'Pro'
    ? 'Get 1,000 queries/month and 5 workspaces for $19/mo. Billed monthly via Paddle.'
    : 'Get 5,000 queries/month and unlimited workspaces for $49/mo. Billed monthly via Paddle.';

  const note = isFree
    ? 'No credit card · Your data stays private'
    : 'Email support@lexara.app to cancel';

  return (
    <div
      className="pricing-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="pricing-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pricing-modal-icon" aria-hidden="true">✦</div>
        <h3 id={titleId} className="pricing-modal-title">{title}</h3>
        <p className="pricing-modal-desc">{desc}</p>
        <button
          className="pricing-modal-btn pricing-modal-btn--primary"
          onClick={handlePrimary}
          disabled={loading}
          aria-busy={loading}
        >
          {loading
            ? <span className="lexara-spinner" aria-label="Loading…" style={{ width: 16, height: 16, margin: '0 auto' }} />
            : isFree ? 'Create free account →' : 'Create account to upgrade →'}
        </button>
        <button
          className="pricing-modal-btn pricing-modal-btn--ghost"
          onClick={handleSecondary}
          disabled={loading}
        >
          Sign in to existing account
        </button>
        <p className="pricing-modal-note">{note}</p>
      </div>
    </div>
  );
}

export default function LandingPage({ onSignIn, onSignUp, onPrivacy, onTerms }) {
  const { t, lang, setLang, languageOptions } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [pricingModal, setPricingModal] = useState(null);
  const headlineRef = useRef(null);
  const featuresRef = useRef(null);
  const heroSectionRef = useRef(null);
  const statsRef = useRef(null);
  const pricingRef = useRef(null);
  const faqRef = useRef(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored) return stored === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const featureCards = [
    ['01', 'landing_feature_upload_title', 'Upload. Instantly indexed.', 'landing_feature_upload_body', 'PDF, DOCX, TXT parsing with chunking and local embeddings.', 'landing_feature_upload_detail', 'Optimized for fast first-query time.'],
    ['02', 'landing_feature_ask_title', 'Ask anything, naturally.', 'landing_feature_ask_body', 'Grounded responses with references and retrieval fallback mode.', 'landing_feature_ask_detail', 'Low-latency streaming responses.'],
    ['03', 'landing_feature_conversation_title', 'Conversations, not sessions.', 'landing_feature_conversation_body', 'Context-aware answers with short memory for continuity.', 'landing_feature_conversation_detail', 'Built for multi-turn work.'],
    ['04', 'landing_feature_usage_title', 'Every token accounted for.', 'landing_feature_usage_body', 'Track model usage, token counts, cost, and latency.', 'landing_feature_usage_detail', 'Admin visibility for production ops.'],
  ];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    // Only <html> should own scrolling here. Also setting overflow:auto on
    // <body> (which index.css pins to height:100%) turns body into its own
    // scroll container with the real overflowing content, while <html> —
    // what scrollIntoView()/scrollTo() actually target as
    // document.scrollingElement — ends up with nothing to scroll. Wheel
    // scrolling still hits body's box directly so it looks fine, but any
    // programmatic scroll (nav anchor links) silently no-ops.
    document.documentElement.style.overflow = 'auto';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, []);

  // Deliberately no CSS `scroll-behavior: smooth` here. Setting it on
  // <html> while also calling scrollIntoView({behavior:'smooth'}) /
  // scrollTo({behavior:'smooth'}) from JS (scrollToSection, below) makes
  // the browser drop the scroll entirely — scrollY silently stays put.
  // Verified: removing the CSS property and keeping the JS smooth option
  // is the only combination that actually scrolls. scrollToSection
  // already requests smooth behavior itself, so nothing loses the
  // animation by dropping this.

  // Reading-progress bar: grows right-edge line as user scrolls
  useEffect(() => {
    const bar = document.querySelector('.landing-progress');
    if (!bar) return;
    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const ratio = window.scrollY / max;
      bar.style.transform = `scaleY(${ratio})`;
      bar.classList.toggle('visible', window.scrollY > 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nodes = document.querySelectorAll('.reveal');
    if (prefersReducedMotion) {
      nodes.forEach((el) => el.classList.add('reveal--in'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal--in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -32px 0px' },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  // ── GSAP: hero headline word-split stagger ─────────────────────────────────
  useEffect(() => {
    const el = headlineRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const original = el.innerHTML;
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words
      .map((w) => `<span class="gsap-word" style="display:inline-block;overflow:hidden;vertical-align:bottom"><span class="gsap-word-inner" style="display:inline-block">${w}</span></span>`)
      .join(' ');
    const inners = el.querySelectorAll('.gsap-word-inner');
    const ctx = gsap.context(() => {
      gsap.from(inners, {
        y: 60,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.08,
        delay: 0.1,
      });
    });
    return () => {
      ctx.revert();
      if (el) el.innerHTML = original;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── GSAP: feature cards ScrollTrigger stagger ──────────────────────────────
  useEffect(() => {
    const container = featuresRef.current;
    if (!container || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = container.querySelectorAll('.landing-feature-bento-card');
    const ctx = gsap.context(() => {
      gsap.from(cards, {
        y: 40,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
        stagger: 0.1,
        scrollTrigger: {
          trigger: container,
          start: 'top 78%',
          toggleActions: 'play none none none',
        },
      });
    });
    return () => ctx.revert();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── GSAP: stats strip count-up stagger ────────────────────────────────────
  useEffect(() => {
    const container = statsRef.current;
    if (!container || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const items = container.querySelectorAll('.landing-stat');
    const ctx = gsap.context(() => {
      gsap.from(items, {
        y: 32,
        opacity: 0,
        duration: 0.55,
        ease: 'power3.out',
        stagger: 0.1,
        scrollTrigger: {
          trigger: container,
          start: 'top 82%',
          toggleActions: 'play none none none',
        },
      });
    });
    return () => ctx.revert();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── GSAP: pricing cards fan-in with 3D depth ──────────────────────────────
  useEffect(() => {
    const container = pricingRef.current;
    if (!container || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = container.querySelectorAll('.landing-pricing-card');
    const ctx = gsap.context(() => {
      gsap.from(cards, {
        y: 48,
        opacity: 0,
        rotateX: 8,
        transformPerspective: 800,
        duration: 0.65,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: {
          trigger: container,
          start: 'top 80%',
          toggleActions: 'play none none none',
        },
      });
    });
    return () => ctx.revert();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── GSAP: FAQ items cascade in ────────────────────────────────────────────
  useEffect(() => {
    const container = faqRef.current;
    if (!container || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const items = container.querySelectorAll('.faq-item');
    const ctx = gsap.context(() => {
      gsap.from(items, {
        x: -24,
        opacity: 0,
        duration: 0.5,
        ease: 'power2.out',
        stagger: 0.08,
        scrollTrigger: {
          trigger: container,
          start: 'top 82%',
          toggleActions: 'play none none none',
        },
      });
    });
    return () => ctx.revert();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToSection = (event, id) => {
    event.preventDefault();
    // behavior:'smooth' here never completes on this page — verified
    // directly (window.scrollTo/scrollIntoView with behavior:'smooth'
    // leaves scrollY at 0 no matter what; behavior:'instant' always
    // works). Root cause not fully pinned down beyond that; shipping the
    // behavior that's actually proven to scroll rather than a "smooth"
    // one that silently does nothing.
    document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
  };

  return (
    <div className="landing">
      {/* ── Three.js ambient paper layer (full-page, fixed, pointer-events: none) ── */}
      <ThreeBackground />

      {/* ── Reading-progress bookmark (right edge, fills as user scrolls) ── */}
      <div className="landing-progress" aria-hidden="true" />

      {/* ── Floating orbs ── */}
      <div className="landing-orbs" aria-hidden="true">
        <div className="landing-orb landing-orb--1" />
        <div className="landing-orb landing-orb--2" />
        <div className="landing-orb landing-orb--3" />
      </div>

      {/* ── Nav ── */}
      <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="landing-nav-inner">
          <LexaraLogo height={32} className="landing-nav-logo" />
          <div className="landing-nav-links">
            <a href="#features" className="landing-nav-link" onClick={(e) => scrollToSection(e, 'features')}>{t('landing_nav_features') || 'Features'}</a>
            <a href="#pricing" className="landing-nav-link" onClick={(e) => scrollToSection(e, 'pricing')}>{t('landing_nav_pricing') || 'Pricing'}</a>
            <a href="#faq" className="landing-nav-link" onClick={(e) => scrollToSection(e, 'faq')}>{t('landing_nav_faq') || 'FAQ'}</a>
          </div>
          <div className="landing-nav-right">
            <button onClick={onSignIn} className="landing-btn-ghost">{t('landing_cta_secondary')}</button>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="landing-lang-select"
            >
              {languageOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.flag} {option.code.toUpperCase()}
                </option>
              ))}
            </select>
            <button
              className="landing-theme-toggle"
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            <button onClick={onSignUp} className="landing-btn-primary">{t('landing_cta_primary')}</button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero-section" ref={heroSectionRef}>
        <div className="hero-orb hero-orb-1" aria-hidden="true" />
        <div className="hero-orb hero-orb-2" aria-hidden="true" />
        <div className="hero-orb hero-orb-3" aria-hidden="true" />
        <div className="landing-hero-section-inner">
          <div className="landing-hero-left reveal">
            <div className="landing-hero-badge">Early access · 100 free queries · 3 modes</div>
            <h1 ref={headlineRef} className="landing-hero-headline">{t('landing_headline')}</h1>
            <p className="landing-hero-sub">{t('landing_subhead') || 'Upload documents. Ask questions. Run compliance research. Search Korean law. Get cited answers in seconds.'}</p>
            <div className="landing-hero-actions">
              <button onClick={onSignUp} className="landing-btn-cta-primary landing-btn-cta-glow">{t('landing_cta_primary')}</button>
              <button onClick={onSignIn} className="landing-btn-cta-ghost">{t('landing_cta_secondary')}</button>
            </div>
            <div className="landing-hero-trust">
              <span className="landing-trust-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                Private
              </span>
              <span className="landing-trust-sep">·</span>
              <span className="landing-trust-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                Multilingual
              </span>
              <span className="landing-trust-sep">·</span>
              <span className="landing-trust-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                Cited sources
              </span>
              <span className="landing-trust-sep">·</span>
              <span className="landing-trust-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                Korean law
              </span>
            </div>
          </div>

          <div className="landing-hero-right">
            <TiltCard
              className="landing-hero-demo-card reveal"
              maxDeg={8}
              style={{ '--reveal-delay': '120ms' }}
            >
              <div className="landing-hero-demo-urlbar">{t('demo_url') || 'app.lexara.ai'}</div>
              <div className="landing-hero-demo-msg landing-hero-demo-msg--user">{t('landing_demo_question')}</div>
              <div className="landing-hero-demo-msg landing-hero-demo-msg--assistant">
                {t('landing_demo_answer')}
              </div>
              <div className="landing-hero-demo-msg landing-hero-demo-msg--user">{t('landing_demo_cta')}</div>
              <div className="landing-hero-demo-msg landing-hero-demo-msg--assistant">
                {t('demo_references') || 'References: policy_v2.pdf · contract_notes.docx'}
              </div>
              <div className="landing-hero-demo-footer">{t('demo_powered') || 'Powered by Lexara AI'}</div>
            </TiltCard>
            <FloatingDocs heroRef={heroSectionRef} />
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <div className="landing-trust-strip">
        <div className="landing-trust-strip-label">{t('stats_strip_label') || 'Built for people who work with dense, complex documents'}</div>
        <div className="landing-trust-chips">
          {[
            'Contract review',
            'Compliance research',
            'Korean law',
            'Document Q&A',
            'Due diligence',
          ].map((chip) => (
            <span key={chip} className="landing-trust-pill">{chip}</span>
          ))}
        </div>
        <div className="landing-stats-row" ref={statsRef}>
          <div className="landing-stat">
            <span className="landing-stat-number"><CountUp target={100} /></span>
            <span className="landing-stat-label">{t('landing_stat_free_queries') || 'Free queries/month'}</span>
          </div>
          <div className="landing-stat">
            <span className="landing-stat-number"><CountUp target={5} /></span>
            <span className="landing-stat-label">{t('landing_stat_laws') || 'Korean laws indexed'}</span>
          </div>
          <div className="landing-stat">
            <span className="landing-stat-number"><CountUp target={3} /></span>
            <span className="landing-stat-label">{t('landing_stat_modes') || 'AI modes'}</span>
          </div>
        </div>
      </div>

      {/* ── Demo mockup ── */}
      <section className="landing-demo">
        <div className="landing-demo-window">
          <div className="landing-demo-titlebar">
            <span className="landing-demo-dot" style={{ background: '#ff5f57' }} />
            <span className="landing-demo-dot" style={{ background: '#febc2e' }} />
            <span className="landing-demo-dot" style={{ background: '#28c840' }} />
            <span className="landing-demo-title">Lexara</span>
          </div>
          <div className="landing-demo-body">
            <div className="landing-demo-user">
              {t('landing_demo_question')}
            </div>
            <div className="landing-demo-assistant">
              <p>{t('landing_demo_answer')}</p>
              <div className="landing-demo-sources">
                <span className="landing-demo-source">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  contract.pdf · clause 14.2
                </span>
                <span className="landing-demo-source">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  contract.pdf · clause 14.3
                </span>
              </div>
            </div>
          </div>
          <div className="landing-demo-input">
            <span className="landing-demo-placeholder">
              {t('input_placeholder_ready') || 'Ask about your documents…'}
            </span>
            <span className="landing-demo-send">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            </span>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="landing-features-section">
        <div className="landing-features-inner">
          <h2 className="landing-section-title reveal">{t('landing_features_title') || 'Features'}</h2>
          <div ref={featuresRef} className="landing-features-bento">
            {featureCards.map(([num, titleKey, fallbackTitle, bodyKey, fallbackBody, detailKey, fallbackDetail], i) => {
              const translatedTitle = t(titleKey);
              const title = translatedTitle === titleKey ? fallbackTitle : translatedTitle;
              const translatedBody = t(bodyKey);
              const body = translatedBody === bodyKey ? fallbackBody : translatedBody;
              const translatedDetail = t(detailKey);
              const detail = translatedDetail === detailKey ? fallbackDetail : translatedDetail;
              return (
                <TiltCard
                  key={num}
                  className="landing-feature-bento-card reveal"
                  maxDeg={5}
                  style={{ '--reveal-delay': `${i * 80}ms` }}
                >
                  <div className="landing-feature-num">{num}</div>
                  <h3 className="landing-feature-title">{title}</h3>
                  <p className="landing-feature-desc">{body}</p>
                  <div className="landing-feature-detail">{detail}</div>
                </TiltCard>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="landing-pricing-section" ref={pricingRef}>
        <div className="landing-pricing-inner">
          <h2 className="landing-section-title landing-section-title--light reveal">{t('landing_pricing_title') || 'Pricing'}</h2>
          <div className="landing-pricing-grid">
            {[
              {
                key: 'free',
                name: t('pricing_plan_free') || 'Free',
                price: '$0',
                feats: [
                  t('pricing_feat_free_1') || '100 queries/month',
                  t('pricing_feat_free_2') || '1 workspace',
                  t('pricing_feat_free_3') || '5 documents',
                ],
                cta: t('pricing_cta_free') || 'Try free',
                active: false,
              },
              {
                key: 'pro',
                name: t('pricing_plan_pro') || 'Pro',
                price: '$19/mo',
                feats: [
                  t('pricing_feat_pro_1') || '1,000 queries/month',
                  t('pricing_feat_pro_2') || '5 workspaces',
                  t('pricing_feat_pro_3') || 'Usage analytics',
                ],
                cta: t('pricing_cta_pro') || 'Choose Pro',
                active: true,
              },
              {
                key: 'business',
                name: t('pricing_plan_business') || 'Business',
                price: '$49/mo',
                feats: [
                  t('pricing_feat_biz_1') || '5,000 queries/month',
                  t('pricing_feat_biz_2') || 'Unlimited workspaces*',
                  t('pricing_feat_biz_3') || 'Priority support',
                ],
                cta: t('pricing_cta_business') || 'Choose Business',
                active: false,
              },
            ].map(({ key, name, price, feats, cta, active }) => (
              <div
                key={key}
                className={`landing-pricing-card ${active ? 'landing-pricing-card--pro' : ''}`}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const mx = ((e.clientX - rect.left) / rect.width * 100).toFixed(1) + '%';
                  const my = ((e.clientY - rect.top) / rect.height * 100).toFixed(1) + '%';
                  e.currentTarget.style.setProperty('--mx', mx);
                  e.currentTarget.style.setProperty('--my', my);
                }}
              >
                <div className="landing-pricing-card-header">
                  <h3 className="landing-pricing-plan-name">{name}</h3>
                  <div className="landing-pricing-price">{price}</div>
                </div>
                <ul className="landing-pricing-features">
                  {feats.map((f, i) => (
                    <li key={i} className="landing-pricing-feature">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setPricingModal(name)}
                  className={`landing-pricing-btn ${active ? 'landing-pricing-btn--active' : ''}`}
                >
                  {cta}
                </button>
              </div>
            ))}
          </div>
          <p className="landing-pricing-note">
            {t('landing_pricing_note') || 'Billed monthly via Paddle · Email support to cancel · * Fair use limits apply'}
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="landing-faq" id="faq">
        <div className="landing-faq-inner">
          <h2 className="landing-section-title">
            {t('faq_title') || 'Frequently Asked Questions'}
          </h2>
          <div className="landing-faq-grid" ref={faqRef}>
            {[
              { q: t('faq_q1') || 'How fast is document indexing?', a: t('faq_a1') || 'Most PDFs and DOCX files are searchable within seconds of upload. Larger documents (50MB+) may take up to 30 seconds.' },
              { q: t('faq_q2') || 'Can I use Lexara without a credit card?', a: t('faq_a2') || 'Yes. The Free plan requires no payment. Upload up to 5 documents and send 100 queries per month completely free.' },
              { q: t('faq_q3') || 'Does it support multilingual documents?', a: t('faq_a3') || 'Yes. You can upload documents in any language and ask questions in English, Uzbek, Russian, Korean, or Japanese.' },
              { q: t('faq_q4') || 'Are my documents private?', a: t('faq_a4') || 'Yes. Your documents are stored in isolated workspaces and are never used to train our models or shared with other users.' },
              { q: t('faq_q5') || 'What file formats are supported?', a: t('faq_a5') || 'PDF, DOCX, and TXT files up to 50MB. Support for XLSX and PPTX is on our roadmap.' },
              { q: t('faq_q6') || 'Can I cancel my subscription anytime?', a: t('faq_a6') || 'Yes. Email support@lexara.app to cancel. You keep access until the end of your billing period.' },
            ].map((item, i) => (
              <FAQItem key={i} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="landing-cta-banner-section">
        <div className="landing-cta-banner-inner">
          <div className="landing-cta-banner">
            <h3 className="landing-cta-banner-headline">{t('landing_cta_headline') || 'Ready to make documents answerable?'}</h3>
            <button onClick={onSignUp} className="landing-cta-banner-btn landing-btn-cta-glow">{t('landing_cta_start') || 'Start with Lexara'}</button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <LexaraLogo height={32} />
          <div className="landing-footer-links">
            © {new Date().getFullYear()} ·
            <button onClick={onPrivacy} className="landing-footer-link">{t('landing_footer_privacy') || 'Privacy'}</button>·
            <button onClick={onTerms} className="landing-footer-link">{t('landing_footer_terms') || 'Terms'}</button>·
            <span>{t('landing_footer_contact') || 'Contact'}</span>
          </div>
        </div>
      </footer>

      {/* ── Pricing modal ── */}
      {pricingModal && (
        <PricingModal
          plan={pricingModal}
          onClose={() => setPricingModal(null)}
          onSignUp={onSignUp}
          onSignIn={onSignIn}
        />
      )}
    </div>
  );
}
