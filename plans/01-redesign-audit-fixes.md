# Plan: Lexara Redesign — Audit Fix Implementation

**Source:** DESIGN-IS-2026-05-29 audit (10/30 → target ≥ 20/30)  
**Scope:** LandingPage, MyPage, RegisterPage, translations.js, vite.config.js  
**DO NOT TOUCH:** ChatPage.jsx, ChatPage.css, ChatMessage.jsx, any backend file  
**Branch:** develop → PR to main after each phase

---

## Phase 0: Documentation Discovery (READ BEFORE EDITING)

Before any edit, read these exact file sections to confirm current state:

```bash
# Confirm token names (the source of truth for all CSS variable work)
grep -n "^  --lexara\|^  --font\|^  --shadow\|^  --radius\|^  --transition\|^  --ease" frontend/src/index.css

# Confirm current pricing numbers in both files
grep -n "queries\|2,000\|1,000\|1000\|2000" frontend/src/pages/LandingPage.jsx | head -10
grep -n "monthly_queries\|queries" frontend/src/pages/MyPage.jsx | head -10

# Confirm exact line of alert() to replace
grep -n "alert(" frontend/src/pages/MyPage.jsx

# Confirm p5.js injection block
grep -n "p5\|cdnjs\|_lexaraSketch" frontend/src/pages/LandingPage.jsx | head -5

# Confirm vite config has no splitting
cat frontend/vite.config.js

# Confirm isLoading prop in ChatMessage signature
grep -n "isLoading" frontend/src/components/ChatMessage.jsx | head -5
grep -n "isLoading" frontend/src/pages/ChatPage.jsx | head -5
```

