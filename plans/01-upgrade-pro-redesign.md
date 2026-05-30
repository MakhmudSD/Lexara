# Plan 01 — Upgrade-to-Pro Flow Redesign

**Source:** Dieter Rams audit DESIGN-IS-2026-05-30 — 9/30, REDESIGN verdict
**Principles fixed:** #6 Honest (0→3), #8 Thorough (0→3), #2 Useful (1→3), #9 Environmentally friendly (2→3)
**Principles preserved:** Everything else — brand tokens, three-card layout, Pro card highlight, authenticated Path B

---

## Phase 0 — Allowed APIs (Discovery Synthesis)

All findings from four parallel subagents. Every agent returned sources + verbatim code.

### Exact file locations

| File | Key content |
|---|---|
| `frontend/src/pages/LandingPage.jsx:517–554` | Pricing modal — full JSX, no states |
| `frontend/src/pages/LandingPage.jsx:427` | Free plan: `'100 queries/month'` (wrong — enforced is 50) |
| `frontend/src/pages/LandingPage.jsx:286` | Hero badge: `'Early access · 100 free queries'` |
| `frontend/src/pages/LandingPage.jsx:532` | Modal desc: `'...100 queries/month...'` |
| `frontend/src/pages/LandingPage.jsx:454, 534, 535, 550, 472` | Five "Cancel anytime" locations |
| `frontend/src/pages/LandingPage.jsx:538` | `onSignUp()` called with no plan param |
| `frontend/src/pages/LandingPage.jsx:157` | `LandingPage({ onSignIn, onSignUp, onPrivacy, onTerms })` |
| `frontend/src/styles/LandingPage.css:651–658` | `.landing-pricing-plan-name { color: rgba(255,255,255,0.6) }` |
| `frontend/src/styles/LandingPage.css:723–728` | `.landing-pricing-note { color: rgba(255,255,255,0.3) }` |
| `frontend/src/styles/LandingPage.css:1008–1018` | `.pricing-modal-btn` rules — no `:focus-visible` |
| `frontend/src/pages/App.jsx:34–40` | `navigate(newPage)` — 300ms transition |
| `frontend/src/pages/App.jsx:140` | RegisterPage `onSuccess={(user) => { setAuthUser(user); setPage('app'); }}` |
| `frontend/src/pages/App.jsx:150` | LoginPage `onLogin={(user) => { setAuthUser(user); setPage('app'); }}` |
| `frontend/src/pages/App.jsx:116–125` | LandingPage receives `onSignUp={() => navigate('register')}` |
| `frontend/src/pages/App.jsx:157–161` | `goAppSection(section)` sets `currentPage` |
| `frontend/index.html:12` | `<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>` — blocking, no defer |
| `frontend/src/pages/MyPage.jsx:20` | `PLAN_LIMITS.free.queries = 50` — enforced limit |
| `frontend/src/pages/MyPage.jsx:22` | `PLAN_LIMITS.business.workspaces = 999` — not unlimited |
| `frontend/src/pages/MyPage.jsx:37–41` | `PLAN_FEATURES_DEFAULTS` — free plan says `'50 queries/month'` ✓ |
| `frontend/src/pages/MyPage.jsx:156–157` | `upgradeLoading` and `upgradeError` state declarations |
| `frontend/src/pages/MyPage.jsx:199–249` | `handleUpgrade(plan)` full function |
| `frontend/src/pages/MyPage.jsx:191–197` | Paddle `Initialize` useEffect |
| `frontend/src/pages/MyPage.jsx:432` | `upgradeError` rendered in `plan !== 'free'` branch — BUG |
| `frontend/src/pages/MyPage.jsx:151` | `MyPage({ onLogout })` — single prop |
| `frontend/src/api/billing.js:3–6` | `createCheckout(plan)` — entire file, only function |
| `backend/app/routes/billing.py:59` | `POST /billing/checkout` — only billing route |
| `backend/app/routes/billing.py:115` | `POST /webhooks/paddle` — webhook handler |
| No cancel endpoint | Neither `POST /billing/cancel` nor frontend `cancelSubscription` exists |

