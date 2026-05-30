import { useCallback, useEffect, useRef, useState } from 'react';
import { LexaraLogo } from '../assets/LexaraLogo';
import { useTranslation } from '../i18n/useTranslation';
import '../styles/LandingPage.css';

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

function ContactForm({ t }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Lexara inquiry from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`);
    window.open(`mailto:support@lexara.app?subject=${subject}&body=${body}`);
    setSent(true);
    setTimeout(() => setSent(false), 5000);
  };

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="contact-form-row">
        <input
          type="text"
          className="contact-input"
          placeholder={t('contact_name') || 'Your name'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="email"
          className="contact-input"
          placeholder={t('contact_email') || 'Your email'}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <textarea
        className="contact-input contact-textarea"
        placeholder={t('contact_message') || 'Your message...'}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        required
      />
      <button type="submit" className="landing-btn-primary landing-btn-submit" disabled={sent}>
        {sent
          ? (t('contact_sent') || 'Email client opened ✓')
          : (t('contact_send') || 'Open email client →')}
      </button>
      <p className="contact-form-note">
        {t('contact_note') || 'Opens your email app with a pre-filled message to support@lexara.app'}
      </p>
    </form>
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
    el.style.transform = `perspective(800px) rotateY(${x * maxDeg * 2}deg) rotateX(${-y * maxDeg * 2}deg) translateZ(4px)`;
    el.style.transition = 'transform 80ms linear';
  }, [maxDeg]);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = '';
    el.style.transition = 'transform 300ms ease';
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

function CountUp({ target, duration = 1200 }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          if (prefersReducedMotion) {
            setValue(target);
            return;
          }
          const start = performance.now();
          const tick = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{value.toLocaleString()}</span>;
}

export default function LandingPage({ onSignIn, onSignUp, onPrivacy, onTerms }) {
  const { t, lang, setLang, languageOptions } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [pricingModal, setPricingModal] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored) return stored === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const featureCards = [
    ['01', 'landing_feature_upload_title', 'Upload. Instantly indexed.', 'PDF, DOCX, TXT parsing with chunking and local embeddings.', 'Optimized for fast first-query time.'],
    ['02', 'landing_feature_ask_title', 'Ask anything, naturally.', 'Grounded responses with references and retrieval fallback mode.', 'Low-latency streaming responses.'],
    ['03', 'landing_feature_conversation_title', 'Conversations, not sessions.', 'Context-aware answers with short memory for continuity.', 'Built for multi-turn work.'],
    ['04', 'landing_feature_usage_title', 'Every token accounted for.', 'Track model usage, token counts, cost, and latency.', 'Admin visibility for production ops.'],
  ];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
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

  const scrollToSection = (event, id) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing">
      {/* ── Floating orbs ── */}
      <div className="landing-orbs" aria-hidden="true">
        <div className="landing-orb landing-orb--1" />
        <div className="landing-orb landing-orb--2" />
        <div className="landing-orb landing-orb--3" />
      </div>

      {/* ── Nav ── */}
      <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="landing-nav-inner">
          <LexaraLogo height={32} />
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
      <section className="landing-hero-section">
        <div className="landing-hero-section-inner">
          <div className="landing-hero-left reveal">
            <div className="landing-hero-badge">Early access · 100 free queries</div>
            <h1 className="landing-hero-headline">{t('landing_headline')}</h1>
            <p className="landing-hero-sub">{t('landing_subhead')}</p>
            <div className="landing-hero-actions">
              <button onClick={onSignUp} className="landing-btn-cta-primary landing-btn-cta-glow">{t('landing_cta_primary')}</button>
              <button onClick={onSignIn} className="landing-btn-cta-ghost">{t('landing_cta_secondary')}</button>
            </div>
            <div className="landing-hero-trust">
              <span className="landing-trust-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                {t('badge_private') || 'Private'}
              </span>
              <span className="landing-trust-sep">·</span>
              <span className="landing-trust-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                {t('badge_fast') || 'Fast'}
              </span>
              <span className="landing-trust-sep">·</span>
              <span className="landing-trust-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                {t('badge_cited') || 'Cited sources'}
              </span>
            </div>
          </div>

          <TiltCard
            className="landing-hero-demo-card reveal"
            maxDeg={8}
            style={{ '--reveal-delay': '120ms' }}
          >
            <div className="landing-hero-demo-urlbar">{t('demo_url') || 'app.lexara.ai'}</div>
            <div className="landing-hero-demo-msg landing-hero-demo-msg--user">{t('demo_q2') || 'What changed in the latest version?'}</div>
            <div className="landing-hero-demo-msg landing-hero-demo-msg--assistant">
              {t('demo_a2_intro') || 'Version 3.2 introduces three changes:'}
              <div className="landing-hero-demo-list-item">1. {t('demo_a2_l1') || 'Better retrieval ranking for long legal docs.'}</div>
              <div className="landing-hero-demo-list-item">2. {t('demo_a2_l2') || 'Faster indexing for DOCX and scanned PDFs.'}</div>
              <div className="landing-hero-demo-list-item">3. {t('demo_a2_l3') || 'Updated usage analytics for clearer spend tracking.'}</div>
            </div>
            <div className="landing-hero-demo-msg landing-hero-demo-msg--user">{t('demo_q3') || 'Show source lines for the ranking update.'}</div>
            <div className="landing-hero-demo-msg landing-hero-demo-msg--assistant">
              {t('demo_references') || 'References: policy_v2.pdf · contract_notes.docx'}
            </div>
            <div className="landing-hero-demo-footer">{t('demo_powered') || 'Powered by GPT-4o'}</div>
          </TiltCard>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <div className="landing-trust-strip">
        <div className="landing-trust-strip-label">Built for people who work with dense, complex documents</div>
        <div className="landing-trust-chips">
          {['Contract review', 'Research synthesis', 'Document Q&A', 'Report analysis'].map((chip) => (
            <span key={chip} className="landing-trust-pill">{chip}</span>
          ))}
        </div>
        <div className="landing-stats-row">
          <div className="landing-stat">
            <span className="landing-stat-number"><CountUp target={1200} />+</span>
            <span className="landing-stat-label">documents indexed</span>
          </div>
          <div className="landing-stat">
            <span className="landing-stat-number"><CountUp target={50000} />+</span>
            <span className="landing-stat-label">queries answered</span>
          </div>
          <div className="landing-stat">
            <span className="landing-stat-number"><CountUp target={99} />%</span>
            <span className="landing-stat-label">uptime</span>
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
              {t('demo_question') || 'What are the termination conditions?'}
            </div>
            <div className="landing-demo-assistant">
              <p>{t('demo_answer') || 'Per clause 14.2, either party may terminate this agreement with 30 days written notice. Immediate termination is permitted in cases of material breach (clause 14.3) or insolvency (clause 14.4).'}</p>
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
          <h2 className="landing-section-title reveal">Features</h2>
          <div className="landing-features-bento">
            {featureCards.map(([num, titleKey, fallbackTitle, body, detail], i) => {
              const translatedTitle = t(titleKey);
              const title = translatedTitle === titleKey ? fallbackTitle : translatedTitle;
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
      <section id="pricing" className="landing-pricing-section">
        <div className="landing-pricing-inner">
          <h2 className="landing-section-title landing-section-title--light reveal">Pricing</h2>
          <div className="landing-pricing-grid">
            {[
              ['Free', '$0', ['100 queries/month', '1 workspace', '5 documents'], 'Try free', false],
              ['Pro', '$19/mo', ['1,000 queries/month', '5 workspaces', 'Usage analytics'], 'Choose Pro', true],
              ['Business', '$49/mo', ['5,000 queries/month', 'Unlimited workspaces', 'Priority support'], 'Choose Business', false],
            ].map(([name, price, feats, cta, active]) => (
              <div key={name} className={`landing-pricing-card ${active ? 'landing-pricing-card--pro' : ''}`}>
                <div className="landing-pricing-card-header">
                  <h3 className="landing-pricing-plan-name">{name}</h3>
                  <div className="landing-pricing-price">{price}</div>
                </div>
                <ul className="landing-pricing-features">
                  {feats.map((f) => (
                    <li key={f} className="landing-pricing-feature">
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
            Billed monthly via Paddle · Cancel anytime from your profile
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="landing-faq" id="faq">
        <div className="landing-faq-inner">
          <h2 className="landing-section-title">
            {t('faq_title') || 'Frequently Asked Questions'}
          </h2>
          <div className="landing-faq-grid">
            {[
              { q: t('faq_q1') || 'How fast is document indexing?', a: t('faq_a1') || 'Most PDFs and DOCX files are searchable within seconds of upload. Larger documents (50MB+) may take up to 30 seconds.' },
              { q: t('faq_q2') || 'Can I use Lexara without a credit card?', a: t('faq_a2') || 'Yes. The Free plan requires no payment. Upload up to 5 documents and send 50 queries per month completely free.' },
              { q: t('faq_q3') || 'Does it support multilingual documents?', a: t('faq_a3') || 'Yes. You can upload documents in any language and ask questions in English, Uzbek, Russian, Korean, or Japanese.' },
              { q: t('faq_q4') || 'Are my documents private?', a: t('faq_a4') || 'Yes. Your documents are stored in isolated workspaces and are never used to train our models or shared with other users.' },
              { q: t('faq_q5') || 'What file formats are supported?', a: t('faq_a5') || 'PDF, DOCX, and TXT files up to 50MB. Support for XLSX and PPTX is on our roadmap.' },
              { q: t('faq_q6') || 'Can I cancel my subscription anytime?', a: t('faq_a6') || 'Yes. Cancel anytime from your profile page. You keep access until the end of your billing period.' },
            ].map((item, i) => (
              <FAQItem key={i} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section className="landing-contact" id="contact">
        <div className="landing-contact-inner">
          <h2 className="landing-section-title">
            {t('contact_title') || 'Get in touch'}
          </h2>
          <p className="landing-contact-sub">
            {t('contact_sub') || 'Have a question or want to discuss a custom plan? We respond within 24 hours.'}
          </p>
          <ContactForm t={t} />
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
        <div
          className="pricing-modal-overlay"
          onClick={() => setPricingModal(null)}
        >
          <div
            className="pricing-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pricing-modal-icon">✦</div>
            <h3 className="pricing-modal-title">
              {pricingModal === 'Free' ? 'Start for free' : pricingModal === 'Pro' ? 'Upgrade to Pro' : 'Upgrade to Business'}
            </h3>
            <p className="pricing-modal-desc">
              {pricingModal === 'Free'
                ? 'Create a free account — 100 queries/month, 1 workspace, 5 documents. No credit card required.'
                : pricingModal === 'Pro'
                ? 'Get 1,000 queries/month and 5 workspaces for $19/mo. Billed monthly via Paddle. Cancel anytime from your profile.'
                : 'Get 5,000 queries/month and unlimited workspaces for $49/mo. Billed monthly via Paddle. Cancel anytime.'}
            </p>
            <button
              onClick={() => { setPricingModal(null); onSignUp(); }}
              className="pricing-modal-btn pricing-modal-btn--primary"
            >
              {pricingModal === 'Free' ? 'Create free account →' : 'Create account to upgrade →'}
            </button>
            <button
              onClick={() => { setPricingModal(null); onSignIn(); }}
              className="pricing-modal-btn pricing-modal-btn--ghost"
            >
              Sign in to existing account
            </button>
            <p className="pricing-modal-note">
              {pricingModal === 'Free' ? 'No credit card · Your data stays private' : 'Cancel anytime from your profile page'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
