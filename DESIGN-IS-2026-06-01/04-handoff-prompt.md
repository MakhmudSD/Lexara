# Handoff Prompt

````
/make-plan Redesign the Lexara MyPage "My info" tab. Current design failed audit at 15/30 with critical gaps in principles #3 (aesthetic), #4 (understandable), #8 (thorough).

Verdict paragraph:
> MyPage "My info" tab scores 15/30 and requires a redesign — a raw i18n key renders in production (aesthetic failure), a misleading label ships to every user (honesty gap), and 4+ interaction states are missing including the highest-stakes one (quota-full with no upgrade path).

Why redesign and not refine: Total 15/30 is below the 20-point refine threshold; #3 aesthetic scored 1 due to a production defect in the primary metric, and #8 thorough scored 1 due to 4+ missing states on a page where quota status is the primary user concern.

Preserve from current design:
- Avatar + initials + email + role badge layout (MyPage.jsx:293–300) — visually clean, no changes needed
- Tab navigation pattern (MyPage.jsx:305–313) — timeless; keep tab structure, fix tab focus rings only
- Loading skeleton (MyPage.jsx:278–286) — already correct
- Empty-state for 0 queries (MyPage.jsx:327–329) — works correctly

Discard:
- `t('of')` + `t('used_this_month')` i18n pattern (MyPage.jsx:339) — keys don't exist in translations, fallback never fires due to truthy key-string return. Caused failure on #3 aesthetic.
- "Email us to change plan" button (MyPage.jsx:465) — opens mailto, label implies form. Caused failure on #4 understandable and #6 honest.
- Dead `referralCode`/`referralLink` in main component (MyPage.jsx:176–179) — never rendered there, all referral in PromoTab. Caused #10 failure.
- Unused `useRef` import (MyPage.jsx:1). Caused #10 failure.
- Dual `upgradeError` rendering in two branches (lines ~394, ~457) — same banner, same purpose, duplicated. Caused #10 failure.

Top 5 moves (implement in this order):

1. #3 Aesthetic + #4 Understandable — Fix production i18n breakage.
   Replace `${t('of') || 'of'} ${planLimits.queries} ${t('used_this_month') || 'used this month'}` (MyPage.jsx:339) with `/ ${planLimits.queries} ${t('per_month') || 'per month'}`. Key `per_month` exists in all 5 language files.
   Verification: grep -n "used_this_month\|t('of')" frontend/src/pages/MyPage.jsx returns 0 results.

2. #2 Useful + #8 Thorough — Add quota-full state with upgrade CTA.
   In the USAGE section, when `queriesPct >= 100`, render a distinct `.mypage-quota-full-banner` above the bar with text like "You've used all {planLimits.queries} queries this month" and an "Upgrade plan" button that switches to the Subscription tab (`setActiveTab('subscription')`). File: MyPage.jsx in the usage block after line 336.
   Verification: Set `stats.total_queries = planLimits.queries` in dev tools, confirm banner + CTA appear.

3. #4 Understandable + #6 Honest — Fix "Email us to change plan".
   Replace the `<a href="mailto:...">Email us to change plan</a>` button (MyPage.jsx:465) with a button that calls `setActiveTab('support')` and label it "Contact support to change plan". No new network request needed.
   Verification: Click the button, confirm the Support tab activates.

4. #8 Thorough — Add focus rings and disabled states.
   In MyPage.css, add `:focus-visible` rules for `.mypage-tab-btn`, `.mypage-signout-btn`, and `.mypage-upgrade-btn`:
   ```css
   .mypage-tab-btn:focus-visible,
   .mypage-signout-btn:focus-visible,
   .mypage-upgrade-btn:focus-visible {
     outline: 2px solid var(--color-accent);
     outline-offset: 2px;
   }
   .mypage-upgrade-btn:disabled {
     opacity: 0.55;
     cursor: not-allowed;
   }
   ```
   Also add `.mypage-btn-primary` definition (or rename SupportTab submit button to an existing class).
   Verification: Tab through the page with keyboard, confirm all controls show visible focus indicators.

5. #10 As little as possible — Remove dead code.
   Delete `referralCode` and `referralLink` declarations from main MyPage component (lines 176–179). Remove `useRef` from imports (line 1). Consolidate `upgradeError` banner into a single render (extract to a variable before the return, render once).
   Verification: npm run build passes, grep -n "useRef\|referralCode\|referralLink" frontend/src/pages/MyPage.jsx returns 0 lines outside PromoTab.

Out of scope for this redesign pass:
- The Subscription, Promo, FAQ tabs (separate audit needed)
- The overall page layout / card structure
- Adding new features (usage history, per-workspace breakdown)
- i18n audit of all hardcoded strings in PromoTab/SupportTab (large scope; file a separate issue)

Deliverables for the plan:
- Per-fix: target file + exact line range + change + verification step (see moves 1–5 above)
- CSS additions consolidated in one MyPage.css diff
- Regression checklist: loading skeleton still shows, empty state still shows, tab switching works, quota bar still color-codes

Anti-patterns to guard against:
- Porting old structure under new styling (the Preserve list above must be kept intact)
- Adding new features in this pass (quota-full banner CTA points to existing Subscription tab, not new UI)
- Letting the fix for one principle break another (focus ring CSS must not override other `:focus` rules)
````
