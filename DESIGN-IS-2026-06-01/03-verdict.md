# 03 — Verdict

**REDESIGN** the chat empty state: total score is 17/30 (below the 20-point REFINE threshold), with three principles scoring 1 (#3 aesthetic, #8 thorough, #10 as little design as possible) — the surface has accumulated structural contradictions (two simultaneous no-workspace signals, an animated empty div, missing focus rings, suggestion chips that precede uploadable content) that cannot be patched individually without addressing the underlying layout logic.

## Top 5 Highest-Leverage Moves

1. **#10 / #4 — Eliminate the double no-workspace signal.** Remove `.workspace-name-overlay` entirely; the new `.chat-empty-no-workspace` inline card (ChatPage.jsx:422–427) is the single source of truth. The overlay at ChatPage.jsx:402–407 fires simultaneously and creates two competing instructions.

2. **#8 — Add focus rings to chip buttons and define loading/error states for the empty state.** `.chat-empty-chip:focus-visible` is completely absent from ChatPage.css. If workspace load fails, the empty state still shows the greeting with no feedback.

3. **#3 — Adopt a 4px base unit for the empty state.** Collapse 8 spacing values (32, 24, 22, 16, 14, 10, 8, 6 px) to a coherent scale (4, 8, 12, 16, 24, 32). Reduce font-size count from 5 to 3 (heading, body, caption).

4. **#6 / #2 — Gate suggestion chips on document count, not workspace name.** Chips should only appear when at least one document has been indexed. When no docs exist, replace chips with an upload-specific CTA (e.g., a prominent upload button). ChatPage.jsx:462–474.

5. **#9 — Remove the `paper-float` infinite animation from `.chat-empty-copy`.** The div has no visible children; the animation wastes GPU cycles. ChatPage.css:702–704. Either remove the div entirely or populate it with meaningful content before animating it.
