# 03 — Verdict

## REDESIGN

**The upgrade-to-Pro flow scores 9/30 with two load-bearing principles at 0 (#6 Honest, #8 Thorough), making REDESIGN the required verdict.**

The core failure is that the flow makes three promises it cannot keep — "Cancel anytime from your profile," "100 queries/month" on the Free plan, and "Choose Pro" navigating to Pro checkout — while simultaneously having no interactive states on the modal, a broken error display, and no keyboard accessibility. The pricing section decorates well but misleads structurally.

---

## Top 5 highest-leverage moves

These become the spine of the redesign plan.

### 1. Principle #6 (Honest) — Fix the plan-intent drop and false "Cancel anytime" promise
The "Choose Pro" CTA calls `onSignUp()` with no plan argument (`LandingPage.jsx:538`). Post-registration the user lands on Free. Simultaneously, "Cancel anytime from your profile" appears in 3 locations but no cancel button exists — only `mailto:support@lexara.app` (`MyPage.jsx:435–441`).
**Move:** Either (a) pass `?plan=pro` or `sessionStorage.setItem('intended_plan', 'pro')` through the sign-up flow and pick it up post-registration to auto-trigger checkout, OR (b) relabel the CTA to "Create account (then upgrade inside app)" so the label matches the actual behavior. Separately, implement Paddle subscription cancellation via the cancel URL/API or relabel "Cancel anytime" to "Email us to cancel."

### 2. Principle #6 (Honest) — Align the Free plan query limit across all surfaces
"100 queries/month" is advertised on the landing pricing grid (`LandingPage.jsx:427`). The enforced limit is `PLAN_LIMITS.free.queries = 50` (`MyPage.jsx:20`). The FAQ says 50 (`LandingPage.jsx:468`). These must agree.
**Move:** Change `LandingPage.jsx:427` from `"100 queries/month"` to `"50 queries/month"` to match the enforced limit and FAQ. Or raise the enforced limit to 100 — but do not advertise a limit that differs from the enforced one.

### 3. Principle #8 (Thorough) — Implement all missing states on the pricing modal
The pricing modal has zero interactive states: no loading, no error, no success, no focus rings, no Escape-to-close, no `role="dialog"` (`LandingPage.jsx:519–554`).
**Move:** Add `role="dialog" aria-modal="true" aria-labelledby` to the modal div. Add an Escape key handler via `useEffect`. Add a loading state (disabled button + spinner) for the `onSignUp()` call duration. The modal is the highest-traffic entry point for Pro upgrades and currently has no fallback if anything goes wrong.

### 4. Principle #6 (Honest) / #3 (Aesthetic) — Fix the contrast failures on pricing text
`.landing-pricing-note` at ~1.7:1 (`rgba(255,255,255,0.3)` on `#0d0d14`, `LandingPage.css ~line 723`) and `.landing-pricing-plan-name` at ~3.5:1 (`rgba(255,255,255,0.6)` on `#0d0d14`, `LandingPage.css ~line 650`) both fail WCAG AA. The pricing note contains the payment promise ("Billed monthly via Paddle · Cancel anytime") — the most important legal disclaimer in the flow is the least readable text on the page.
**Move:** Raise `.landing-pricing-note` to at minimum `rgba(255,255,255,0.65)` (≈5:1) and `.landing-pricing-plan-name` to `rgba(255,255,255,0.80)` (≈7:1). These are single CSS line changes.

### 5. Principle #9 (Environmentally friendly) — Defer Paddle.js for unauthenticated visitors
`paddle.js` loads as a synchronous blocking `<script>` in `<head>` for every visitor including those who will never reach checkout (`dist/index.html`). Add `defer` to the script tag and initialize it lazily only when the MyPage subscription tab is mounted.
**Move:** In MyPage.jsx, dynamically inject the Paddle script in the `useEffect` that initializes Paddle (`MyPage.jsx:192–197`) rather than loading it globally. Remove the static `<script>` from `dist/index.html` (or from its template source).

---

## Why redesign, not refine
The total is 9/30 (threshold: ≥20 for refine). #6 Honest and #8 Thorough both scored 0 — Honest is a load-bearing dimension because a payment flow that advertises false limits and promises self-serve cancel without delivering it exposes users to real deception, not just poor UX. These are not cosmetic issues addressable in a refine pass; they require rethinking what the flow promises and whether it can deliver.
