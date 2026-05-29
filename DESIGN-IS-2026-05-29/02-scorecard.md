# Scorecard — Lexara Platform Design Audit
# Total: 10 / 30

---

1. Good design is innovative — Score: 2/3
   Evidence: ChatPage streaming UX with real-time source card reveal (ChatPage.jsx:206–219) refreshes the static chat pattern with a clear improvement. Three-step onboarding in the empty state (ChatPage.jsx:409–437) is a competent, usable pattern not widely deployed at this fidelity. p5.js particle canvas on the landing (LandingPage.jsx:122–187) is a trend marker, not innovation.
   Justification: Refreshes existing patterns with clear UX improvements on the working screens; the landing reverts to fashionable decoration rather than product-led innovation — solid 2, not a breakthrough.

2. Good design makes a product useful — Score: 1/3
   Evidence: 9 discrete user actions required to reach first query (register 4 fields → upload → type → send). No guest/demo mode. No pre-loaded sample. "Manage plan" button opens mailto, not self-service (MyPage.jsx:308). "14-day trial" modal promise is not implemented anywhere in code.
   Justification: Primary task completes but requires unnecessary detours; 9 steps where 3 is the theoretical minimum, plus core utility actions (manage plan, try before buy) replaced by email-compose fallbacks.

3. Good design is aesthetic — Score: 1/3
   Evidence: 18 distinct font-size values with no scale token. ~42 hex colors including 5 near-identical off-whites and 4 near-identical secondary grays. LandingPage.jsx implements the entire page via 58 inline `style={{}}` blocks while LandingPage.css defines matching class names never applied to any element — a parallel dead CSS layer. MyPage.css is 95% disconnected from the `--lexara-*` token system defined in index.css.
   Justification: Far exceeds "3–5 inconsistencies" — the inline/CSS parallel dead-layer in LandingPage is one jarring systemic violation, and the 5-variant off-white cluster is a second; no single visible system operates across the three surfaces.

4. Good design makes a product understandable — Score: 1/3
   Evidence: 4 label-behavior mismatches: "Manage plan"→mailto, "Contact sales"→create account, "Send message →"→email client, "Choose Pro"→no trial. 10+ jargon instances including "LLM key", "sentence embeddings", "retrieval fallback mode", "Top-K" (translations.js:70, 162, 186). PLAN_FEATURES hardcoded in Uzbek only (MyPage.jsx:31–51), invisible in 4 languages.
   Justification: 2–3 controls unclear AND jargon present — understates it; 4 label/behavior inversions and 10+ jargon instances, with the worst being "Contact sales" that creates a free account rather than contacting anyone.

5. Good design is unobtrusive — Score: 2/3
   Evidence: ChatPage sidebar and input chrome recede behind content once a conversation is active. Source cards collapse behind a toggle. LandingPage particle canvas set to 35% opacity (LandingPage.jsx:253), positioned under content. MyPage tabs are quiet and non-intrusive. No modal appears on load.
   Justification: Chrome is visible but quiet on the working screens; the particle animation and emoji trust-line on the landing add decorative noise but don't dominate the primary reading path — solidly a 2 rather than a 3.

6. Good design is honest — Score: 0/3
   Evidence: (1) "Try Pro free for 14 days. No credit card required" (LandingPage.jsx:429) — no trial implementation anywhere in the codebase; clicks route to sign-up, not trial checkout. (2) Pro plan: 1,000 queries/month enforced (MyPage.jsx:20) vs 2,000 queries shown on landing page pricing grid (LandingPage.jsx:342) — factual mismatch. (3) "Contact sales" → `onSignUp()` (LandingPage.jsx:344, 441). (4) "Send message →" opens email client without pre-disclosure (LandingPage.jsx:33–39). (5) Referral reward presented as automatic; disclosed as manual only in footnote after link shared.
   Justification: Multiple deceptive flows — a false trial promise, a factual pricing mismatch between two screens, three label/behavior inversions that mislead about what will happen; meets the 0-score condition on multiple counts.

7. Good design is long-lasting — Score: 1/3
   Evidence: ChatPage visual language (warm off-white, near-black, single accent blue, monospace for meta) is restrained and would age well. Dated markers: (1) macOS traffic-light dots on demo (LandingPage.jsx:299–301) — 2015–2022 trend; (2) p5.js generative particle canvas (LandingPage.jsx:122–187) — 2019–2024 portfolio-site trend; (3) 68px hero headline (LandingPage.jsx:256) — big-bold-type trend from 2020–2024.
   Justification: 2–3 dated trend markers present on the landing page; the chat UX itself would age well but the marketing surface has three trend-dated choices.

8. Good design is thorough down to the last detail — Score: 0/3
   Evidence: MyPage.css: 5 states missing or broken — empty ✗, loading ✗, error ✗ (catch uses `alert()`, MyPage.jsx:142), focus removed with no replacement (`outline: none` on `.mypage-lang-select`, MyPage.css:182), disabled ✗. LandingPage contact form: error ✗, disabled ✗, loading ✗. `.faq-item.open` CSS class emitted in JSX (LandingPage.jsx:9) but no matching CSS rule exists — dead selector. `isLoading` prop on ChatMessage never passed by ChatPage (ChatMessage.jsx:94, ChatPage.jsx:458).
   Justification: MyPage has 5 states missing — exceeds the 4+ threshold for a 0; focus indicator actively removed with no substitute is an additional detail failure; worst surface scores 0 by the rubric.

9. Good design is environmentally friendly — Score: 1/3
   Evidence: Total landing page JS payload ~1.25 MB (384 KB app bundle + 870 KB p5.js CDN, LandingPage.jsx:124). p5.js runs a 120-particle draw loop at 60fps unconditionally — no `prefers-reduced-motion` gate, no IntersectionObserver, no lazy load. No code splitting (single JS chunk). No dark mode.
   Justification: 500 KB–2 MB total with motion always on; the p5.js canvas is the clearest violation — a 870 KB library loaded for a decorative background animation with no prefers-reduced-motion respect.

10. Good design is as little design as possible — Score: 1/3
    Evidence: 58 inline `style={{}}` blocks in LandingPage.jsx implementing a full styling system alongside unused CSS classes (structural duplication). 5 off-white color values for one background role. 4 gray values for one text role. 18 font sizes vs the ~6 needed. Removable: p5.js particle canvas, macOS traffic-light dots, emoji trust line (LandingPage.jsx:262), 4 instances of sign-in/sign-up CTAs (2 each would suffice), "Manage plan" that only opens email.
    Justification: Far exceeds "3–5 removable elements" — the inline CSS system is the dominant unnecessary layer, plus the decorative additions and repeated CTAs; scores 1 (not 0 because content-to-decoration ratio is still positive on the chat surface).

---

TOTAL: 2+1+1+1+2+0+1+0+1+1 = 10 / 30

Principles that scored 0 (load-bearing):
- #6 Honest (0) — multiple deceptive flows, factual mismatch
- #8 Thorough (0) — 5 states missing/broken on MyPage, dead CSS selector, removed focus indicator
