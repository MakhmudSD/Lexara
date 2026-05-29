# /make-plan Handoff — Lexara Platform Redesign

````
/make-plan Redesign the Lexara LandingPage and MyPage surfaces. Current platform failed audit at 10/30 with critical gaps in Honest (#6, score 0) and Thorough (#8, score 0), both load-bearing dimensions.

Verdict paragraph (from 03-verdict.md):
> Total score: 10/30. Two load-bearing principles scored 0 — Honest (#6) and Thorough (#8) — and the total falls well below the 20-point REFINE threshold; the platform's bones are sound in the chat UX but its surface layer (LandingPage, MyPage) must be rebuilt from the principles, not iterated.

Why redesign and not refine: Three independent conditions each individually trigger REDESIGN — (1) total < 20, (2) Honest scored 0 (14-day trial promise with no implementation; 1,000-vs-2,000 query-count mismatch between the same product's two screens), (3) Thorough scored 0 (5 states missing or broken on MyPage, active removal of focus indicator).

---

Preserve from current design (DO NOT TOUCH in this pass):
- ChatPage.jsx + ChatPage.css — streaming UX, source card toggle, 3-step onboarding: scored highest on the platform (#1 innovative: 2, #5 unobtrusive: 2)
- index.css token system — all --lexara-* custom properties (lines 3–59): the right design language exists, just not used
- Brand palette: #2356d8 (blue), #1a1814 (near-black), #faf9f7 (warm off-white), var(--font-mono) for meta
- ChatMessage.jsx source card UX pattern (ChatMessage.jsx:64–83): collapse-behind-toggle is correct
- Billing infrastructure — billing.py, referral reward logic: correct and functional, no UI changes needed

Discard (structural patterns causing the failures):
- All 58 inline `style={{}}` blocks in LandingPage.jsx — implementing cosmetic styles inline while LandingPage.css defines the same class names unused. Caused failure on #3 (aesthetic) and #10 (as little design as possible). Evidence: LandingPage.jsx:214–453 vs LandingPage.css class definitions never applied.
- p5.js canvas particle animation (LandingPage.jsx:122–200) — 870 KB CDN load, unconditional 60fps draw loop, zero informational value. Caused failure on #9 (environmentally friendly). Evidence: LandingPage.jsx:124.
- "Try Pro free for 14 days" modal copy (LandingPage.jsx:429) — no trial implementation exists anywhere in the codebase; false promise. Caused failure on #6 (honest). Evidence: LandingPage.jsx:424–430, MyPage.jsx:95–146.
- `alert()` for MyPage errors (MyPage.jsx:142) — no inline error UI, no loading state, no empty state. Caused failure on #8 (thorough). Evidence: MyPage.jsx:142, MyPage.css (zero error/loading/empty/focus classes).
- `outline: none` on `.mypage-lang-select` with no focus substitute (MyPage.css:182) — accessibility failure. Caused failure on #8.
- Hardcoded Uzbek-only PLAN_FEATURES strings in MyPage.jsx (lines 31–51) — invisible in 4 of 5 supported languages.

---

Top 5 moves from the audit (verbatim, implement in priority order):

1. Principle #6 — Honest: Kill the false trial promise and fix the query mismatch.
   - Remove "Try Pro free for 14 days. No credit card required" (LandingPage.jsx:429) or implement it
   - Align landing pricing (LandingPage.jsx:342: "2,000 queries") with enforced limit (MyPage.jsx:20: 1,000 queries) — one number everywhere
   - Replace "Manage plan" (MyPage.jsx:308) with a Paddle customer portal link or relabel it "Email support to change plan"
   - Replace "Contact sales" → account creation flow (LandingPage.jsx:344, 441) with a real contact path
   - Disclose email-client behavior before contact form submit, not after (LandingPage.jsx:33–39)

2. Principle #8 — Thorough: Restore states on MyPage and LandingPage contact form.
   - MyPage: add loading skeleton, inline error UI replacing alert() (MyPage.jsx:142), empty-zero state for stats at 0, restore focus ring on .mypage-lang-select (remove outline:none at MyPage.css:182, add outline: 2px solid var(--lexara-blue) on :focus)
   - LandingPage contact form: add .contact-input.error style, add disabled state on submit while sent=true, add .faq-item.open CSS rule in LandingPage.css (currently a dead selector — class emitted at LandingPage.jsx:9 but never styled)
   - Pass isLoading correctly from ChatPage.jsx to ChatMessage, or remove the dead prop (ChatMessage.jsx:94)

3. Principle #9 — Environmentally friendly: Remove p5.js particle canvas.
   - Delete useEffect at LandingPage.jsx:122–200 entirely
   - Replace with a static CSS gradient or SVG background on the hero
   - Add prefers-reduced-motion gate to data-reveal scroll transitions (LandingPage.jsx:202–206)
   - Implement route-level code splitting: ChatPage, MyPage, AdminPage, LandingPage as separate Vite chunks

4. Principle #3 — Aesthetic: Migrate LandingPage from 58 inline styles to CSS classes.
   - Move all cosmetic style={{}} to LandingPage.css class rules — delete inline color/font/spacing from LandingPage.jsx
   - Consolidate 5 near-identical off-white values to one token: var(--lexara-bg) throughout (#faf9f7, #f8f6f1, #f7f7f6, #f6f7fb, #f7f5f0 → one)
   - Reduce type scale from 18 to 7 sizes: 11, 13, 14, 16, 22, 28, 42px — map orphans to nearest step
   - Connect MyPage.css to --lexara-* tokens (currently 95% hardcoded hex, 0 variable refs to --lexara-blue, --lexara-text, etc.)

5. Principle #2 — Useful: Add a one-click demo mode and reduce friction.
   - Add "Try with a sample document →" CTA on landing that launches ChatPage with a pre-loaded public contract/PDF (no registration required)
   - Reduce registration form from 4 fields (name, email, password, confirm) to 2 required (email, password) — name optional, set later
   - Fix "Manage plan" to link to Paddle customer portal URL (obtainable via Paddle API /customers/{id}/portal-sessions) rather than mailto

---

Redesign principles in priority order:
1. Principle #6 Honest — every claim, label, and price maps 1:1 to actual behavior; false promises removed before any other work
2. Principle #8 Thorough — every interactive surface has empty / loading / error / success / focus / disabled states; no state is browser-default or missing
3. Principle #9 Environmentally friendly — landing page JS payload under 400 KB; no unconditional idle animations; prefers-reduced-motion honored
4. Principle #3 Aesthetic — one CSS authoring system, one off-white token, one type scale, one token set shared across all three surfaces
5. Principle #2 Useful — primary task reachable in ≤5 steps including demo path; no self-service action replaced by an email compose window

---

Deliverables for the plan:
- Per-fix: target file, exact change, verification step (grep or rendered state check)
- Honesty fixes first — all label/behavior mismatches patched before any visual changes ship
- Token/spec changes consolidated: one PR that migrates MyPage.css + LandingPage.css to --lexara-* variables
- New LandingPage hero without p5.js: static CSS background, same warm palette
- Migration path: LandingPage redesign ships as a replace (no A/B flag needed — old inline-style version is structurally unmaintainable)
- Regression checklist: ChatPage scoring (currently best-performing surface) must remain unchanged

Out of scope for this redesign pass:
- ChatPage.jsx and ChatPage.css (do not touch)
- ChatMessage.jsx source card visual design (do not touch)
- Backend / billing logic (already correct)
- AdminPage.jsx (out of scope)

Anti-patterns to guard against:
- Porting the inline-style structure under new CSS class names (old structure → new file = still the same problem)
- Keeping the p5.js canvas "but lighter" — remove it entirely
- Fixing label text without fixing the underlying behavior (changing "Contact sales" to "Sign up" still routes users wrong if the modal CTA remains onSignUp)
- Treating the Preserve list as optional — ChatPage must not change in this pass
- Designing a "trial" UI without first confirming Paddle supports trial enforcement in the billing backend
````