### Confirmed constraints
- **No sessionStorage** currently exists anywhere in the codebase — safe to introduce
- **No `intendedPlan` prop** on MyPage or LandingPage currently — safe to add
- **Paddle cancel is webhook-only** — self-serve cancel requires either a new backend endpoint or honest copy change; for this plan we take the copy-change path (lower risk, no backend changes in scope)
- **`setPage('app')` after login bypasses `navigate()`** — 300ms fade does not fire on auth success

### Anti-patterns confirmed absent (do not invent these)
- No `sessionStorage` in any component — must be added fresh
- No `cancelSubscription` anywhere — do not call it
- No `intendedPlan` prop on MyPage — must be threaded through App.jsx → MyPage
- `onSignUp` accepts zero arguments — do not add a `plan` argument to it; use sessionStorage side-channel instead

---

## Phase 1 — Honesty: Copy & Data Alignment

**Goal:** Make every string in the pricing flow map 1:1 to actual behavior. No component restructuring.
**Files:** `LandingPage.jsx` only.
**Estimated lines changed:** ~10 string literals.

### 1a. Fix Free plan query limit (3 locations)

The enforced limit (`MyPage.jsx:20 PLAN_LIMITS.free.queries = 50`) and the FAQ (`LandingPage.jsx:468`) both say 50. Only the pricing grid and modal say 100.

| Location | Current | Change to |
|---|---|---|
| `LandingPage.jsx:427` | `'100 queries/month'` | `'50 queries/month'` |
| `LandingPage.jsx:532` | `'...100 queries/month, 1 workspace...'` | `'...50 queries/month, 1 workspace...'` |
| `LandingPage.jsx:286` | `'Early access · 100 free queries'` | `'Early access · 50 free queries'` |

**Do not** change `MyPage.jsx:20` or `MyPage.jsx:38` — they are already correct.

### 1b. Fix "Cancel anytime" false promise (5 locations)

Backend has no cancel endpoint. Frontend has no cancel button. Users must email support. The honest copy options are:
- **Option A (recommended):** `'Email support to cancel'` — matches actual behavior
- **Option B:** Implement a Paddle cancel flow — out of scope for this plan per scope definition

Replace all five "Cancel anytime…" occurrences:

| Location | Current | Change to |
|---|---|---|
| `LandingPage.jsx:454` | `'Billed monthly via Paddle · Cancel anytime from your profile'` | `'Billed monthly via Paddle · Email support to cancel'` |
| `LandingPage.jsx:534` (Pro modal desc) | `'...Cancel anytime from your profile.'` | `'...Email support@lexara.app to cancel.'` |
| `LandingPage.jsx:535` (Business modal desc) | `'...Cancel anytime.'` | `'...Email support@lexara.app to cancel.'` |
| `LandingPage.jsx:550` (modal note) | `'Cancel anytime from your profile page'` | `'Email support@lexara.app to cancel'` |
| `LandingPage.jsx:472` (FAQ faq_a6 fallback) | `'Yes. Cancel anytime from your profile page. You keep access until the end of your billing period.'` | `'Yes. Email support@lexara.app to cancel. You keep access until the end of your billing period.'` |

### 1c. Fix "Unlimited workspaces" — no copy change, add qualifier

`LandingPage.jsx:429` says `'Unlimited workspaces'` but `MyPage.jsx:22` enforces `workspaces: 999`. Options:
- Change to `'Up to 999 workspaces'` — accurate but ugly
- Change to `'Unlimited workspaces'` is acceptable marketing shorthand at 999; more pressing issue is "Cancel anytime"

**Decision:** Change to `'Unlimited workspaces*'` and add a `*` footnote to the pricing section note (same line as the Paddle billing note). This acknowledges the practical unlimited without a false claim. The footnote can read: `'* Subject to fair use limits'`.

| Location | Current | Change to |
|---|---|---|
| `LandingPage.jsx:429` Business feats array | `'Unlimited workspaces'` | `'Unlimited workspaces*'` |
| `LandingPage.jsx:454` (pricing note) | already being changed in 1b | Append ` · * Fair use limits apply` |

