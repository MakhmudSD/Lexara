# 02 — Scorecard

Scored by orchestrator from evidence in `01-evidence.md`. Tie-breaker rule: pick lower. Score worst instance, not mean.

---

## 1. Good design is innovative — Score: 1/3
Evidence: Standard three-card pricing grid with confirmation modal — a pattern present in ≥20 SaaS peers (Notion, Linear, Vercel). Cosmetic animations (tilt cards, orbs, mesh gradient) refresh the surface without advancing the pattern.
Justification: Scores 1 (refreshes with minor variation) not 2 because the animations are additive decoration, not a structural improvement to how upgrade intent is captured or resolved.

---

## 2. Good design makes a product useful — Score: 1/3
Evidence: Path A (unauthenticated) requires 10 discrete steps before payment begins and drops plan intent at step 3 — user lands on Free plan post-registration. `LandingPage.jsx:538` (`onSignUp()` carries no plan param). Path B (authenticated, 4 steps) works correctly.
Justification: Scores 1 (unnecessary detour) not 0 because the primary task is eventually completable; scores 1 not 2 because the dominant entry path (unauthenticated visitor) requires the detour every time.

---

## 3. Good design is aesthetic — Score: 1/3
Evidence: 9 distinct spacing values and 9 type sizes across a small pricing surface (`01-evidence.md §Visual`). `.landing-pricing-note` contrast ~1.7:1 fails WCAG AA by >60% (`LandingPage.css ~line 723`). Business card is visually indistinguishable from Free card. `/oy` mixed into English-language context (`MyPage.jsx:389`).
Justification: Scores 1 (one jarring violation: 1.7:1 contrast + no system coherence on spacing/type) not 2 because the violations are on primary pricing text, not edge cases.

---

## 4. Good design makes a product understandable — Score: 1/3
Evidence: "Choose Pro" label implies plan selection but delivers generic sign-up with plan intent dropped (`LandingPage.jsx:444, 538`). Feature sets inconsistent between landing and MyPage (Pro lists 3 features on landing, 4 in app). Uzbek fallback strings visible in English context (`MyPage.jsx:258, 389`). "Usage analytics" is vague jargon for a counter display.
Justification: Scores 1 (2–3 controls misleading, jargon present) not 0 because the primary action is identifiable even if its outcome is misrepresented; the misrepresentation is scored under #6.

---

## 5. Good design is unobtrusive — Score: 1/3
Evidence: 7 concurrent CSS animations run while user reads pricing: heroMesh (8s), orbDrift1–3 (fixed-position, visually overlay pricing cards), orbFloat1–3 (in DOM). Three `.landing-orb` divs are `position: fixed` and render above the pricing section. `LandingPage.css:1122–1169`
Justification: Scores 1 (decoration competes with content) not 0 because the pricing card content itself is not dominated by chrome — but the fixed orbs do visually compete with the cards at this scroll position.

---

## 6. Good design is honest — Score: 0/3
Evidence: Three simultaneous failures at the dark-pattern threshold:
(a) **Forced continuity:** "Cancel anytime from your profile" (`LandingPage.jsx:454`, ×3 locations) — no self-serve cancel button exists; users must email support (`MyPage.jsx:435–441`).
(b) **False claim in pricing:** Free plan advertised as "100 queries/month" (`LandingPage.jsx:427`) while enforced limit is 50 (`MyPage.jsx:20`, confirmed by FAQ at `LandingPage.jsx:468`).
(c) **"Unlimited workspaces"** = hardcoded cap of 999 (`MyPage.jsx:22`).
Justification: Scores 0 not 1 because the forced-continuity pattern (promise self-serve cancel; deliver email-only barrier) meets the scoring anchor threshold for a deceptive flow.

---

## 7. Good design is long-lasting — Score: 1/3
Evidence: Three 2023–2024 trend markers: floating orbs (`LandingPage.css:1115–1175`), hero glassmorphism demo card (backdrop-filter, `LandingPage.css:309`), animated mesh gradient background (`LandingPage.css:18–34`). The pricing card layout itself is timeless.
Justification: Scores 1 (2–3 dated markers) not 2 because the orbs + glassmorphism + animated mesh gradient are all simultaneously present, not isolated.

---

## 8. Good design is thorough down to the last detail — Score: 0/3
Evidence: Pricing modal missing all 5 states — loading, error, success, focus, disabled (`01-evidence.md §Visual states`). No `role="dialog"`, `aria-modal`, or Escape key handler (`LandingPage.jsx:519–554`). `upgradeError` renders in wrong branch and is never visible to free users (`MyPage.jsx:244` vs `432`). No focus-visible ring on `.pricing-modal-btn` or `.landing-pricing-btn`. Post-checkout poll runs 30s with no user-visible feedback.
Justification: Scores 0 (4+ states missing) — the modal is missing every interactive state; the in-app upgrade has at least two broken states (error in wrong branch, no success confirmation).

---

## 9. Good design is environmentally friendly — Score: 2/3
Evidence: Local JS bundles = ~320 KB raw / ~110 KB gzip (well under 500 KB). All orb and CTA animations are gated by `prefers-reduced-motion`. Dark mode is implemented. Negative: Paddle.js loads synchronously (no `defer`/`async`) on every page for all visitors including unauthenticated users (`dist/index.html`). Sentry preloaded for all visitors.
Justification: Scores 2 (<500KB gzipped, motion gated) not 3 because the blocking Paddle.js CDN load for non-paying visitors is a material attention/performance cost.

---

## 10. Good design is as little design as possible — Score: 1/3
Evidence: 7 concurrent animations on idle pricing view (`01-evidence.md §Weight`). Feature copy duplicated between landing grid and `PLAN_FEATURES_DEFAULTS` (`LandingPage.jsx:427–429` vs `MyPage.jsx:37–41`). Three sign-up CTAs on landing page (`LandingPage.jsx:274, 290, 498`). Undefined "Priority support" feature adds complexity without substance. 9-value spacing scale.
Justification: Scores 1 (3–5 removable elements) not 0 because the core three-card layout is structurally lean; the excess comes from decoration and duplication, not from the pricing grid itself being over-engineered.

---

## Total: 9 / 30

| # | Principle | Score |
|---|---|---|
| 1 | Innovative | 1 |
| 2 | Useful | 1 |
| 3 | Aesthetic | 1 |
| 4 | Understandable | 1 |
| 5 | Unobtrusive | 1 |
| 6 | **Honest** | **0** |
| 7 | Long-lasting | 1 |
| 8 | **Thorough** | **0** |
| 9 | Environmentally friendly | 2 |
| 10 | As little design as possible | 1 |
| | **Total** | **9 / 30** |
