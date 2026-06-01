# 04 — Handoff Prompt

```
/make-plan Redesign the Lexara chat page empty/welcome state. Current design scored 17/30 in a Dieter Rams audit with critical gaps in principles #3 (aesthetic), #8 (thorough), and #10 (as little design as possible).

Verdict (from 03-verdict.md):
> REDESIGN the chat empty state: total score is 17/30 (below the 20-point REFINE threshold), with three principles scoring 1 (#3 aesthetic, #8 thorough, #10 as little design as possible) — the surface has accumulated structural contradictions (two simultaneous no-workspace signals, an animated empty div, missing focus rings, suggestion chips that precede uploadable content) that cannot be patched individually without addressing the underlying layout logic.

Why redesign and not refine: Three principles scored 1 and the total is 17/30; the no-workspace path has two simultaneously-firing UI elements (overlay + inline card) that share the same purpose but cannot be deduplicated with a single CSS change — the JSX logic must be restructured.

Preserve from current design:
- CSS custom property color system (--color-*, --lexara-*, referenced in ChatPage.css) — do NOT introduce new tokens
- Personalized time-of-day greeting with first name (ChatPage.jsx:412–419) — this scored well and is a differentiator
- The 3-step onboarding sequence (step labels + states: done/current/pending) at ChatPage.jsx:434–460 — the content is correct, only the surrounding layout is broken
- `prefers-reduced-motion` gating already in ChatPage.css:742–751 — must be preserved
- Paper-fan staggered entrance animation on chips (ChatPage.css:707–713) — tasteful; keep if motion is on

Discard (structural patterns causing failures):
- `.workspace-name-overlay` (ChatPage.jsx:402–407 + ChatPage.css:160–188): fires simultaneously with the inline no-workspace card; caused failure on #10 (as little design as possible) and #4 (understandable). Remove entirely.
- `paper-float 4.5s ease-in-out infinite` on `.chat-empty-copy` (ChatPage.css:702–704): animates an empty div with no visible children; caused failure on #9 and #10. Remove or repurpose.
- Suggestion chips gated on `hasWorkspaceName` alone (ChatPage.jsx:462–474): chips appear before any document is uploaded, causing false affordances; caused failure on #6 (honest) and #2 (useful). Restructure gate to require `documentCount > 0`.

Top 5 moves (verbatim from audit):
1. #10 / #4 — Eliminate double no-workspace signal: remove `.workspace-name-overlay` entirely; the `.chat-empty-no-workspace` inline card (ChatPage.jsx:422–427) is the single source of truth for the no-workspace state.
2. #8 — Add `focus-visible` ring to `.chat-empty-chip` (currently absent from ChatPage.css); add a loading skeleton for the empty state (when workspace list is loading); add an error card for when workspace load fails.
3. #3 — Adopt 4px base unit: collapse 8 spacing values (32, 24, 22, 16, 14, 10, 8, 6 px) to a 4-step scale (8, 16, 24, 32); reduce font-size count from 5 to 3 (1.5rem heading, 14px body, 11px caption).
4. #6 / #2 — Gate suggestion chips on `documentCount > 0`, not `hasWorkspaceName`. When 0 docs: show a single prominent upload button below the onboarding steps instead of chips. ChatPage.jsx:462–474.
5. #9 — Delete `.chat-empty-copy` div and its `paper-float` animation (ChatPage.jsx:421–427 + ChatPage.css:702–704) — it contains only a commented-out h2 and serves no visible purpose.

Redesign principles in priority order:
1. #10 As little design as possible — every element must earn its place; one signal per intent
2. #8 Thorough — all interactive states (focus, loading, error) explicitly designed
3. #3 Aesthetic — single spacing scale, 3 font-size levels, greeting visually connected to next action
4. #2 Useful — user reaches first successful query in fewest steps (no false affordances)
5. #4 Understandable — one clear instruction per state; no parallel competing guides

Deliverables for the plan:
- New JSX structure for the empty state (single conditional tree, no layered absolute overlays)
- Updated ChatPage.css with 4px-base spacing consolidation for empty-state rules only
- `.chat-empty-chip:focus-visible` rule
- Loading skeleton component for empty-state (when `loadingWorkspaces` is true)
- Error card component for workspace load failure
- `documentCount` prop or derived state to gate chip visibility
- Migration: the old `.workspace-name-overlay` CSS block can stay in the file but should be marked `/* REMOVED — see redesign 2026-06-01 */` until confirmed safe to delete

Anti-patterns to guard against:
- Porting the old overlay logic under a new class name
- Adding a third UI element to resolve the two-element conflict (add one, remove two)
- Animating new elements without checking the prefers-reduced-motion block at ChatPage.css:742–751
- Introducing new CSS tokens not already in the design system
```
