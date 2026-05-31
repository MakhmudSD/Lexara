# Scorecard — MyPage "My info" tab

**Total: 15 / 30**

---

1. **Good design is innovative — Score: 1/3**
   Evidence: Standard SaaS profile tab pattern (tabs, usage bar, account rows). "Remaining queries" as hero number with color coding is a minor refinement over "used N of N" patterns.
   Justification: Refreshes the pattern with color-coded remaining count, but nothing not seen in 5+ peer SaaS products.

2. **Good design makes a product useful — Score: 2/3**
   Evidence: "79" in large green is immediately prominent on page load; bar + sub-label provide context. Primary task (check quota) completes in one view. No upgrade CTA appears when quota hits 100%.
   Justification: Primary task completes but adjacent surface (no upgrade path at quota-full) adds steps for the most critical next action.

3. **Good design is aesthetic — Score: 1/3**
   Evidence: 10 distinct font sizes (10–36px); ~20 literal color values outside CSS variable system; "used_this_month" raw key visible in production screenshot (line 339, confirmed in screenshot).
   Justification: Jarring violation (raw i18n key in primary metric) plus 3–5 inconsistencies (type scale, color count) puts this at 1, not 2.

4. **Good design makes a product understandable — Score: 1/3**
   Evidence: "remaining" label (line 323) has no unit — "79 remaining" is ambiguous without sub-label; "Email us to change plan" (line 465) implies form, delivers mailto; `/oy` Uzbek suffix in English pricing.
   Justification: 2–3 controls unclear (unit-less stat, misleading email label, untranslated pricing suffix) — scores 1 not 2.

5. **Good design is unobtrusive — Score: 2/3**
   Evidence: No background decoration, no sidebar chrome, no idle animations on the info tab. Avatar + tab underline are present but recede.
   Justification: Chrome is visible (avatar gradient, plan card gradient border) but quiet — content dominates.

6. **Good design is honest — Score: 2/3**
   Evidence: "Email us to change plan" (line 465) opens `mailto:` — label implies form action. `/oy` in English pricing (lines 414, 432) is a language mismatch, not a false claim. No dark patterns or fake scarcity.
   Justification: 1 label→behavior mismatch (email) and 1 language error, but no deceptive flows — scores 2 not 1.

7. **Good design is long-lasting — Score: 2/3**
   Evidence: Tab navigation, usage bars, account-row pattern — all timeless. One dated marker: `#7c3aed` purple gradient on Pro plan card (PLAN_GRADIENTS, MyPage.jsx:27–30) is characteristic of 2023–24 SaaS purple trend.
   Justification: One dated trend marker with otherwise timeless visual language.

8. **Good design is thorough — Score: 1/3**
   Evidence: Error state in usage silently ignored (catch → `{}`, line 188); quota-full has no dedicated UI; focus rings absent on tabs, sign-out, upgrade buttons; `mypage-btn-primary` CSS class undefined; "Copy" has no confirmation state.
   Justification: 4+ details missing or rough — scores 1 at best.

9. **Good design is environmentally friendly — Score: 2/3**
   Evidence: Bundle 950KB / 281KB gzip (whole app); no idle animations on MyPage; dark mode tokens in system; loading skeleton is CSS-only.
   Justification: Bundle exceeds 500KB for whole app but MyPage itself adds no idle animation or motion — scores 2.

10. **Good design is as little design as possible — Score: 1/3**
    Evidence: Dead `referralCode`/`referralLink` in main component (lines 176–179); unused `useRef` import; `upgradeError` rendered in two identical branches; 4 UI elements all communicating the same quota fact (number, label, bar, sub-label).
    Justification: 3–5 removable elements and duplicate patterns — scores 1.
