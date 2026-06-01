# 02 — Scorecard (Chat Empty State)

Total: **17 / 30** — REDESIGN threshold triggered (< 20)

---

1. Good design is innovative — **Score: 2/3**
   Evidence: Personalized time-of-day greeting with first name (ChatPage.jsx:412–419); sequential 3-step onboarding pattern (ChatPage.jsx:434–460).
   Justification: Refreshes the empty-state pattern with a conversational greeting — a clear improvement over static "get started" screens — but not a novel pattern across the industry.

2. Good design is useful — **Score: 2/3**
   Evidence: Primary task (create → upload → ask) is front-and-center when workspace exists; suggestion chips are immediate shortcuts. BUT chips appear before any document is uploaded (ChatPage.jsx:462–474), making them false affordances that lead to error responses.
   Justification: Primary task completes but adjacent surface adds a misleading step when clicked pre-upload.

3. Good design is aesthetic — **Score: 1/3**
   Evidence: 8 distinct spacing values with no base unit (32, 24, 22, 16, 14, 10, 8, 6 px); 5 font sizes across a 3-level hierarchy; greeting visually disconnected from onboarding steps (no linking element).
   Justification: 3–5 spacing inconsistencies and an orphaned greeting block — the surface lacks a single visible design system.

4. Good design is understandable — **Score: 2/3**
   Evidence: 3-step labels are clear and sequential. BUT no-workspace state shows overlay arrow (ChatPage.jsx:402–407) AND inline card (ChatPage.jsx:422–427) simultaneously — two competing instructions for the same action.
   Justification: One control (the create-project instruction) is unclear due to duplication; everything else reads cleanly.

5. Good design is unobtrusive — **Score: 2/3**
   Evidence: ThreeBackground at opacity 0.15 (ChatPage.jsx:317); staggered animations quiet; workspace-name-overlay uses inset:0 pointer-events:none so does not block interaction but does visually dominate (ChatPage.css:160–188).
   Justification: Chrome is visible but largely quiet; overlay fills the screen but is non-interactive.

6. Good design is honest — **Score: 2/3**
   Evidence: No dark patterns or inflation detected. Minor: suggestion chips promise queries before document upload is possible (ChatPage.jsx:462–474).
   Justification: One minor false affordance — chips imply answerability when no docs exist.

7. Good design is long-lasting — **Score: 2/3**
   Evidence: CSS custom properties throughout; no skeuomorphic residue. Emoji 👋 (ChatPage.jsx:417) and paper-physics animation theme are 2023–2024 markers.
   Justification: One/two dated trend markers; overall language will age acceptably.

8. Good design is thorough — **Score: 1/3**
   Evidence: Focus rings missing on chip buttons (ChatPage.css has no .chat-empty-chip:focus-visible rule); loading and error states absent from empty-state surface; `paper-float` fires on `.chat-empty-copy` which has no visible children (ChatPage.css:702–704).
   Justification: 3 missing states (loading, error, focus) and one broken animation on empty content.

9. Good design is environmentally friendly — **Score: 2/3**
   Evidence: prefers-reduced-motion gated (ChatPage.css:742–751); ThreeBackground conditionally rendered. `paper-float 4.5s infinite` runs on an empty div consuming GPU cycles unnecessarily (ChatPage.css:702–704).
   Justification: Motion generally gated but one idle infinite animation on invisible content wastes resources.

10. Good design is as little design as possible — **Score: 1/3**
    Evidence: Two simultaneous no-workspace signals: overlay (ChatPage.jsx:402–407) + inline card (ChatPage.jsx:422–427). `.chat-empty-copy` div animates with paper-float but contains zero visible content (ChatPage.jsx:421–427). Animated empty div is pure overhead.
    Justification: 3–5 removable elements: overlay can be removed in favour of the inline card; empty animated div can be removed; one of the two no-workspace guides is redundant.
