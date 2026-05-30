# 04 — /make-plan Handoff

Copy the block below and run it as your next prompt.

---

````
/make-plan Redesign the "upgrade to Pro" flow in the Lexara RAG-MVP. Current design failed audit at 9/30 with critical gaps in principles #6 (Honest, score 0) and #8 (Thorough, score 0).

Verdict paragraph:
> The upgrade-to-Pro flow scores 9/30 with two load-bearing principles at 0 (#6 Honest, #8 Thorough), making REDESIGN the required verdict. The core failure is that the flow makes three promises it cannot keep — "Cancel anytime from your profile," "100 queries/month" on the Free plan, and "Choose Pro" navigating to Pro checkout — while simultaneously having no interactive states on the modal, a broken error display, and no keyboard accessibility.

Why redesign and not refine: Two load-bearing principles scored 0. #6 (Honest) failed because a payment flow advertising false limits and promising self-serve cancel without delivering it exposes users to real deception. #8 (Thorough) failed because the highest-traffic entry point (pricing modal) has zero interactive states — no loading, error, success, focus, or keyboard handling. These require rethinking what the flow promises and whether it can deliver, not incremental cleanup.

Preserve from current design:
- Brand tokens: `--color-accent: #4a7aff` (dark) / `#2356d8` (light), Inter/DM Mono fonts, `--radius-md/lg/xl`. `frontend/src/index.css:3–75`
- Three-card pricing layout structure (Free / Pro / Business columns). `LandingPage.jsx:422–455`
- Pro card visual highlight: blue border + glow + solid active button. `LandingPage.css:640–721`
- Authenticated upgrade path (Path B): MyPage → subscription tab → "Upgrade to Pro" → Paddle checkout. This 4-step path works correctly. `MyPage.jsx:396–237`
- `prefers-reduced-motion` gating on all animations. `LandingPage.css:1167–1169, 1213–1215`

Discard:
- The `onSignUp()` call from the pricing modal with no plan parameter. `LandingPage.jsx:538`. Caused failure on principle #6 (plan intent silently dropped) and #2 (10-step unnecessary detour).
- "Cancel anytime from your profile" copy in 3 locations. `LandingPage.jsx:454, 550`. Caused failure on principle #6 (no self-serve cancel exists — `MyPage.jsx:435–441` shows email-only).
- Hardcoded `"100 queries/month"` for Free plan. `LandingPage.jsx:427`. Caused failure on principle #6 (enforced limit is 50 at `MyPage.jsx:20`, FAQ says 50 at `LandingPage.jsx:468`).
- The current pricing modal's zero-state implementation (no loading, error, success, focus, keyboard). `LandingPage.jsx:519–554`. Caused failure on principle #8.
- Synchronous blocking Paddle.js `<script>` in `<head>` for all visitors. `dist/index.html`. Caused failure on principle #9.

Top 5 moves from the audit (implement in this order):

1. Principle #6 (Honest) — Plan intent drop + false "Cancel anytime":
   (a) Pass plan selection through sign-up: after `onSignUp()` fires, persist `sessionStorage.setItem('intended_plan', 'pro')` in LandingPage before navigating. In App.jsx post-login, read `sessionStorage.getItem('intended_plan')` and if set, navigate to the MyPage subscription tab and auto-trigger `handleUpgrade(plan)`. This closes the 10-step gap.
   (b) Either implement Paddle subscription cancel (use the Paddle cancel URL from the subscription object, or call `POST /billing/cancel` on the backend), OR change the "Cancel anytime" copy in `LandingPage.jsx:454` and `LandingPage.jsx:550` to "Email us to cancel" to match the actual behavior.
   Evidence: `LandingPage.jsx:538` (no plan param), `LandingPage.jsx:454` (false promise), `MyPage.jsx:435–441` (email-only cancel).

2. Principle #6 (Honest) — Free plan query limit discrepancy:
   Change `LandingPage.jsx:427` from `"100 queries/month"` to `"50 queries/month"`. Do not change the enforced limit in `MyPage.jsx:20` unless the product decision is to raise it — the landing page must reflect the enforced value, not a larger number.
   Evidence: `LandingPage.jsx:427` (advertises 100), `MyPage.jsx:20` (enforces 50), `LandingPage.jsx:468` (FAQ says 50).

3. Principle #8 (Thorough) — Add all missing states to the pricing modal:
   In `LandingPage.jsx:519–554`: (a) Add `role="dialog" aria-modal="true" aria-labelledby="pricing-modal-title"` and `id="pricing-modal-title"` on the h3. (b) Add a `useEffect` with `keydown` listener closing modal on Escape. (c) Add loading state — local `useState` in the modal (or pass `loading` prop); show disabled button + `.lexara-spinner` while `onSignUp()` resolves. (d) Move focus to the modal on open (`useRef` + `focus()`). (e) Add `:focus-visible` rule to `.pricing-modal-btn` in `LandingPage.css`.
   Evidence: `LandingPage.jsx:519–554` (no states), `LandingPage.css:1008–1018` (no :focus-visible rule).

4. Principle #6/#3 (Honest/Aesthetic) — Fix contrast failures on pricing text:
   In `LandingPage.css`: (a) Change `.landing-pricing-note` color from `rgba(255,255,255,0.3)` to `rgba(255,255,255,0.65)` — raises contrast from ~1.7:1 to ~5:1 on `#0d0d14`. (b) Change `.landing-pricing-plan-name` color from `rgba(255,255,255,0.6)` to `rgba(255,255,255,0.80)` — raises from ~3.5:1 to ~7:1.
   Evidence: `LandingPage.css` pricing note rule (~line 723) and plan name rule (~line 650).

5. Principle #9 (Environmentally friendly) — Defer Paddle.js for unauthenticated visitors:
   Remove the static `<script src="https://cdn.paddle.com/paddle/v2/paddle.js">` from the HTML template (check `index.html` in `frontend/`). In `MyPage.jsx`, inside the `useEffect` that calls `window.Paddle.Setup()` (lines 192–197), first dynamically inject the script if not already present: create a `<script>` element, set `src`, `defer`, and append to `<head>`, then initialize Paddle in its `onload` callback.
   Evidence: `dist/index.html` (blocking script), `MyPage.jsx:192–197` (initialization).

Redesign principles in priority order:
1. Principle #6 (Honest) — Every claim maps 1:1 to behavior; no false promises in pricing copy
2. Principle #8 (Thorough) — Every interactive entry point has loading, error, success, focus, and keyboard states
3. Principle #2 (Useful) — Upgrade intent captured at point of selection, not dropped; Path A completes in ≤5 steps

Out of scope for this redesign pass:
- Visual redesign of the landing page hero or features section
- Backend billing API changes (work with existing `/billing/checkout`)
- Changing which payment processor is used (Paddle stays)
- Redesigning the MyPage authenticated upgrade path (Path B works correctly)
- Adding annual pricing tier

Deliverables for the plan:
- New flow diagram: Path A (unauthenticated → Pro) with plan-intent preservation
- Per-fix: target files, exact change, verification step
- Contrast-checked color values for the two failing pricing text selectors
- Updated copy list for all 3 "Cancel anytime" occurrences (either new copy or self-serve cancel implementation)
- States specification for the redesigned pricing modal (loading, error, success, focus, keyboard)
- Regression checklist for Path B (authenticated upgrade — must not be broken)
- Accessibility checklist: role="dialog", aria-modal, focus management, Escape key

Anti-patterns to guard against:
- Porting old modal structure under new styling (the zero-states modal needs new interactive logic, not a restyle)
- Keeping both "Cancel anytime" copy and email-only cancel simultaneously — pick one truth
- Advertising a Free plan limit that differs from the enforced limit anywhere in the codebase
- Treating the Preserve list as optional — brand tokens and the authenticated upgrade path must survive unchanged
````