**Allowed patterns (copy, don't invent):**
- CSS tokens: use only names confirmed by the grep above (`--lexara-blue`, `--lexara-bg`, `--lexara-text`, `--lexara-text-secondary`, `--lexara-border`, `--lexara-white`, `--lexara-surface`, `--shadow-sm`, `--shadow-md`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--transition`, `--ease-out`)
- Vite code splitting: `build.rollupOptions.output.manualChunks` — see vite docs pattern below
- React lazy: `const X = React.lazy(() => import('./X'))` wrapped in `<Suspense fallback={null}>`

---

## Phase 1 — Honesty Fixes (Priority #1, ship first)

**Rationale:** Two separate screens show contradictory pricing. A modal promises a 14-day trial that doesn't exist. Three buttons do the opposite of what their label says. These must be fixed before any visual changes ship — shipping a redesigned landing page with false pricing would be worse than the current state.

### 1.1 — Fix Pro query count mismatch

**File:** `frontend/src/pages/LandingPage.jsx`

Find the pricing grid (line ~342). The Pro card lists `'2,000 queries'`. Change to `'1,000 queries'`.

```jsx
// BEFORE (LandingPage.jsx ~342):
['Pro', '$19/mo', ['2,000 queries', 'Usage analytics', 'Priority support'], 'Choose Pro', true],

// AFTER:
['Pro', '$19/mo', ['1,000 queries/month', 'Usage analytics', 'Priority support'], 'Choose Pro', true],
```

Also add Business plan back (it exists in MyPage checkout but is absent from the landing page — users upgrading to Business have no pricing reference):

```jsx
// Replace the 3-plan array with 4 plans, or at minimum update the Enterprise card to match Business:
['Business', '$49/mo', ['5,000 queries/month', 'Unlimited workspaces', 'Priority support'], 'Choose Business', false],
```

**Verification:**
```bash
grep -n "queries" frontend/src/pages/LandingPage.jsx | grep -v "//"
# Must show "1,000 queries/month" not "2,000 queries"
```

### 1.2 — Remove false 14-day trial promise

**File:** `frontend/src/pages/LandingPage.jsx` (line ~424–430, pricing modal)

The `pricingModal === 'Pro'` branch shows "Start your 14-day trial" / "Try Pro free for 14 days. No credit card required." No trial implementation exists. Replace with honest copy:

```jsx
// BEFORE (LandingPage.jsx ~423–430):
{pricingModal === 'Free' ? 'Start for free' : pricingModal === 'Pro' ? 'Start your 14-day trial' : 'Get in touch'}
// ...
{pricingModal === 'Free'
  ? 'Create a free account...'
  : pricingModal === 'Pro'
  ? 'Try Pro free for 14 days. No credit card required to start. Cancel anytime.'
  : "Enterprise plans are custom-priced..."}

// AFTER:
{pricingModal === 'Free' ? 'Start for free' : pricingModal === 'Pro' ? 'Upgrade to Pro' : pricingModal === 'Business' ? 'Upgrade to Business' : 'Contact us'}
// ...
{pricingModal === 'Free'
  ? 'Create a free account to get 50 queries/month and 1 workspace, no credit card required.'
  : pricingModal === 'Pro'
  ? 'Get 1,000 queries/month and 5 workspaces. Billed monthly via Paddle. Cancel anytime from your profile.'
  : pricingModal === 'Business'
  ? 'Get 5,000 queries/month and unlimited workspaces. Billed monthly via Paddle.'
  : 'Need a custom plan? Create an account and email us at support@lexara.app.'}
```

**Verification:**
```bash
grep -n "14-day\|trial\|No credit card required" frontend/src/pages/LandingPage.jsx
# Must return zero matches
```

### 1.3 — Fix "Contact sales" → contacts someone

**File:** `frontend/src/pages/LandingPage.jsx` (lines ~344, 441)

"Contact sales" currently calls `onSignUp()` (creates a free account). Fix: change the Enterprise modal CTA to `window.open('mailto:support@lexara.app?subject=Enterprise plan inquiry')` instead of `onSignUp()`.

```jsx
// In the pricing modal, for Enterprise/Contact us branch:
// BEFORE:
<button onClick={() => { setPricingModal(null); onSignUp(); }}>
  Create free account →
</button>
// AFTER (Enterprise branch only):
<button onClick={() => { setPricingModal(null); window.open('mailto:support@lexara.app?subject=Enterprise plan inquiry'); }}>
  Email us →
</button>
```

Also update the Enterprise pricing card CTA label in the grid from `'Contact sales'` to `'Contact us'` to remove the "sales" implication.

**Verification:**
```bash
grep -n "Contact sales\|onSignUp" frontend/src/pages/LandingPage.jsx | head -10
# "Contact sales" label should be gone; onSignUp should not appear in Enterprise modal branch
```

### 1.4 — Fix "Manage plan" button

**File:** `frontend/src/pages/MyPage.jsx` (lines 308–314)

Currently opens `mailto:support@lexara.app?subject=Reja boshqaruvi` (Uzbek hardcoded). Change to a clearly labeled email action or remove it:

```jsx
// BEFORE (MyPage.jsx:308–314):
<button
  className="mypage-signout-btn"
  style={{ marginTop: 12 }}
  onClick={() => window.open('mailto:support@lexara.app?subject=Reja boshqaruvi')}
>
  {t('manage_plan') || 'Rejani boshqarish'}
</button>

// AFTER: Change the onClick and label to be honest
<button
  className="mypage-signout-btn"
  style={{ marginTop: 12 }}
  onClick={() => window.open('mailto:support@lexara.app?subject=Plan management request')}
>
  {t('email_support_to_change_plan') || 'Email us to change plan'}
</button>
```

Add translation key `email_support_to_change_plan` to all 5 language blocks in translations.js:
- en: `'Email us to change plan'`
- ko: `'플랜 변경 문의 이메일'`
- ru: `'Написать нам для смены плана'`
- uz: `'Rejani o\'zgartirish uchun yozing'`
- ja: `'プラン変更についてメールする'`

**Verification:**
```bash
grep -n "Reja boshqaruvi\|manage_plan" frontend/src/pages/MyPage.jsx
# "Reja boshqaruvi" must be gone
grep -n "email_support_to_change_plan" frontend/src/i18n/translations.js | wc -l
# Must be 5 (one per language)
```

### 1.5 — Disclose contact form email behavior upfront

**File:** `frontend/src/pages/LandingPage.jsx` (ContactForm component, lines ~27–77)

Add a note below the form that sets expectations before submit. The current submit button says "Send message →" but opens the email client. Change the button label to be honest:

```jsx
// BEFORE (LandingPage.jsx ~70–74):
<button type="submit" className="landing-btn-primary">
  {sent ? (t('contact_sent') || 'Opening email client...') : (t('contact_send') || 'Send message →')}
</button>

// AFTER:
<button type="submit" className="landing-btn-primary" disabled={sent}>
  {sent ? (t('contact_sent') || 'Email client opened ✓') : (t('contact_send') || 'Open email client →')}
</button>
<p className="contact-form-note">
  {t('contact_note') || 'This opens your email app with a pre-filled message to support@lexara.app'}
</p>
```

Add `contact_note` and update `contact_send` in all 5 language blocks:
- en: `contact_send: 'Open email client →'`, `contact_note: 'Opens your email app with a pre-filled message to support@lexara.app'`
- (equivalent in ko, ru, uz, ja)

Also add `.contact-form-note` CSS to LandingPage.css:
```css
.contact-form-note {
  font-size: 11px;
  color: var(--lexara-text-tertiary, #a09890);
  margin: 2px 0 0;
  text-align: center;
}
```

**Anti-pattern guard:** Do NOT change the mailto behavior itself — just make it disclosed. Do NOT add a backend email endpoint that doesn't exist.

**Verification:**
```bash
grep -n "contact_note\|contact_send\|Open email" frontend/src/i18n/translations.js | head -6
grep -n "contact-form-note" frontend/src/styles/LandingPage.css
```

### 1.6 — Commit Phase 1

```bash
git add frontend/src/pages/LandingPage.jsx
git add frontend/src/pages/MyPage.jsx
git add frontend/src/i18n/translations.js
git add frontend/src/styles/LandingPage.css
git commit -m "fix(honesty): kill false trial promise, fix 2000→1000 query count, honest contact labels"
git push origin develop
```

---

## Phase 2 — Thoroughness Fixes (States + Accessibility)

**Rationale:** MyPage has 5 missing/broken UI states. The focus indicator is actively removed. A CSS class is emitted in JSX but never defined. A dead prop creates a code path that can never render.

### 2.1 — Restore MyPage focus indicator

**File:** `frontend/src/styles/MyPage.css` (line 182)

```css
/* BEFORE: */
.mypage-lang-select {
  ...
  outline: none;   /* ← accessibility failure */
}

/* AFTER: remove outline: none, add :focus rule */
.mypage-lang-select {
  ...
  /* outline removed — see :focus rule below */
}

.mypage-lang-select:focus {
  outline: 2px solid var(--lexara-blue, #2356d8);
  outline-offset: 2px;
}
```

Apply the same pattern to every other interactive element in MyPage.css that has `outline: none` without a `:focus` replacement.

**Verification:**
```bash
grep -n "outline: none" frontend/src/styles/MyPage.css
# Must return zero results
grep -n ":focus" frontend/src/styles/MyPage.css | head -5
# Must show at least the lang-select focus rule
```

### 2.2 — Replace alert() with inline error state in MyPage

**File:** `frontend/src/pages/MyPage.jsx` (line ~142)

Add an `upgradeError` state and render it inline instead of using `alert()`:

```jsx
// Add state near top of component (after existing useState calls):
const [upgradeError, setUpgradeError] = useState('');

// In handleUpgrade catch block, replace alert() with:
// BEFORE (MyPage.jsx:142):
alert(t('checkout_error') || 'Could not open checkout. Please try again.');

// AFTER:
setUpgradeError(t('checkout_error') || 'Could not open checkout. Please try again.');
setTimeout(() => setUpgradeError(''), 5000);
```

Render the error near the upgrade buttons (in the subscription tab JSX):
```jsx
{upgradeError && (
  <div className="mypage-error-banner">{upgradeError}</div>
)}
```

Add CSS to MyPage.css:
```css
.mypage-error-banner {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fef2f2;
  border: 0.5px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  font-size: 12px;
  color: #b91c1c;
}
```

**Verification:**
```bash
grep -n "alert(" frontend/src/pages/MyPage.jsx
# Must return zero matches
grep -n "upgradeError\|mypage-error-banner" frontend/src/pages/MyPage.jsx | head -5
```

### 2.3 — Add loading skeleton to MyPage

**File:** `frontend/src/pages/MyPage.jsx` + `frontend/src/styles/MyPage.css`

The `loading` state already exists (MyPage.jsx:58). Add a skeleton render branch:

```jsx
// In MyPage JSX, replace the loading check (currently no visible loading UI):
if (loading) {
  return (
    <div className="mypage-wrap">
      <div className="mypage-skeleton-card" />
      <div className="mypage-skeleton-card mypage-skeleton-short" />
      <div className="mypage-skeleton-card" />
    </div>
  );
}
```

Add CSS:
```css
.mypage-skeleton-card {
  height: 120px;
  background: linear-gradient(90deg, var(--lexara-bg, #f7f5f0) 25%, var(--lexara-bg-secondary, #f0ede8) 50%, var(--lexara-bg, #f7f5f0) 75%);
  background-size: 200% 100%;
  animation: skeleton-sweep 1.4s ease infinite;
  border-radius: var(--radius-md, 10px);
}

.mypage-skeleton-short { height: 80px; }

@keyframes skeleton-sweep {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Verification:**
```bash
grep -n "mypage-skeleton\|skeleton-sweep" frontend/src/styles/MyPage.css
grep -n "if (loading)" frontend/src/pages/MyPage.jsx
```

### 2.4 — Add empty zero state for stats

**File:** `frontend/src/pages/MyPage.jsx` (stats section, lines ~190–211)

When `stats.total_queries === 0`, show a prompt instead of a progress bar at zero:

```jsx
// In the stats section, wrap the bar:
{stats.total_queries === 0 ? (
  <div className="mypage-stat-empty">
    {t('no_queries_yet') || 'No queries yet — ask your first question in the chat.'}
  </div>
) : (
  <div className="mypage-bar-wrap">...</div>
)}
```

Add CSS:
```css
.mypage-stat-empty {
  font-size: 12px;
  color: var(--lexara-text-secondary, #6b6560);
  font-style: italic;
  padding: 4px 0;
}
```

Add `no_queries_yet` to all 5 language blocks in translations.js.

**Verification:**
```bash
grep -n "no_queries_yet\|mypage-stat-empty" frontend/src/pages/MyPage.jsx
grep -n "no_queries_yet" frontend/src/i18n/translations.js | wc -l  # must be 5
```

### 2.5 — Migrate PLAN_FEATURES to i18n keys

**File:** `frontend/src/pages/MyPage.jsx` (PLAN_FEATURES object, lines 31–52)

Currently:
```js
const PLAN_FEATURES = {
  free: { name: 'Free', features: ['50 so\'rov/oy', '1 ish maydoni', '5 hujjat'] },  // Uzbek hardcoded
  ...
}
```

Replace with translation key references:
```js
const getPlanFeatures = (t) => ({
  free: { 
    name: t('plan_free_name') || 'Free', 
    features: [t('plan_free_f1') || '50 queries/month', t('plan_free_f2') || '1 workspace', t('plan_free_f3') || '5 documents'] 
  },
  pro: { 
    name: t('plan_pro_name') || 'Pro', 
    features: [t('plan_pro_f1') || '1,000 queries/month', t('plan_pro_f2') || '5 workspaces', t('plan_pro_f3') || 'Usage analytics'] 
  },
  business: { 
    name: t('plan_business_name') || 'Business', 
    features: [t('plan_business_f1') || '5,000 queries/month', t('plan_business_f2') || 'Unlimited workspaces', t('plan_business_f3') || 'Priority support'] 
  },
});
```

Then call `const PLAN_FEATURES = getPlanFeatures(t)` inside the component (after `const { t } = useTranslation()`).

Add 9 new i18n keys (`plan_free_name`, `plan_free_f1`, `plan_free_f2`, `plan_free_f3`, `plan_pro_name`, `plan_pro_f1–f3`, `plan_business_name`, `plan_business_f1–f3`) to all 5 language blocks.

**Verification:**
```bash
grep -n "so'rov\|ish maydoni\|hujjat" frontend/src/pages/MyPage.jsx
# Must return zero — no Uzbek hardcoded strings remain
grep -n "plan_free_name\|plan_pro_f1" frontend/src/i18n/translations.js | wc -l  # must be 10 (5 lang × 2 samples)
```

### 2.6 — Fix dead .faq-item.open CSS selector

**File:** `frontend/src/styles/LandingPage.css`

The class is emitted at `LandingPage.jsx:9` but no CSS rule exists:
```css
/* Add to LandingPage.css: */
.faq-item.open .faq-question {
  color: var(--lexara-blue, #2356d8);
}

.faq-item.open {
  border-bottom-color: rgba(35, 86, 216, 0.15);
}
```

### 2.7 — Add contact form error and disabled states

**File:** `frontend/src/styles/LandingPage.css`

```css
.contact-input:invalid:not(:placeholder-shown) {
  border-color: rgba(239, 68, 68, 0.5);
}

.contact-input:invalid:not(:placeholder-shown):focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.08);
}

.landing-btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
```

### 2.8 — Remove dead isLoading prop from ChatMessage

**File:** `frontend/src/components/ChatMessage.jsx` (line 94) and `frontend/src/pages/ChatPage.jsx`

The `isLoading` prop is declared in ChatMessage's signature but never passed by ChatPage. Two options — pick option A (safer):

**Option A:** Remove `isLoading` from ChatMessage's prop signature and its conditional branch (the typing bubble on isLoading is handled separately by ChatPage's own loading state, never via this prop):

```jsx
// BEFORE (ChatMessage.jsx:94):
export default function ChatMessage({ role, content, sources, isLoading, mode, isStreaming, timestamp }) {

// AFTER: remove isLoading from signature and its branch (lines ~112–122)
export default function ChatMessage({ role, content, sources, mode, isStreaming, timestamp }) {
```

Remove the `if (isLoading) { return <typing-bubble> }` branch entirely since it never fires.

**Verification:**
```bash
grep -n "isLoading" frontend/src/components/ChatMessage.jsx
# Must return zero matches
```

### 2.9 — Commit Phase 2

```bash
git add frontend/src/pages/MyPage.jsx
git add frontend/src/styles/MyPage.css
git add frontend/src/styles/LandingPage.css
git add frontend/src/components/ChatMessage.jsx
git add frontend/src/i18n/translations.js
git commit -m "fix(thorough): MyPage states, focus indicator, i18n plan features, dead prop, FAQ open style"
git push origin develop
```

---

## Phase 3 — Environmental Fixes (Weight + Motion)

**Rationale:** Every visitor to the landing page downloads ~870 KB of p5.js on top of the 384 KB app bundle. The animation runs at 60fps unconditionally with no prefers-reduced-motion gate. Route-level splitting will cut the initial bundle for users who land on the chat page directly.

### 3.1 — Remove p5.js particle canvas entirely

**File:** `frontend/src/pages/LandingPage.jsx`

Delete the entire `useEffect` block that injects p5.js (lines ~122–200). Also delete the canvas element from JSX.

```jsx
// DELETE the entire useEffect at lines ~122–200:
useEffect(() => {
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/...';
  // ... entire block
}, []);

// DELETE this from JSX (~line 253):
<canvas id="lexara-hero-canvas" style={{...}} />
```

Replace the hero section with a static CSS gradient background. Add to LandingPage.css:
```css
.landing-hero-bg {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 80% 60% at 60% 40%, rgba(35, 86, 216, 0.06) 0%, transparent 70%),
              radial-gradient(ellipse 60% 80% at 20% 80%, rgba(124, 58, 237, 0.04) 0%, transparent 70%);
  pointer-events: none;
}
```

Add `<div className="landing-hero-bg" />` inside the hero section div (replacing the canvas element).

The hero section div needs `position: relative` — confirm it has this (it does, per audit evidence).

**Anti-pattern guard:** Do NOT keep p5.js "but smaller" or "lazy loaded." Remove it entirely. The canvas provides zero navigational or informational value.

**Verification:**
```bash
grep -n "p5\|cdnjs\|lexara-hero-canvas\|_lexaraSketch" frontend/src/pages/LandingPage.jsx
# Must return zero matches
```

### 3.2 — Add prefers-reduced-motion gate to scroll reveals

**File:** `frontend/src/pages/LandingPage.jsx` (IntersectionObserver useEffect, lines ~97–110)

```jsx
// BEFORE (LandingPage.jsx ~97–110):
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
  ...
}, []);

// AFTER:
useEffect(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  if (prefersReducedMotion) {
    // Skip animation entirely — make all reveals visible immediately
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0px)';
        }
      });
    },
    { threshold: 0.15 },
  );
  const nodes = document.querySelectorAll('[data-reveal]');
  nodes.forEach((n) => observer.observe(n));
  return () => observer.disconnect();
}, []);
```

**Verification:**
```bash
grep -n "prefers-reduced-motion" frontend/src/pages/LandingPage.jsx
# Must return at least 1 match
```

### 3.3 — Implement route-level code splitting

**File:** `frontend/src/App.jsx` + `frontend/vite.config.js`

App.jsx uses manual state routing — not React Router — but React.lazy() still works. Wrap the heavy page components:

```jsx
// BEFORE (App.jsx:2–10 — all static imports):
import LandingPage from './pages/LandingPage';
import ChatPage from './pages/ChatPage';
import MyPage from './pages/MyPage';
import AdminPage from './pages/AdminPage';

// AFTER — lazy load everything except the auth screens (lightweight):
import React, { lazy, Suspense } from 'react';
const LandingPage = lazy(() => import('./pages/LandingPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const MyPage = lazy(() => import('./pages/MyPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
// Keep LoginPage + RegisterPage as static imports (they're small, they're the initial screen)
```

Wrap the page render in App.jsx with Suspense:
```jsx
// In App.jsx render, wrap the conditional page output:
<Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><span style={{ color: '#9d9b96', fontSize: 14 }}>Loading…</span></div>}>
  {/* existing page conditionals here */}
</Suspense>
```

Add Vite chunk naming to `vite.config.js`:
```js
// vite.config.js additions:
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom'],
        'vendor-sentry': ['@sentry/react'],
        'vendor-analytics': ['@vercel/analytics', '@vercel/speed-insights'],
      },
    },
  },
},
```

**Verification:**
```bash
cd frontend && npm run build 2>&1 | grep -E "\.js|\.css|kB"
# Should show multiple JS chunks instead of one monolithic file
# LandingPage chunk should be ~60–80 KB, not 384 KB
```

### 3.4 — Commit Phase 3

```bash
git add frontend/src/pages/LandingPage.jsx
git add frontend/src/App.jsx
git add frontend/vite.config.js
git commit -m "fix(eco): remove p5.js canvas (870KB), add prefers-reduced-motion, route-level code splitting"
git push origin develop
```

---

## Phase 4 — Aesthetic Fixes (Token Migration + Type Scale)

**Rationale:** MyPage.css uses zero CSS variables. LandingPage.jsx has 58 inline `style={{}}` blocks alongside unused CSS class definitions. 5 near-identical off-whites are used for the same background role. 18 font sizes with no system.

### 4.1 — Connect MyPage.css to --lexara-* tokens

**File:** `frontend/src/styles/MyPage.css`

Replace hardcoded hex values with the token names confirmed in Phase 0. Key replacements:

| Hardcoded | Token | Usage in MyPage.css |
|-----------|-------|---------------------|
| `#ffffff` | `var(--lexara-white)` | header-card bg, section-card bg, lang-select bg |
| `#1a1814` | `var(--lexara-text)` | mypage-name, info-val, tab-btn active color |
| `#6b6860` | `var(--lexara-text-secondary)` | email, stat-label, step-text |
| `#9d9b96` | `var(--lexara-text-tertiary)` | section-title, stat-sub, promo-note |
| `rgba(0,0,0,0.1)` | `var(--lexara-border-strong)` | card borders |
| `rgba(0,0,0,0.08)` | `var(--lexara-border)` | dividers, tab border-top |
| `#2356d8` | `var(--lexara-blue)` | role-badge color, step-num bg, upgrade-btn.pro |
| `#e8eefb` | `var(--lexara-blue-light)` | role-badge bg |

Replace each instance using the token. Do not change values — only substitute equivalent hardcoded → variable.

**Verification:**
```bash
grep -c "#[0-9a-fA-F]\{3,6\}" frontend/src/styles/MyPage.css
# Should be significantly lower than current count (~22 → target < 5 non-substitutable values)
grep -c "var(--lexara" frontend/src/styles/MyPage.css
# Should be > 15
```

### 4.2 — Migrate LandingPage.jsx cosmetic inline styles to CSS classes

**Files:** `frontend/src/pages/LandingPage.jsx` + `frontend/src/styles/LandingPage.css`

This is the largest change in Phase 4. The landing page has 58 `style={{}}` blocks; ~40 are cosmetic (colors, typography, spacing that should be in CSS).

**Strategy:** Section by section, move cosmetic props to the corresponding CSS class that already exists in LandingPage.css but is never applied.

For each section, add the CSS class name to the JSX div, then move the cosmetic styles to LandingPage.css:

**Nav section** (LandingPage.jsx:216–221 inline styles):
- Add `className="landing-nav"` to the `<nav>` tag  
- Keep ONLY the scroll-reactive styles as inline (since they change on state): `background`, `backdropFilter`, `borderBottom`, `transition` — these must stay inline because they depend on `scrolled` state
- Move static nav styles (`position: sticky`, `top: 0`, `zIndex: 50`, `padding: 14px 32px`) to `.landing-nav` in CSS (some may already be there)

**Hero section** (LandingPage.jsx:252 inline styles):
- Add `className="landing-hero-section"` to the section div
- Move `maxWidth`, `margin`, `padding`, `display`, `gridTemplateColumns`, `gap`, `position`, `overflow` to CSS

**Feature cards** (LandingPage.jsx:329):
- Add `className="landing-feature-card"` + `data-reveal` (already there via spread)
- Move background, border, borderRadius, padding to CSS per `.landing-feature-card:nth-child(odd)` / `even`

**Pricing section** (LandingPage.jsx:339):
- Add `className="landing-pricing"` to the section
- Move `background`, `color`, `padding` to `.landing-pricing` in CSS

**CTA section, footer, modal** — same pattern.

**Rule:** Styles that depend on JavaScript state (`scrolled`, `pricingModal`, `reveal` spread) MUST stay inline. Everything else moves to CSS.

After migration, LandingPage.jsx should have at most 10–15 inline style blocks (all dynamic/state-driven).

**Verification:**
```bash
grep -c "style={{" frontend/src/pages/LandingPage.jsx
# Must be < 15 (down from 58)
npm run build  # must succeed with zero errors
```

### 4.3 — Consolidate off-white variants

**Files:** `frontend/src/pages/LandingPage.jsx`, `frontend/src/styles/LandingPage.css`

Five values (#faf9f7, #f8f6f1, #f7f7f6, #f6f7fb, #f7f5f0) serve the same background role. After Phase 4.2 moves inline styles to CSS, do a find-replace:

- `#faf9f7` → `var(--lexara-bg)` 
- `#f8f6f1` → `var(--lexara-bg)`
- `#f7f7f6` → `var(--lexara-bg)`
- `#f6f7fb` → `var(--lexara-bg-secondary)` (slightly darker, used for inset mockup bg)
- `#f7f5f0` is `--lexara-bg` definition itself — no change needed in index.css

Also unify the secondary text grays:
- `#6b6860`, `#6b6560`, `#5a5650` → `var(--lexara-text-secondary)`
- `#8a847c` → `var(--lexara-text-tertiary)`
- `#6b7280` (Tailwind intruder in ChatMessage.css) → `var(--lexara-text-secondary)`

**Verification:**
```bash
grep -rn "#faf9f7\|#f8f6f1\|#f7f7f6\|#f6f7fb" frontend/src/
# Must return zero — all replaced by var(--lexara-bg) or var(--lexara-bg-secondary)
grep -rn "#6b6560\|#6b6860\|#5a5650\|#8a847c\|#6b7280" frontend/src/
# Must return zero
```

### 4.4 — Reduce type scale from 18 to 7 sizes

**Target scale:** `11px, 13px, 14px, 16px, 22px, 28px, 42px`

**Orphan → replacement mapping:**
- `10px` → `11px` (monospace meta labels — slight increase)
- `15px` → `16px` (body base in index.css — change html font-size)
- `18px` → `16px` (sidebar toggle, avatar font-size) or `22px` if it's a display element
- `20px` → `22px` (empty headline, modal h3)
- `24px` → `22px` (landing-section-title) or `28px`
- `30px` → `28px` (inline h3 LandingPage.jsx:393)
- `32px` → `28px` (pricing display)
- `36px` → `42px` (promo emoji icon — display only)
- `68px` → `42px` (hero h1 — current 68px is massive for a SaaS tool, 42px matches the declared CSS class)

**Anti-pattern guard:** When changing the hero h1, remove the inline `fontSize: 68` (LandingPage.jsx:256) and let the CSS class `.landing-hero-headline` at `LandingPage.css:127` take effect. The CSS class already declares 42px — this is the correct value to use.

**Verification:**
```bash
grep -rn "font-size: 30\|font-size: 32\|font-size: 68\|font-size: 20\|fontSize: 68\|fontSize: 30\|fontSize: 32\|fontSize: 20" frontend/src/
# Must return zero matches
```

### 4.5 — Commit Phase 4

```bash
git add frontend/src/pages/LandingPage.jsx
git add frontend/src/styles/LandingPage.css
git add frontend/src/styles/MyPage.css
git add frontend/src/index.css
git commit -m "refactor(aesthetic): migrate landing inline styles to CSS, unify off-whites/grays to tokens, 18→7 type scale, connect MyPage to --lexara-* system"
git push origin develop
```

---

## Phase 5 — Usability Improvements (Friction Reduction)

**Rationale:** 9 steps to first query is too many. Making Full Name optional drops one required field. A demo path removes the registration barrier entirely for discovery users.

### 5.1 — Make Full Name optional in RegisterPage

**File:** `frontend/src/pages/RegisterPage.jsx`

Change Full Name from required to optional:
```jsx
// Find the Full Name input (line ~88–93):
// BEFORE: required, shown as mandatory
// AFTER: add optional label, remove `required` attribute

<label className="auth-label">
  {t('full_name_label') || 'Full name'} <span className="auth-optional">{t('optional') || '(optional)'}</span>
</label>
<input
  type="text"
  // ... other props
  // REMOVE: required
/>
```

Add `optional` and `full_name_label` i18n keys to all 5 language blocks.

Add CSS to the auth styles:
```css
.auth-optional {
  font-size: 11px;
  color: var(--lexara-text-tertiary, #a09890);
  font-weight: 400;
}
```

**Verification:**
```bash
grep -n 'required' frontend/src/pages/RegisterPage.jsx | grep -i "full\|name"
# Must return zero (Full Name no longer required)
```

### 5.2 — Add "Try a demo" path on landing page

**File:** `frontend/src/pages/LandingPage.jsx` + `frontend/src/App.jsx`

Add a secondary CTA below the primary sign-up button in the hero:

```jsx
// In hero section, after primary CTA buttons:
<div style={{ display: 'flex', gap: 12 }}>
  <button onClick={onSignUp} className="landing-btn-primary-lg">
    {t('landing_cta_primary')}
  </button>
  <button onClick={onSignIn} className="landing-btn-secondary-lg">
    {t('landing_cta_secondary')}
  </button>
</div>
// Add below:
<button
  className="landing-demo-link"
  onClick={onTryDemo}
>
  {t('landing_try_demo') || 'Try with a sample document →'}
</button>
```

**App.jsx:** Add an `onTryDemo` prop handler that navigates directly to the chat page with a flag indicating demo mode (no auth required for demo):
```jsx
// In App.jsx, add to the LandingPage props:
onTryDemo={() => {
  // Set demo mode: bypass auth, load a pre-indexed sample workspace
  setDemoMode(true);
  navigate('app');
}}
```

**Note:** Demo mode backend requires a public/guest workspace with a pre-uploaded sample document. If this doesn't exist in the backend yet, scope this to Phase 5 only as the frontend affordance (button present, clicking opens RegisterPage with a note "or explore the demo below" — get the backend demo workspace set up separately). Do not invent backend APIs.

**Verification:**
```bash
grep -n "onTryDemo\|landing_try_demo\|Try with a sample" frontend/src/pages/LandingPage.jsx
```

### 5.3 — Run full build + check

```bash
cd frontend && npm run build 2>&1
# Must succeed with zero errors
# Check chunk sizes in output — LandingPage chunk should be < 150 KB (vs previous 384 KB monolith)
```

### 5.4 — Commit Phase 5 + merge to main

```bash
git add frontend/src/pages/RegisterPage.jsx
git add frontend/src/pages/LandingPage.jsx
git add frontend/src/App.jsx
git add frontend/src/i18n/translations.js
git commit -m "feat(usability): optional full name field, landing demo CTA, reduced registration friction"
git push origin develop
git checkout main && git pull origin develop && git push origin main && git checkout develop
```

---

## Phase 6 — Final Verification

Run all checks to confirm the redesign hit its targets:

```bash
# 1. Honesty checks
grep -n "14-day\|trial\|No credit card required" frontend/src/pages/LandingPage.jsx
# → must be zero

grep -n "2,000 queries\|2000 queries" frontend/src/pages/LandingPage.jsx
# → must be zero (all show 1,000)

grep -n "alert(" frontend/src/pages/MyPage.jsx
# → must be zero

grep -rn "so'rov\|ish maydoni\|hujjat" frontend/src/pages/MyPage.jsx
# → must be zero (no hardcoded Uzbek)

# 2. Accessibility checks
grep -n "outline: none" frontend/src/styles/MyPage.css
# → must be zero

grep -n ":focus" frontend/src/styles/MyPage.css
# → must show focus rules

# 3. Environmental checks
grep -n "p5\|cdnjs\|_lexaraSketch" frontend/src/pages/LandingPage.jsx
# → must be zero

grep -n "prefers-reduced-motion" frontend/src/pages/LandingPage.jsx
# → must show gate

# 4. Build check with chunk sizes
cd frontend && npm run build 2>&1 | grep -E "\.js\b"
# → must show multiple chunks (not one 384KB monolith)

# 5. Token check
grep -c "var(--lexara" frontend/src/styles/MyPage.css
# → must be > 10

grep -c "style={{" frontend/src/pages/LandingPage.jsx
# → must be < 15

# 6. Type scale check
grep -rn "fontSize: 68\|fontSize: 30\|font-size: 30px\|font-size: 68px" frontend/src/
# → must be zero
```

---

## Regression Checklist (ChatPage must NOT change)

After all phases, verify ChatPage is untouched:

```bash
git diff HEAD~5 -- frontend/src/pages/ChatPage.jsx
# Must show zero changes

git diff HEAD~5 -- frontend/src/styles/ChatPage.css
# Must show zero changes
```

---

## Out of Scope

- ChatPage.jsx, ChatPage.css (do not touch)
- ChatMessage.jsx source card visual design (only dead prop removed)
- backend/ — all backend logic correct, no changes needed
- AdminPage.jsx
- A/B testing or feature flags — ship the redesign as a direct replacement
- Building a real trial billing flow — removing the false promise is the fix; adding trial requires separate Paddle configuration

---

## Expected Score After This Plan

| # | Principle | Before | After | Change |
|---|-----------|--------|-------|--------|
| 1 | Innovative | 2 | 2 | → |
| 2 | Useful | 1 | 2 | +1 (demo path, fewer fields) |
| 3 | Aesthetic | 1 | 2 | +1 (token system, type scale, no inline style parallel) |
| 4 | Understandable | 1 | 2 | +1 (jargon partially addressed via i18n plan names) |
| 5 | Unobtrusive | 2 | 2 | → |
| 6 | Honest | 0 | 2 | +2 (false trial removed, count aligned, labels honest) |
| 7 | Long-lasting | 1 | 2 | +1 (p5.js removed, 68px hero removed) |
| 8 | Thorough | 0 | 2 | +2 (5 missing states restored, focus indicator restored) |
| 9 | Eco-friendly | 1 | 2 | +1 (p5.js gone, code splitting, reduced-motion) |
| 10 | Less is more | 1 | 2 | +1 (inline style system removed, off-white consolidated) |
| **Total** | | **10/30** | **21/30** | **+11** |

Target 21/30 clears the REFINE threshold (≥ 20) — moving from REDESIGN territory to a platform that can be iterated on with confidence.
