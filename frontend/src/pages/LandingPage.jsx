import { useEffect, useMemo, useState } from 'react';
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
      <button type="submit" className="landing-btn-primary">
        {sent
          ? (t('contact_sent') || 'Opening email client...')
          : (t('contact_send') || 'Send message →')}
      </button>
    </form>
  );
}

export default function LandingPage({ onSignIn, onSignUp, onPrivacy, onTerms }) {
  const { t, lang, setLang, languageOptions } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [pricingModal, setPricingModal] = useState(null);

  const featureCards = [
    ['01', 'landing_feature_upload_title', 'Upload. Instantly indexed.', 'PDF, DOCX, TXT parsing with chunking and local embeddings.', 'Optimized for fast first-query time.'],
    ['02', 'landing_feature_ask_title', 'Ask anything, naturally.', 'Grounded responses with references and retrieval fallback mode.', 'Low-latency streaming responses.'],
    ['03', 'landing_feature_conversation_title', 'Conversations, not sessions.', 'Context-aware answers with short memory for continuity.', 'Built for multi-turn work.'],
    ['04', 'landing_feature_usage_title', 'Every token accounted for.', 'Track model usage, token counts, cost, and latency.', 'Admin visibility for production ops.'],
  ];

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.style.opacity = '1';
          if (entry.isIntersecting) entry.target.style.transform = 'translateY(0px)';
        });
      },
      { threshold: 0.15 },
    );
    const nodes = document.querySelectorAll('[data-reveal]');
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js';
    script.onload = () => {
      if (window.p5 && !window._lexaraSketch) {
        window._lexaraSketch = new window.p5((p) => {
          let particles = [];
          const N = 120;

          p.setup = () => {
            const host = document.getElementById('lexara-hero-canvas');
            if (!host) return;
            const cnv = p.createCanvas(host.offsetWidth, host.offsetHeight);
            cnv.parent(host);
            p.randomSeed(42);
            p.noiseSeed(42);
            p.colorMode(p.HSB, 360, 100, 100, 100);
            for (let i = 0; i < N; i += 1) {
              particles.push({
                x: p.random(p.width),
                y: p.random(p.height),
                vx: 0,
                vy: 0,
                age: p.random(200),
                maxAge: p.random(120, 280),
                size: p.random(1.5, 4),
                hue: p.random([215, 220, 225, 230]),
              });
            }
          };

          p.draw = () => {
            p.noStroke();
            p.fill(38, 8, 97, 10);
            p.rect(0, 0, p.width, p.height);
            const t = p.frameCount * 0.003;
            particles.forEach((pt) => {
              pt.age += 1;
              const angle = p.noise(pt.x * 0.002, pt.y * 0.002, t) * p.TWO_PI * 2.5;
              const speed = 0.7 + p.noise(pt.x * 0.001, pt.y * 0.001, t * 0.5 + 50) * 0.8;
              pt.vx = pt.vx * 0.88 + Math.cos(angle) * speed * 0.12;
              pt.vy = pt.vy * 0.88 + Math.sin(angle) * speed * 0.12;
              pt.x += pt.vx;
              pt.y += pt.vy;
              const life = pt.age / pt.maxAge;
              const alpha = life < 0.15 ? (life / 0.15) * 70 : life > 0.75 ? ((1 - life) / 0.25) * 70 : 70;
              p.fill(pt.hue, 65, 75, alpha);
              p.ellipse(pt.x, pt.y, pt.size, pt.size);
              if (pt.age > pt.maxAge || pt.x < -10 || pt.x > p.width + 10 || pt.y < -10 || pt.y > p.height + 10) {
                pt.x = p.random(p.width);
                pt.y = p.random(p.height);
                pt.vx = 0;
                pt.vy = 0;
                pt.age = 0;
                pt.maxAge = p.random(120, 280);
                pt.size = p.random(1.5, 4);
              }
            });
          };

          p.windowResized = () => {
            const host = document.getElementById('lexara-hero-canvas');
            if (!host) return;
            p.resizeCanvas(host.offsetWidth, host.offsetHeight);
          };
        });
      }
    };
    document.body.appendChild(script);
    return () => {
      if (window._lexaraSketch) {
        window._lexaraSketch.remove();
        window._lexaraSketch = null;
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const reveal = useMemo(() => ({
    opacity: 0,
    transform: 'translateY(18px)',
    transition: 'all 500ms ease',
  }), []);

  const scrollToSection = (event, id) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ background: '#f8f6f1', color: '#1a1a1a', fontFamily: 'var(--font-sans)', minHeight: '100vh', overflowY: 'auto' }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50, padding: '14px 32px',
        background: scrolled ? 'rgba(248,246,241,0.8)' : 'transparent',
        backdropFilter: scrolled ? 'blur(10px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.08)' : '1px solid transparent',
        transition: 'all 220ms ease',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <LexaraLogo height={32} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <a href="#features" onClick={(event) => scrollToSection(event, 'features')} style={{ color: '#6b6560', textDecoration: 'none', fontSize: 14 }}>{t('landing_nav_features') || 'Features'}</a>
            <a href="#pricing" onClick={(event) => scrollToSection(event, 'pricing')} style={{ color: '#6b6560', textDecoration: 'none', fontSize: 14 }}>{t('landing_nav_pricing') || 'Pricing'}</a>
            <a href="#faq" onClick={(event) => scrollToSection(event, 'faq')} style={{ color: '#6b6560', textDecoration: 'none', fontSize: 14 }}>{t('landing_nav_faq') || 'FAQ'}</a>
            <button onClick={onSignIn} style={{ border: '1px solid rgba(0,0,0,0.14)', background: '#fff', borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}>{t('landing_cta_secondary')}</button>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              style={{
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 13,
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              {languageOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.flag} {option.code.toUpperCase()}
                </option>
              ))}
            </select>
            <button onClick={onSignUp} style={{ border: 'none', background: '#2356d8', color: '#fff', borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}>{t('landing_cta_primary')}</button>
          </div>
        </div>
      </nav>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '56px 24px 30px', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 32, position: 'relative', overflow: 'hidden' }}>
        <canvas id="lexara-hero-canvas" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35, pointerEvents: 'none' }} />
        <div data-reveal style={{ ...reveal, position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 999, background: '#fff', border: '1px solid rgba(0,0,0,0.08)', fontSize: 12, marginBottom: 20 }}>Early access · 50 free queries</div>
          <h1 style={{ fontSize: 68, lineHeight: 0.95, letterSpacing: '-0.03em', margin: '0 0 16px' }}>{t('landing_headline')}</h1>
          <p style={{ maxWidth: 500, color: '#6b6560', fontSize: 18, lineHeight: 1.5, margin: '0 0 24px' }}>{t('landing_subhead')}</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onSignUp} style={{ border: 'none', background: '#2356d8', color: '#fff', borderRadius: 12, padding: '12px 18px', cursor: 'pointer', boxShadow: '0 10px 24px rgba(35,86,216,0.24)' }}>{t('landing_cta_primary')}</button>
            <button onClick={onSignIn} style={{ border: '1px solid rgba(0,0,0,0.14)', background: 'transparent', borderRadius: 12, padding: '12px 18px', cursor: 'pointer' }}>{t('landing_cta_secondary')}</button>
          </div>
          <div style={{ marginTop: 10, color: '#8a847c', fontSize: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🔒 Private</span><span>·</span><span>⚡ Fast</span><span>·</span><span>📄 Cited sources</span>
          </div>
        </div>
        <div data-reveal style={{ ...reveal, transitionDelay: '80ms', background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 18, padding: 16, boxShadow: '0 32px 80px rgba(0,0,0,0.12)', position: 'relative', zIndex: 2 }}>
          <div style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: 10, marginBottom: 12, fontFamily: 'var(--font-mono)', fontSize: 12 }}>app.lexara.ai</div>
          <div style={{ background: '#f6f7fb', borderRadius: 12, padding: 10, marginBottom: 8 }}>What changed in the latest version?</div>
          <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', padding: 10, marginBottom: 8 }}>
            Version 3.2 introduces three changes:
            <div>1. Better retrieval ranking for long legal docs.</div>
            <div>2. Faster indexing for DOCX and scanned PDFs.</div>
            <div>3. Updated usage analytics for clearer spend tracking.</div>
          </div>
          <div style={{ background: '#f6f7fb', borderRadius: 12, padding: 10, marginBottom: 8 }}>Show source lines for the ranking update.</div>
          <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', padding: 10 }}>
            References: policy_v2.pdf · contract_notes.docx
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: '#8a847c', textAlign: 'right' }}>Powered by GPT-4o</div>
        </div>
      </section>

      <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '14px 24px', textAlign: 'center', color: '#6b6560' }}>
        <div style={{ marginBottom: 10 }}>Built for people who work with dense, complex documents</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {['Contract review', 'Research synthesis', 'Document Q&A', 'Report analysis'].map((chip) => (
            <span key={chip} style={{ borderRadius: 999, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', padding: '6px 10px', fontSize: 12, color: '#6b6560' }}>
              {chip}
            </span>
          ))}
        </div>
      </div>

      {/* DEMO MOCKUP */}
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
                <span className="landing-demo-source">📄 contract.pdf · clause 14.2</span>
                <span className="landing-demo-source">📄 contract.pdf · clause 14.3</span>
              </div>
            </div>
          </div>
          <div className="landing-demo-input">
            <span className="landing-demo-placeholder">
              {t('input_placeholder_ready') || 'Ask about your documents…'}
            </span>
            <span className="landing-demo-send">→</span>
          </div>
        </div>
      </section>

      <section id="features" style={{ maxWidth: 1120, margin: '0 auto', padding: '36px 24px', display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {featureCards.map(([num, titleKey, fallbackTitle, body, detail], i) => {
          const translatedTitle = t(titleKey);
          const title = translatedTitle === titleKey ? fallbackTitle : translatedTitle;
          return (
          <div key={num} data-reveal style={{ ...reveal, transitionDelay: `${i * 60}ms`, background: i % 2 ? '#fff' : '#fdfbf7', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontFamily: 'var(--font-mono)', color: '#2356d8', marginBottom: 10 }}>{num}</div>
            <h3 style={{ margin: '0 0 8px' }}>{title}</h3>
            <p style={{ margin: '0 0 8px', color: '#6b6560' }}>{body}</p>
            <div style={{ fontSize: 13, color: '#8a847c' }}>{detail}</div>
          </div>
          );
        })}
      </section>

      <section id="pricing" style={{ background: '#1a1814', color: '#fff', padding: '44px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 14 }}>
          {[
            ['Free', '$0', ['50 queries', 'Single workspace', 'Community support'], 'Try free', false],
            ['Pro', '$19/mo', ['2,000 queries', 'Usage analytics', 'Priority support'], 'Choose Pro', true],
            ['Enterprise', 'Custom', ['Unlimited workspaces', 'SSO/SAML', 'Dedicated support'], 'Contact sales', false],
          ].map(([name, price, feats, cta, active]) => (
            <div key={name} style={{ background: active ? '#2356d8' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: '0 0 6px' }}>{name}</h3>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{price}</div>
              <div style={{ minHeight: 90 }}>{feats.map((f) => <div key={f} style={{ marginBottom: 6 }}>✓ {f}</div>)}</div>
              <button onClick={() => setPricingModal(name)} style={{ marginTop: 6, width: '100%', borderRadius: 10, border: 'none', padding: '10px 12px', cursor: 'pointer' }}>{cta}</button>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', marginTop: 12, color: '#b4b2a9', fontSize: 12 }}>
          Pricing shown is illustrative. Lexara is currently in early access.
        </p>
      </section>

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

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px 36px' }}>
        <div style={{ borderRadius: 16, background: 'linear-gradient(135deg,#2a5ce0,#2356d8)', color: '#fff', padding: '30px 24px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 30 }}>{t('landing_cta_headline') || 'Ready to make documents answerable?'}</h3>
          <button onClick={onSignUp} style={{ border: 'none', borderRadius: 12, background: '#fff', color: '#2356d8', padding: '10px 16px', cursor: 'pointer' }}>{t('landing_cta_start') || 'Start with Lexara'}</button>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: '20px 24px', color: '#6b6560' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <LexaraLogo height={32} />
          <div>
            © {new Date().getFullYear()} ·
            <button onClick={onPrivacy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b6560', margin: '0 6px' }}>{t('landing_footer_privacy') || 'Privacy'}</button>·
            <button onClick={onTerms} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b6560', margin: '0 6px' }}>{t('landing_footer_terms') || 'Terms'}</button>· {t('landing_footer_contact') || 'Contact'}
          </div>
        </div>
      </footer>

      {pricingModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 24,
          }}
          onClick={() => setPricingModal(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 20, padding: 36, maxWidth: 420, width: '100%', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              {pricingModal === 'Free' ? 'Start for free' : pricingModal === 'Pro' ? 'Start your 14-day trial' : 'Get in touch'}
            </h3>
            <p style={{ fontSize: 14, color: '#5a5650', marginBottom: 24, lineHeight: 1.6 }}>
              {pricingModal === 'Free'
                ? 'Create a free account to get 50 queries per month, 3 workspaces, and full document Q&A.'
                : pricingModal === 'Pro'
                ? 'Try Pro free for 14 days. No credit card required to start. Cancel anytime.'
                : 'Enterprise plans are custom-priced. Create an account and we\'ll reach out.'}
            </p>
            <button
              onClick={() => { setPricingModal(null); onSignUp(); }}
              style={{
                width: '100%', height: 46, background: '#2356d8', color: '#fff',
                border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600,
                cursor: 'pointer', marginBottom: 12,
              }}
            >
              Create free account →
            </button>
            <button
              onClick={() => { setPricingModal(null); onSignIn(); }}
              style={{
                width: '100%', height: 46, background: 'transparent', color: '#5a5650',
                border: '1px solid rgba(0,0,0,0.12)', borderRadius: 12,
                fontSize: 14, cursor: 'pointer',
              }}
            >
              Sign in to existing account
            </button>
            <p style={{ fontSize: 11, color: '#b4b2a9', marginTop: 12 }}>
              No credit card · Cancel anytime · Your data stays private
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