### Verification for Phase 1
```bash
# Confirm no "100 queries" in pricing surfaces
grep -n "100 queries" frontend/src/pages/LandingPage.jsx
# Expected: only appears in hero badge if left (but we're changing that too), otherwise 0 matches

# Confirm no "Cancel anytime" remains in LandingPage
grep -n "Cancel anytime" frontend/src/pages/LandingPage.jsx
# Expected: 0 matches

# Confirm "50 queries" now present in three locations
grep -n "50 queries" frontend/src/pages/LandingPage.jsx
# Expected: lines 286 (hero), 427 (grid), 532 (modal)

# Build check
cd frontend && npm run build
```

---

## Phase 2 — Plan Intent Preservation

**Goal:** Unauthenticated user who clicks "Choose Pro" lands on the subscription tab (with Pro highlighted) after registering or logging in, rather than on the default chat page. Reduces Path A from 10 steps to 5.
**Files:** `LandingPage.jsx`, `App.jsx`, `MyPage.jsx`

### 2a. Capture intent in LandingPage pricing modal

In `LandingPage.jsx`, the pricing modal primary button (line 537–540):

**Current:**
```jsx
onClick={() => { setPricingModal(null); onSignUp(); }}
```

**Change to:**
```jsx
onClick={() => {
  sessionStorage.setItem('intended_plan', pricingModal.toLowerCase());
  setPricingModal(null);
  onSignUp();
}}
```

`pricingModal` holds the plan name string (`'Free'`, `'Pro'`, `'Business'`). `.toLowerCase()` normalizes to `'free'`/`'pro'`/`'business'` — matching `PLAN_LIMITS` keys and `handleUpgrade` argument format.

Do **not** change the three general sign-up CTAs (lines 274, 290, 498) — those are context-free entry points that should not pre-select a plan.

### 2b. Read intent in App.jsx after successful auth

In `App.jsx`:

**Add state** near the other state declarations:
```jsx
const [intendedPlan, setIntendedPlan] = useState(() => sessionStorage.getItem('intended_plan') || null);
```

**Change RegisterPage `onSuccess` callback** (line 140):
```jsx
onSuccess={(user) => {
  const plan = sessionStorage.getItem('intended_plan');
  sessionStorage.removeItem('intended_plan');
  setAuthUser(user);
  if (plan && plan !== 'free') {
    setIntendedPlan(plan);
    setCurrentPage('mypage');
  }
  setPage('app');
}}
```

**Change LoginPage `onLogin` callback** (line 150):
```jsx
onLogin={(user) => {
  const plan = sessionStorage.getItem('intended_plan');
  sessionStorage.removeItem('intended_plan');
  setAuthUser(user);
  if (plan && plan !== 'free') {
    setIntendedPlan(plan);
    setCurrentPage('mypage');
  }
  setPage('app');
}}
```

**Add `intendedPlan` props to MyPage** (line ~303):
```jsx
{page === 'app' && currentPage === 'mypage' && lazySuspense(
  <MyPage
    authUser={authUser}
    onLogout={() => { setAuthUser(null); navigate('landing'); }}
    intendedPlan={intendedPlan}
    onIntendedPlanConsumed={() => setIntendedPlan(null)}
  />
)}
```

### 2c. Consume intent in MyPage

In `MyPage.jsx`:

**Update function signature** (line 151):
```jsx
export default function MyPage({ onLogout, intendedPlan, onIntendedPlanConsumed })
```

**Add a useEffect** (after existing Paddle init useEffect, around line 199):
```jsx
useEffect(() => {
  if (intendedPlan && plan === 'free') {
    setActiveTab('subscription');
  }
}, [intendedPlan]);
```

**Add intent banner** inside the subscription tab render, at the top of the `plan === 'free'` block (before the upgrade grid, around line 384):
```jsx
{plan === 'free' && intendedPlan && intendedPlan !== 'free' && (
  <div className="mypage-intent-banner">
    <span>You selected <strong>{intendedPlan.charAt(0).toUpperCase() + intendedPlan.slice(1)}</strong> — complete your upgrade below.</span>
    <button
      className="mypage-intent-dismiss"
      onClick={() => onIntendedPlanConsumed?.()}
      aria-label="Dismiss"
    >×</button>
  </div>
)}
```

