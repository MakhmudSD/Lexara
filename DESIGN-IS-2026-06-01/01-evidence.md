# 01 — Evidence

## Structural

| Metric | Value | File:Line |
|--------|-------|-----------|
| Interactive elements | 3 chip buttons only | ChatPage.jsx:465–474 |
| Max JSX nesting depth | 6 | ChatPage.jsx:409–478 |
| Repeated patterns | 2 (onboarding-step ×3, icon ×3) | ChatPage.jsx:434–460 |
| Dead classnames | 0 | — |
| Conditional gates | 4 | ChatPage.jsx:402–478 |

**Critical: Gates 2 + 3 fire simultaneously** — `!hasWorkspaceName && isEmpty` triggers BOTH the `.workspace-name-overlay` (absolute, inset:0) AND the `.chat-empty-no-workspace` inline card. Two competing guides for the same action. ChatPage.jsx:402–407 and 422–427.

## Visual

**Spacing (px):** 32, 24, 22, 16, 14, 10, 8, 6 — 8 distinct values, no base unit
**Font sizes:** 1.5rem, 16px, 14px, 13px, 11px — 5 sizes for a 3-level hierarchy
**Colors:** all CSS vars, no hard-coded hex (good)
**States:** empty ✓, loading ✗, error ✗, success ✗, focus ring ✗, disabled ✓
**Dead animation:** `paper-float 4.5s infinite` on `.chat-empty-copy` which has NO visible children (commented-out h2). ChatPage.css:702–704.
**prefers-reduced-motion:** YES, ChatPage.css:742–751

## Copy & Honesty

**Suggestion chips shown before any document uploaded:** `hasWorkspaceName` alone gates chips (ChatPage.jsx:462–474). Clicking "What are the main topics?" when no docs exist triggers an error. False affordance.
**Fallback string mismatches:**
- ChatPage.jsx:425 fallback ≠ translations.js `create_project_prompt` value
- ChatPage.jsx:458 fallback ≠ translations.js `step_ask_sub` value
**Jargon:** "PDF, DOCX, TXT" — minor (widely known)
**Inflation/dark patterns:** None
