# Evidence — MyPage "My info" tab

## Structural

- **Interactive elements:** 11 (4 tabs, 1 language select, sign-out btn, upgrade-pro btn, upgrade-business btn, email-support btn, referral-copy btn, promo-apply btn)
- **Max nesting depth:** 9 (tab conditional → upgrade-grid → upgrade-card → upgrade-features → feature map → div)
- **Repeated patterns:** 3
  - `referralCode`/`referralLink` computed in both main component (MyPage.jsx:176–179) and PromoTab (lines ~489–492) — duplicate derivation; main-component vars are dead (never rendered)
  - `/auth/me` fetched in two separate `useEffect` hooks: initial load + inside Paddle checkout callback
  - `upgradeError` banner rendered in two separate branches (plan=free guard and plan≠free guard) doing identical work
- **Dead code:** 4 items
  - `referralCode`, `referralLink` declared in main component, never used there
  - `useRef` imported (line 1), never called
  - CSS class `.mypage-stats-grid` (MyPage.css:129–133) — no JSX reference
  - CSS class `.mypage-btn-primary` used in SupportTab submit btn (line 94) — no CSS definition

## Visual (INFERRED)

- **Spacing scale:** 14 distinct values (4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 48, 60px in padding/gap/margin)
- **Type scale:** 10 distinct font sizes (10, 11, 12, 13, 14, 16, 18, 22, 24, 36px)
- **Distinct literal colors:** ~20 (rgba(239,68,68,...) × 4 variants; #dc2626, #ef4444, #22c55e, rgba(34,197,94,...), #f59e0b, rgba(245,158,11,...), #7c3aed, plus 6 PLAN_GRADIENTS literals — all outside CSS variable system)
- **States checklist (usage section):**
  - empty (0 queries): ✅ MyPage.jsx:327–329 — `.mypage-stat-empty` text
  - loading: ✅ MyPage.jsx:278–286 — skeleton cards
  - error (usage section): ❌ catch at line 188 is `.catch(() => {})` — silently ignored, no UI
  - quota-full (100%): ❌ only bar+number color changes to red; no message, no upgrade CTA
  - focus rings on tabs/sign-out/upgrade buttons: ❌ no `:focus-visible` rules in MyPage.css for these
  - disabled styling on upgrade buttons: ❌ disabled attr set in JSX but no `:disabled` CSS rule

## Copy & Honesty

- **Raw i18n key visible in production:** `used_this_month` (MyPage.jsx:339) — `t('used_this_month')` returns the key string (not undefined), so `|| 'used this month'` fallback never fires. Confirmed by screenshot showing "21 of 100 used_this_month" with literal underscores.
- **Missing translation keys:** `t('of')` and `t('used_this_month')` — neither exists in translations.js
- **Label → behavior mismatch:** "Email us to change plan" (line 465) opens `mailto:` — implies form, delivers email client
- **Jargon:** "remaining" label (line 323) has no unit noun adjacent — "79" alone is ambiguous without the sub-label
- **Untranslated:** `/oy` suffix on prices (lines 414, 432) — Uzbek "per month" hardcoded in English pricing cards
- **Hardcoded English with no `t()` calls:** PromoTab "Redeem a promo code", "Enter code", "Apply"; SupportTab "Ask a Question", "My Tickets", "Submit Question"
- **No confirmation state:** "Copy" button (referral link) has no visual flip to "Copied!" after clipboard write
- **`mypage-btn-primary`:** CSS class applied to SupportTab submit button but defined nowhere — appearance undefined

## Weight & Friction (app-level)

- **JS bundle:** 950.64KB minified / 281.53KB gzip (full app; not MyPage-only)
- **Idle animations:** Loading skeleton has CSS sweep animation (gated behind `loading === true`); no idle animations on the profile page itself
- **Notifications/modals on load:** 0 (intent-banner only shows if `intentPlan` state is set via URL param)