**Add CSS** to `frontend/src/App.css` or a MyPage CSS file:
```css
.mypage-intent-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: var(--lexara-blue-subtle);
  border: 1px solid rgba(74, 122, 255, 0.25);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--color-text-primary);
  margin-bottom: 12px;
}
.mypage-intent-dismiss {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--color-text-muted);
  cursor: pointer;
  line-height: 1;
  flex-shrink: 0;
  padding: 0 4px;
}
```

Note: `setActiveTab` is the subscription tab state setter inside MyPage. Confirm its name by checking MyPage's `useState` for the tab at the top of the component.

### 2d. Fix the `upgradeError` display bug (free-plan error never shown)

Move `upgradeError` display out of the `plan !== 'free'` block. Place it immediately before the upgrade grid (inside `plan === 'free'`), and keep a copy in the paid plan view too:

In the `plan === 'free'` block, add before the upgrade grid (`LandingPage.jsx:385`-equivalent in MyPage):
```jsx
{upgradeError && (
  <div className="mypage-error-banner">{upgradeError}</div>
)}
```

The existing `upgradeError` render in the `plan !== 'free'` block (line 432) can remain — it's valid there too if a plan refresh race causes an error on an active plan.

### New Path A after Phase 2
1. User clicks "Choose Pro" card → modal opens
2. User clicks "Create account to upgrade →" → sessionStorage set, navigate to register
3. User fills registration form
4. After success → navigates to MyPage/subscription tab with intent banner
5. User clicks "Upgrade to Pro →" → Paddle checkout opens

**5 steps** (down from 10). Plan intent preserved.

### Verification for Phase 2
```bash
# Confirm sessionStorage write in pricing modal CTA
grep -n "sessionStorage" frontend/src/pages/LandingPage.jsx
# Expected: one match on the pricing modal onClick

# Confirm intendedPlan thread in App.jsx
grep -n "intendedPlan" frontend/src/App.jsx
# Expected: state declaration + RegisterPage + LoginPage + MyPage render

# Confirm MyPage receives new props
grep -n "intendedPlan" frontend/src/pages/MyPage.jsx
# Expected: function signature + useEffect + banner render + upgradeError fix

# Full test suite
cd frontend && npm run test -- --run
# Expected: 87/87 passing (no regressions to Path B)
```

---

## Phase 3 — Pricing Modal Redesign: States + Accessibility

**Goal:** The pricing modal gains loading state, error state, keyboard trap (Escape), focus management, ARIA dialog role, and focus-visible rings on buttons.
**File:** `LandingPage.jsx:517–554` + `LandingPage.css:1008–1018`

### 3a. Extract `PricingModal` component

The modal is currently inline JSX inside `LandingPage`. Extract it to a `PricingModal` component defined at the top of `LandingPage.jsx` (alongside `FAQItem`, `ContactForm`, `TiltCard`, `CountUp`).

**New component signature:**
```jsx
function PricingModal({ plan, onClose, onSignUp, onSignIn })
```
- `plan` — string (`'Free'` / `'Pro'` / `'Business'`) or `null`
- `onClose` — `() => void`
- `onSignUp` — the existing `onSignUp` prop threaded from LandingPage
- `onSignIn` — the existing `onSignIn` prop

**Component body — copy this pattern:**
```jsx
function PricingModal({ plan, onClose, onSignUp, onSignIn }) {
  const dialogRef = useRef(null);
  const [loading, setLoading] = useState(false);

  // Focus trap on mount
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Escape key to close
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
    ? 'Create a free account — 50 queries/month, 1 workspace, 5 documents. No credit card required.'
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
```

**Update LandingPage render** — replace the inline `{pricingModal && (...)}` block (lines 513–554) with:
```jsx
{pricingModal && (
  <PricingModal
    plan={pricingModal}
    onClose={() => setPricingModal(null)}
    onSignUp={onSignUp}
    onSignIn={onSignIn}
  />
)}
```

Note: `sessionStorage.setItem` now lives inside `PricingModal.handlePrimary` — remove it from Phase 2a's inline onClick since this component absorbs that logic.

### 3b. Add `:focus-visible` to modal buttons in CSS

