# 00 — Scope (Chat Empty State Audit 2026-06-01)

**Surface audited:** Lexara chat interface — empty/welcome state only
**Component paths:**
- `frontend/src/pages/ChatPage.jsx` lines 395–490
- `frontend/src/styles/ChatPage.css` — .chat-empty-state, .chat-greeting, .chat-empty-no-workspace, .onboarding-steps, .chat-empty-chip, .workspace-name-overlay

**Primary user:** Non-technical professional logging in for the first time (or with an empty workspace)
**Primary task:** Understand what to do next — create a project, upload a document, ask a question

**Constraints:** React/JSX + CSS custom properties, 5 languages (en, ko, ru, uz, ja), dark mode via CSS vars, prefers-reduced-motion respected
**Out of scope:** Message thread, sidebar, input area, header, auth pages
