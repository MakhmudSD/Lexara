# 01 — Evidence

Consolidated from four parallel subagents: Structural, Visual, Copy/Honesty, Weight/Friction.

---

## Structural

- **10 interactive elements** across the upgrade flow (3 pricing-card CTAs, 2 modal buttons, 4 tab buttons, 1 "Upgrade to Pro" in MyPage subscription tab). `LandingPage.jsx:444–449`, `MyPage.jsx:289–298, 396–402`
- **Modal nesting depth: 5 JSX element levels** (overlay → modal div → inner elements). `LandingPage.jsx:519–554`
- **3 duplicate upgrade CTA patterns:** (a) 3 sign-up buttons on landing page (`LandingPage.jsx:274, 290, 498`); (b) "Choose Pro" on landing vs "Upgrade to Pro" in MyPage (`LandingPage.jsx:444` vs `MyPage.jsx:401`); (c) feature copy duplicated between landing grid and `PLAN_FEATURES_DEFAULTS` (`LandingPage.jsx:427–429` vs `MyPage.jsx:37–41`)
- **`upgradeError` renders in wrong branch:** `setUpgradeError` is called in the free-user catch block (`MyPage.jsx:244–247`) but the error display is inside the `plan !== 'free'` branch (`MyPage.jsx:432`) — error is never visible to free users
- **`checkout_url` unused in primary Paddle path** (`MyPage.jsx:202`) — only used in the fallback `else` branch (`MyPage.jsx:242`)
- **6–10 steps** to complete upgrade from landing page depending on path; plan intent dropped at step 3 (no plan param passed through `onSignUp()`)
- **No self-serve cancel** for paid users — only `mailto:support@lexara.app` (`MyPage.jsx:435–441`)

---

## Visual (all INFERRED — no running dev server)

- **Spacing scale across pricing surface:** 9, 11, 12, 14, 16, 20, 24, 28, 36px — 9 distinct values
- **Type scale across pricing surface:** 11, 12, 13, 14, 20, 22, 24, 36, 38px — 9 distinct values
- **~20 distinct color tokens** in pricing section + modal (10 hard-coded rgba/hex + 10 CSS variable references)
- **Lowest contrast: `.landing-pricing-note` at ~1.7:1** (`rgba(255,255,255,0.3)` on `#0d0d14`) — fails WCAG AA by large margin. `LandingPage.css` line ~723
- **`.landing-pricing-plan-name` at ~3.5:1** (`rgba(255,255,255,0.6)` on `#0d0d14`) — fails AA for 13px text. `LandingPage.css` line ~650
- **Pro card differentiation:** blue border (`var(--color-accent)`), double-ring glow, solid active button. **Business card is visually identical to Free card** — same background, border, ghost button. `LandingPage.css:640–721`
- **No "Most Popular" badge or aria-label** on Pro card — differentiation is color-only (invisible to screen readers)

**States checklist — Pricing Modal:**
| State | Present |
|---|---|
| Loading | ✗ Missing |
| Error | ✗ Missing |
| Success | ✗ Missing |
| Focus visible | ✗ Missing |
| Disabled | ✗ Missing |

**States checklist — MyPage upgrade buttons:**
| State | Present |
|---|---|
| Loading | Partial — `'...'` text, no spinner, no aria |
| Error | Broken — renders in wrong branch |
| Success | ✗ Missing |
| Focus visible | ✗ Missing on `.mypage-upgrade-btn` |
| Disabled | Partial — `disabled` attr set, no CSS rule |

- **No `role="dialog"`, `aria-modal`, or Escape-key handler** on pricing modal. `LandingPage.jsx:519–554`
- **Paddle overlay uses `theme: 'light'` hardcoded** (`MyPage.jsx:208`) — dark-mode users see bright white checkout

---

## Copy & Honesty

**Inflations:**
- `"Unlimited workspaces"` (Business) — actual cap is `workspaces: 999` (`MyPage.jsx:22`). `LandingPage.jsx:429`, `MyPage.jsx:41`
- `"Priority support"` — no SLA, response time, or channel defined. `LandingPage.jsx:429`
- `"Usage analytics"` — actual feature is a counter + cost display, not a dashboard. `LandingPage.jsx:428`
- `"99% uptime"` in stats strip — no status page or measurement methodology linked. `LandingPage.jsx:352`

**Dark patterns:**
- **Forced continuity:** "Cancel anytime from your profile" (`LandingPage.jsx:454`, modal `LandingPage.jsx:550`) — actual UI for paid users has no cancel button, only `mailto:support@lexara.app` (`MyPage.jsx:435–441`)
- **Bait-and-switch by omission:** Free plan lists 5 documents cap; Pro card omits document limits, implying no cap. MyPage then shows "Unlimited documents" for Pro. User cannot compare plans accurately from the landing page
- **Query limit discrepancy:** Landing page advertises "100 queries/month" for Free (`LandingPage.jsx:427`), FAQ says 50 (`LandingPage.jsx:468`), `PLAN_LIMITS.free.queries = 50` (`MyPage.jsx:20`). Advertised limit (100) ≠ enforced limit (50)

**Label → behavior mismatches:**
- `"Choose Pro"` → opens informational modal → calls generic `onSignUp()` with no plan param → user lands on Free plan. `LandingPage.jsx:444, 538`
- `"Cancel anytime from your profile"` → no cancel button exists in profile. Three locations: `LandingPage.jsx:454, 550`
- `"Billed monthly via Paddle"` appears on landing page (`LandingPage.jsx:454`) but the landing "Choose Pro" path never connects to Paddle

**Jargon / locale issues:**
- `"/oy"` (Uzbek "per month") hardcoded in English-context MyPage. `MyPage.jsx:389, 408`
- Tab fallback labels in Uzbek: `'Obuna'`, `'Ma'lumotlarim'`, `'Hisob'`, `'Foydalanish'`, `'Sozlamalar'`, `'Chiqish'` — default to Uzbek instead of English. `MyPage.jsx:258–362`
- `"All Pro features"` on Business plan is self-referential, not informative. `MyPage.jsx:41`

---

## Weight & Friction

- **Initial JS:** Main bundle `index-CIGxLokX.js` = 307.59 KB raw / 102.60 KB gzip. vendor-react = 3.80 KB, vendor-sentry = 7.75 KB. Plus Paddle.js external (~100–150 KB, blocking)
- **Paddle.js loads synchronously (no `defer`/`async`) on every page** including unauthenticated landing visitors who cannot use checkout. `dist/index.html`
- **Sentry preloaded for all visitors** via `modulepreload`. `dist/index.html`
- **7 concurrent CSS animations running while user reads pricing:** heroMesh (8s), orbDrift1–3 (40/60/80s fixed-position, overlaying pricing section), orbFloat1–3 (40/60/80s, in DOM), ctaGlowPulse (2s). All gated behind `prefers-reduced-motion`
- **0 modals on initial load** — pricing modal only appears after user action
- **Path A (unauthenticated → Pro): 10 steps before payment** — plan intent silently dropped at step 3 (no `?plan=pro` param, no `sessionStorage` write). User defaults to Free plan post-registration
- **Path B (authenticated): 4 steps** — correct and direct
- **Post-checkout poll (30s, silent):** after `checkout.completed`, polls `/auth/me` every 3s up to 10 times with no user-visible progress or timeout error. `MyPage.jsx:215–237`
- **Paddle-blocked fallback:** `window.open(checkout_url, '_blank')` opens new tab with no explanation; polling loop never starts; plan never updates in UI for users with ad blockers. `MyPage.jsx:242`