In `LandingPage.css`, after the `.pricing-modal-btn--ghost:hover` rule (line ~1040):
```css
.pricing-modal-btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

### Verification for Phase 3
```bash
# Confirm PricingModal component is extracted
grep -n "function PricingModal" frontend/src/pages/LandingPage.jsx
# Expected: one match

# Confirm role="dialog" and aria-modal present
grep -n 'role="dialog"' frontend/src/pages/LandingPage.jsx
# Expected: one match inside PricingModal

# Confirm Escape handler
grep -n "Escape" frontend/src/pages/LandingPage.jsx
# Expected: one match inside PricingModal useEffect

# Confirm :focus-visible rule added
grep -n "focus-visible" frontend/src/styles/LandingPage.css
# Expected: matches for .pricing-modal-btn and any existing rules

# Build + tests
cd frontend && npm run build && npm run test -- --run
# Expected: build passes, 87/87 tests
```

---

## Phase 4 — Contrast Fixes + Paddle Deferred Loading

**Goal:** Fix two WCAG AA contrast failures in the pricing section. Remove blocking Paddle.js from `<head>` and load it lazily.

### 4a. Contrast fixes (2 CSS lines)

In `frontend/src/styles/LandingPage.css`:

**`.landing-pricing-plan-name`** (line 656):
```css
/* Change: */
color: rgba(255, 255, 255, 0.6);
/* To: */
color: rgba(255, 255, 255, 0.80);
```
Raises contrast from ~3.5:1 to ~7:1 on `#0d0d14`. Passes AA for 13px text.

**`.landing-pricing-note`** (line 725):
```css
/* Change: */
color: rgba(255, 255, 255, 0.3);
/* To: */
color: rgba(255, 255, 255, 0.65);
```
Raises contrast from ~1.7:1 to ~5:1 on `#0d0d14`. Passes AA for 12px text.

### 4b. Defer Paddle.js

**Step 1 — Remove the blocking script from `frontend/index.html`** (line 12):
```html
<!-- Remove this line: -->
<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
```

**Step 2 — Load Paddle dynamically in MyPage.jsx**, replacing the existing Paddle init useEffect (lines 191–197):
```jsx
useEffect(() => {
  if (!import.meta.env.VITE_PADDLE_CLIENT_TOKEN) return;
  if (window.Paddle) {
    // Already loaded (e.g. hot reload)
    window.Paddle.Initialize({ token: import.meta.env.VITE_PADDLE_CLIENT_TOKEN });
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
  script.defer = true;
  script.onload = () => {
    window.Paddle.Initialize({ token: import.meta.env.VITE_PADDLE_CLIENT_TOKEN });
  };
  document.head.appendChild(script);
}, []);
```

This ensures Paddle.js only loads when an authenticated user visits MyPage — not for every landing page visitor.

### Verification for Phase 4
```bash
# Confirm blocking script removed from index.html
grep "paddle.js" frontend/index.html
# Expected: 0 matches

# Confirm dynamic load exists in MyPage
grep -n "paddle.js" frontend/src/pages/MyPage.jsx
# Expected: one match inside the script.src assignment

# Confirm contrast values updated
grep -A3 "landing-pricing-plan-name" frontend/src/styles/LandingPage.css | grep "color"
# Expected: rgba(255, 255, 255, 0.80)

grep -A3 "landing-pricing-note" frontend/src/styles/LandingPage.css | grep "color"
# Expected: rgba(255, 255, 255, 0.65)

# Build + tests
cd frontend && npm run build && npm run test -- --run
# Expected: build passes, 87/87 tests
```

---

## Phase 5 — Verification & Regression

**Goal:** Confirm all changes are correct, no regressions in Path B (authenticated upgrade) or existing tests.

### Full regression checklist

**Path B preservation (authenticated user → upgrade):**
```bash
# handleUpgrade still calls createCheckout from ../api/billing
grep -n "createCheckout" frontend/src/pages/MyPage.jsx
# Expected: import line + one call in handleUpgrade

# Paddle.Initialize still called on MyPage mount
grep -n "Paddle.Initialize" frontend/src/pages/MyPage.jsx
# Expected: one match inside useEffect

# upgradeLoading still gates buttons
grep -n "upgradeLoading" frontend/src/pages/MyPage.jsx
# Expected: state declaration + disabled attrs on both upgrade buttons
```

