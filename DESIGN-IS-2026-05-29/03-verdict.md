# Verdict — Lexara Platform Design Audit

## REDESIGN

**Total score: 10/30. Two load-bearing principles scored 0 — Honest (#6) and Thorough (#8) — and the total falls well below the 20-point REFINE threshold; the platform's bones are sound in the chat UX but its surface layer (LandingPage, MyPage) must be rebuilt from the principles, not iterated.**

Why redesign and not refine: Three independent conditions each individually trigger REDESIGN — (1) total < 20, (2) Honest scored 0 (a deceptive flow: a 14-day trial promise with no implementation, a 1,000-vs-2,000 query-count mismatch between the same product's two screens), (3) Thorough scored 0 (5 states missing or broken on MyPage, including active removal of the focus indicator). These are not polish issues; they are trust and accessibility failures.

---

## Top 5 highest-leverage moves

**Move 1 — #6 Honest: Kill the false trial promise and fix the query mismatch**
- Remove "Try Pro free for 14 days. No credit card required" (LandingPage.jsx:429) entirely or implement it in billing.py and the Paddle checkout flow
- Align landing page pricing grid (LandingPage.jsx:342: "2,000 queries") with the enforced limit (MyPage.jsx:20: 1,000 queries) — pick one and apply it everywhere
- Replace "Manage plan" (MyPage.jsx:308) with an actual Paddle subscription management portal link, or change the label to "Email us to change plan"
- Replace "Contact sales" CTA (LandingPage.jsx:344) with a form or mailto link, not account creation
- Disclose mailto behavior on contact form before submit, not after

**Move 2 — #8 Thorough: Restore states on MyPage and LandingPage contact form**
- MyPage: add loading skeleton (CSS), error inline UI replacing `alert()` (MyPage.jsx:142), empty-zero state for stats, restore focus ring on `.mypage-lang-select` (MyPage.css:182 — remove `outline: none`, add `outline: 2px solid #2356d8` on focus)
- LandingPage contact form: add error styling on invalid `.contact-input` fields, add disabled state on submit button while `sent` is true, add `.faq-item.open` CSS rule in LandingPage.css (currently a dead selector)
- Pass `isLoading` from ChatPage.jsx to ChatMessage.jsx correctly, or remove the dead prop

**Move 3 — #9 Environmentally friendly: Remove p5.js particle canvas**
- Remove the `useEffect` at LandingPage.jsx:122–200 entirely — the canvas adds 870 KB and 60fps CPU load for a background decoration
- Replace with a static SVG or CSS gradient background if a textured hero is needed
- Add `prefers-reduced-motion` gate to the scroll-reveal transitions (`data-reveal`, LandingPage.jsx:202)
- Implement route-level code splitting (ChatPage, MyPage, AdminPage, LandingPage as separate chunks)

**Move 4 — #3 Aesthetic: Migrate LandingPage from 58 inline styles to CSS classes**
- Move all cosmetic inline `style={{...}}` from LandingPage.jsx to LandingPage.css using the existing CSS class names already defined there
- Delete the 5 near-identical off-white background values; standardize on `var(--lexara-bg)` (#f7f5f0) or `#faf9f7` — one token
- Reduce the type scale from 18 to 7 sizes: 11, 13, 14, 16, 22, 28, 42px — map every orphan to the nearest scale step
- Connect MyPage.css to the `--lexara-*` token system (currently 95% hardcoded hex)

**Move 5 — #2 Useful: Add a one-click demo mode**
- Add a "Try with a sample document →" path on the landing page that launches ChatPage with a pre-loaded public document (e.g., a short contract), requiring zero registration
- Reduce registration to 2 required fields (email + password) — Full Name can be optional/set later
- Fix "Manage plan" to link to Paddle's customer portal URL (available via Paddle API) rather than opening email
