# Evidence — Lexara Platform Design Audit

## Structural Evidence

**Interactive element count:** ~42 distinct interactive elements across 3 surfaces  
**Max nesting depth:** 10 levels — `ChatPage.jsx:413` (path in SVG inside onboarding icon)  
**Repeated affordances (5 groups):**
- Sign-in trigger: 3 instances — nav, hero, pricing modal (LandingPage.jsx:228, 260, 443)
- Sign-up trigger: 4 instances — nav, hero, CTA, pricing modal (LandingPage.jsx:247, 259, 394, 433)
- Language selector: 2 instances — nav + MyPage prefs (LandingPage.jsx:229, MyPage.jsx:226)
- Two different actions share `.mypage-signout-btn` CSS class: logout (MyPage.jsx:238) and mailto plan management (MyPage.jsx:308)

**Dead code:**
- `ChatPage.jsx:4` — `LexaraIcon` imported, never used
- `ChatMessage.jsx:94` — `isLoading` prop declared, never passed by ChatPage.jsx:458
- `LandingPage.jsx:1` — `useMemo` used only for a static object with no reactive deps

**State machines:** ChatPage: 12 states, MyPage: 4, LandingPage: 2 + FAQItem: 1 + ContactForm: 4, ChatMessage: 1

**Empty / Loading / Error state coverage:**
- ChatPage: empty ✓, loading partial, error ✓
- MyPage: empty ✗, loading ✗, error ✗ (catch uses `alert()` — MyPage.jsx:142)
- LandingPage contact form: error ✗, loading ✗, disabled ✗

---

## Visual Evidence

**Spacing scale:** 26+ distinct px values including orphans at 5, 9, 18, 22, 28, 44, 56, 60px. No declared spacing token in use beyond ad hoc hardcoded values.

**Type scale:** 18 distinct font sizes (10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 30, 32, 36, 42, 68px + 15px body). Orphan: 30px (LandingPage.jsx:393 only). The `h1` at `LandingPage.jsx:256` uses inline `fontSize: 68` which overrides the CSS class `.landing-hero-headline` at `LandingPage.css:127` — that CSS rule is dead.

**Distinct hex colors: ~42** — including 5 near-identical off-white background values (`#faf9f7`, `#f8f6f1`, `#f7f7f6`, `#f6f7fb`, `#f7f5f0`) and 4 near-identical secondary-text grays (`#6b6860`, `#6b6560`, `#6b7280`, `#5a5650`).

**CSS variable usage:** 
- ChatPage.css: ~63% variables / 37% hardcoded
- ChatMessage.css: ~46% / 54% (confidence badge colors entirely hardcoded)
- MyPage.css: ~5% / 95% — almost fully disconnected from token system
- LandingPage.css + .jsx: ~5% / 95% — LandingPage.jsx implements the entire page via 58 inline `style={{}}` blocks while LandingPage.css defines matching class names (`.landing-hero`, `.landing-nav`, etc.) that are never applied to any JSX element — a parallel dead CSS layer

**States checklist:**
- MyPage.css: `outline: none` on `.mypage-lang-select` with no custom focus replacement — focus indicator actively removed, no substitute
- `.faq-item.open` class emitted in JSX (LandingPage.jsx:9) but no CSS rule exists in LandingPage.css — class applied but never styled

**Animation count:** 6 @keyframes; 25+ transition properties. Duration values: 100, 120, 150, 200, 220, 250, 300, 500, 600ms — no unified timing token. `--transition: 150ms ease-out` defined in `index.css:56` but referenced in zero interactive elements.

**Breakpoints:** 4 @media queries, single breakpoint (768px). Mixed conventions: `max-width` in ChatPage.css + LandingPage.css vs `min-width` in MyPage.css. LandingPage.jsx hero grid and pricing grid (`gridTemplateColumns`) have no responsive fallback in inline styles — will overflow on mobile.

---

## Copy & Honesty Evidence

**Superlatives:** "instantly" ×2 (translations.js:6, 184), "within seconds" unqualified in i18n key (faq_a1), "never shared" absolute promise (faq_a4), "Everything you need" (features_title), "finally answerable" (landing_headline)

**Dark patterns:**
1. **False trial promise** — LandingPage.jsx:424–430: "Try Pro free for 14 days. No credit card required" — no trial implementation exists anywhere in the codebase. Clicking "Create free account" calls `onSignUp()`, not a trial checkout.
2. **Illustrative pricing buried** — LandingPage.jsx:354: "Pricing shown is illustrative" appears in 12px gray text after users have already clicked plan CTAs
3. **Undisclosed mailto on "Send message →"** — contact form submit (LandingPage.jsx:33–39) opens email client without disclosure; behavior only revealed post-click via `contact_sent` text
4. **Manual reward buried in footnote** — referral reward promise prominent (translations.js:210, 216), manual-issuance disclaimer only in `promo_note` after link already generated

**Label-behavior mismatches:**
1. "Manage plan" → opens `mailto:support@lexara.app` (MyPage.jsx:308–313) — not a self-service portal
2. "Contact sales" → calls `onSignUp()`, creating a free account (LandingPage.jsx:344, 441)
3. "Send message →" → opens email client (LandingPage.jsx:33–39)
4. "Choose Pro" / "Try Pro free for 14 days" → no trial implementation; onSignUp fires

**Factual mismatch:** Pro plan = 1,000 queries/month enforced (MyPage.jsx:20) vs 2,000 queries shown on landing page pricing grid (LandingPage.jsx:342). Business plan ($49/mo, MyPage.jsx:284) has no corresponding entry on landing page — replaced by "Enterprise".

**Jargon (10 instances):** "LLM key", "semantic search", "sentence embeddings", "chunks", "retrieval only", "Top-K", "Indexed/Indexing", "Grounded responses with retrieval fallback mode", "tokens" (usage metric), "SSO/SAML"

**Plan limits disclosure gap:** workspace/document limits hardcoded in Uzbek only in PLAN_FEATURES (MyPage.jsx:31–51); not via i18n keys; invisible in all other languages

---

## Weight & Friction Evidence

**JS bundle:** 384 KB (single chunk, no code splitting)  
**CSS bundle:** 50 KB  
**p5.js CDN:** ~870 KB (unconditional, LandingPage.jsx:124; no prefers-reduced-motion gate; 120-particle draw loop at 60fps from page load)  
**Total landing page JS payload: ~1.25 MB**

**External scripts:** p5.js (decorative), @vercel/analytics, @vercel/speed-insights, @sentry/react (all bundled)

**Idle animations on landing:** p5.js canvas runs unconditionally at 60fps. No prefers-reduced-motion check. No IntersectionObserver gate. Zero informational value — purely decorative.

**Steps to first query: 9** — register (4 fields) → verify → upload document → type question → send. No guest/demo mode. No pre-loaded sample document.

**Dependency count:** 6 prod / 14 dev