**Brand tokens not touched:**
```bash
grep -n "color-accent\|font-sans\|font-mono\|radius-md\|radius-lg\|radius-xl" frontend/src/index.css | head -5
# Expected: all tokens still present with original values
```

**Pro card highlight preserved:**
```bash
grep -n "landing-pricing-card--pro\|landing-pricing-btn--active" frontend/src/styles/LandingPage.css
# Expected: both rules present
```

**No "Cancel anytime" remaining:**
```bash
grep -rn "Cancel anytime" frontend/src/
# Expected: 0 matches
```

**No "100 queries" in pricing surfaces:**
```bash
grep -n "100 queries\|100 free queries" frontend/src/pages/LandingPage.jsx
# Expected: 0 matches (hero badge, pricing grid, modal all changed to 50)
```

**Accessibility — dialog role present:**
```bash
grep -n 'role="dialog"' frontend/src/pages/LandingPage.jsx
# Expected: 1 match (PricingModal component)
```

**sessionStorage intent cleared on auth:**
```bash
grep -n "sessionStorage.removeItem" frontend/src/App.jsx
# Expected: 2 matches (one in onSuccess, one in onLogin)
```

### Full build + test run
```bash
cd frontend
npm run build   # Must pass with 0 errors
npm run test -- --run  # Must pass 87/87
```

### Commit
```
git add frontend/src/pages/LandingPage.jsx \
        frontend/src/pages/MyPage.jsx \
        frontend/src/App.jsx \
        frontend/src/styles/LandingPage.css \
        frontend/index.html
git commit -m "redesign(upgrade-pro): honest copy, plan intent, modal states, contrast, paddle defer"
git push origin develop && git checkout main && git merge develop --no-edit && git push origin main
```

---

## Summary of All File Changes

| File | Phase | What changes |
|---|---|---|
| `LandingPage.jsx:286` | 1a | Hero badge: `100` → `50` |
| `LandingPage.jsx:427` | 1a | Free plan grid: `100 queries` → `50 queries` |
| `LandingPage.jsx:532` | 1a | Modal Free desc: `100 queries` → `50 queries` |
| `LandingPage.jsx:454` | 1b | Pricing note: "Cancel anytime" → "Email support to cancel" |
| `LandingPage.jsx:534,535,550,472` | 1b | 4× "Cancel anytime" → "Email support@lexara.app to cancel" |
| `LandingPage.jsx:429` | 1c | `'Unlimited workspaces'` → `'Unlimited workspaces*'` |
| `LandingPage.jsx:517–554` | 3 | Inline modal → `<PricingModal>` component (extracted) |
| `LandingPage.jsx:new` | 2a+3 | `PricingModal` component added (sessionStorage + dialog + states) |
| `LandingPage.css:656` | 4a | Plan name contrast: `0.6` → `0.80` |
| `LandingPage.css:725` | 4a | Pricing note contrast: `0.3` → `0.65` |
| `LandingPage.css:~1040` | 3b | Add `.pricing-modal-btn:focus-visible` rule |
| `App.jsx:~20` | 2b | Add `intendedPlan` state |
| `App.jsx:140` | 2b | RegisterPage `onSuccess` reads + clears sessionStorage |
| `App.jsx:150` | 2b | LoginPage `onLogin` reads + clears sessionStorage |
| `App.jsx:303` | 2b | MyPage gets `intendedPlan` + `onIntendedPlanConsumed` props |
| `MyPage.jsx:151` | 2c | Add `intendedPlan`, `onIntendedPlanConsumed` to props |
| `MyPage.jsx:~199` | 2c | Add useEffect → setActiveTab to subscription if intendedPlan |
| `MyPage.jsx:~384` | 2c | Add intent banner inside free-plan subscription view |
| `MyPage.jsx:~384` | 2d | Move `upgradeError` display to free-plan branch |
| `MyPage.jsx:191–197` | 4b | Replace static Paddle init with dynamic script inject |
| `frontend/index.html:12` | 4b | Remove blocking `<script>` Paddle tag |
| `App.css` or `MyPage.css` | 2c | Add `.mypage-intent-banner` + `.mypage-intent-dismiss` styles |
