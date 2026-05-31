# Verdict — REDESIGN

**MyPage "My info" tab scores 15/30 and requires a redesign** — a raw i18n key renders in production (aesthetic failure), a misleading label ships to every user (honesty gap), and 4+ interaction states are missing including the highest-stakes one (quota-full with no upgrade path).

## Top 5 leverage moves

1. **#3 Aesthetic + #4 Understandable — Fix production i18n breakage.** `t('used_this_month')` renders raw in production (MyPage.jsx:339, confirmed in screenshot). Replace with existing `t('per_month')` key which already exists in all 5 languages. Fix in `< 5 min`.

2. **#2 Useful + #8 Thorough — Add quota-full state with upgrade CTA.** When `queriesPct >= 100`, render a distinct banner with an "Upgrade" button. Currently the bar and number turn red with no actionable next step (MyPage.jsx:173, getBarColor logic). This is the highest-revenue moment in the app and has no UI.

3. **#4 Understandable + #6 Honest — Fix "Email us to change plan".** Label implies form action; behavior is `mailto:` (MyPage.jsx:465). Either rename to "Contact support" or convert to the in-app SupportTab question form.

4. **#8 Thorough — Add focus rings and disabled states to all interactive elements.** Tabs, sign-out button, and upgrade buttons have no `:focus-visible` rules in MyPage.css. Upgrade buttons have `disabled` attr in JSX (lines 424, 443) but no visual CSS for the disabled state. Users on keyboard or assistive tech hit invisible controls.

5. **#10 As little as possible — Remove duplicate referralCode derivation and dead useRef.** `referralCode`/`referralLink` computed in MyPage main component (lines 176–179) are never used there — all referral rendering is in PromoTab. `useRef` imported (line 1) but never called. These add confusion to the codebase and signal the component's logic is inconsistent.
