import { useEffect, useMemo, useState } from 'react';
import { LexaraLogo } from '../assets/LexaraLogo';

const faqItems = [
  ['How fast is indexing?', 'Most PDFs and DOCX files are searchable in seconds after upload.'],
  ['Can I use Lexara without a card?', 'Yes. Early access includes free queries and no credit card requirement.'],
  ['Does it support multilingual docs?', 'Yes, Lexara can retrieve and answer across multilingual content.'],
  ['Can I track token spend?', 'Yes, monitor token usage, costs, and latency in the Usage tab.'],
  ['Is enterprise deployment available?', 'Yes, contact us for private cloud and compliance-ready deployments.'],
];

export default function LandingPage({ onSignIn, onSignUp, onPrivacy, onTerms }) {
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [pricingModal, setPricingModal] = useState(null);

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
            <a href="#features" onClick={(event) => scrollToSection(event, 'features')} style={{ color: '#6b6560', textDecoration: 'none', fontSize: 14 }}>Features</a>
            <a href="#pricing" onClick={(event) => scrollToSection(event, 'pricing')} style={{ color: '#6b6560', textDecoration: 'none', fontSize: 14 }}>Pricing</a>
            <a href="#faq" onClick={(event) => scrollToSection(event, 'faq')} style={{ color: '#6b6560', textDecoration: 'none', fontSize: 14 }}>FAQ</a>
            <button onClick={onSignIn} style={{ border: '1px solid rgba(0,0,0,0.14)', background: '#fff', borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}>Sign in</button>
            <button onClick={onSignUp} style={{ border: 'none', background: '#2356d8', color: '#fff', borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}>Get started</button>
          </div>
        </div>
      </nav>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '56px 24px 30px', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 32, position: 'relative', overflow: 'hidden' }}>
        <canvas id="lexara-hero-canvas" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35, pointerEvents: 'none' }} />
        <div data-reveal style={{ ...reveal, position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 999, background: '#fff', border: '1px solid rgba(0,0,0,0.08)', fontSize: 12, marginBottom: 20 }}>Early access · 50 free queries</div>
          <h1 style={{ fontSize: 68, lineHeight: 0.95, letterSpacing: '-0.03em', margin: '0 0 16px' }}>Your documents, finally answerable.</h1>
          <p style={{ maxWidth: 500, color: '#6b6560', fontSize: 18, lineHeight: 1.5, margin: '0 0 24px' }}>Upload any document. Ask questions in your language. Get answers with the exact source passage — in seconds.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onSignUp} style={{ border: 'none', background: '#2356d8', color: '#fff', borderRadius: 12, padding: '12px 18px', cursor: 'pointer', boxShadow: '0 10px 24px rgba(35,86,216,0.24)' }}>Start free</button>
            <button onClick={onSignIn} style={{ border: '1px solid rgba(0,0,0,0.14)', background: 'transparent', borderRadius: 12, padding: '12px 18px', cursor: 'pointer' }}>Sign in</button>
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

      <section id="features" style={{ maxWidth: 1120, margin: '0 auto', padding: '36px 24px', display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {[
          ['01', 'Upload. Instantly indexed.', 'PDF, DOCX, TXT parsing with chunking and local embeddings.', 'Optimized for fast first-query time.'],
          ['02', 'Ask anything, naturally.', 'Grounded responses with references and retrieval fallback mode.', 'Low-latency streaming responses.'],
          ['03', 'Conversations, not sessions.', 'Context-aware answers with short memory for continuity.', 'Built for multi-turn work.'],
          ['04', 'Every token accounted for.', 'Track model usage, token counts, cost, and latency.', 'Admin visibility for production ops.'],
        ].map(([num, title, body, detail], i) => (
          <div key={num} data-reveal style={{ ...reveal, transitionDelay: `${i * 60}ms`, background: i % 2 ? '#fff' : '#fdfbf7', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontFamily: 'var(--font-mono)', color: '#2356d8', marginBottom: 10 }}>{num}</div>
            <h3 style={{ margin: '0 0 8px' }}>{title}</h3>
            <p style={{ margin: '0 0 8px', color: '#6b6560' }}>{body}</p>
            <div style={{ fontSize: 13, color: '#8a847c' }}>{detail}</div>
          </div>
        ))}
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

      <section id="faq" style={{ maxWidth: 980, margin: '0 auto', padding: '40px 24px' }}>
        <h2 style={{ marginTop: 0 }}>FAQ</h2>
        {faqItems.map(([q, a], index) => (
          <div key={q} style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '12px 0' }}>
            <button onClick={() => setOpenFaq(openFaq === index ? -1 : index)} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontSize: 16 }}>
              {q}
            </button>
            <div style={{ maxHeight: openFaq === index ? 120 : 0, overflow: 'hidden', transition: 'max-height 240ms ease', color: '#6b6560' }}>
              <div style={{ paddingTop: 8 }}>{a}</div>
            </div>
          </div>
        ))}
      </section>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px 36px' }}>
        <div style={{ borderRadius: 16, background: 'linear-gradient(135deg,#2a5ce0,#2356d8)', color: '#fff', padding: '30px 24px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 30 }}>Ready to make documents answerable?</h3>
          <button onClick={onSignUp} style={{ border: 'none', borderRadius: 12, background: '#fff', color: '#2356d8', padding: '10px 16px', cursor: 'pointer' }}>Start with Lexara</button>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: '20px 24px', color: '#6b6560' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <LexaraLogo height={32} />
          <div>
            © {new Date().getFullYear()} ·
            <button onClick={onPrivacy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b6560', margin: '0 6px' }}>Privacy</button>·
            <button onClick={onTerms} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b6560', margin: '0 6px' }}>Terms</button>· Contact
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
