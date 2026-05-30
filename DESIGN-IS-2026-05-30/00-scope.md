# 00 — Scope

## What is being audited
**The "Upgrade to Pro" flow** across two surfaces:
1. Landing page pricing section — three-card grid (Free / Pro / Business) + pricing modal
2. MyPage subscription tab — in-app upgrade path for authenticated users

**Files in scope:**
- `frontend/src/pages/LandingPage.jsx` — pricing grid (lines 419–455), pricing modal (lines 513–554)
- `frontend/src/pages/MyPage.jsx` — subscription tab (lines ~37–444)
- `frontend/src/styles/LandingPage.css` — pricing + modal CSS
- `frontend/src/index.css` — design tokens
- `frontend/dist/index.html` — bundle composition

## Primary user
A visitor who has read the landing page, decided they want Pro ($19/mo), and is trying to complete the upgrade.

## Primary task
Select the Pro plan and complete payment — ending with an active Pro subscription in their account.

## Constraints
- Stack: React + Vite, Paddle payments, FastAPI backend
- Brand: Lexara — dark SaaS, Inter/DM Mono, blues/purples
- Accessibility floor: WCAG AA (4.5:1 normal text, 3:1 large)
- No server-side changes in scope for this audit

## Audit date
2026-05-30

## Verdict destination
`03-verdict.md` → `/make-plan` handoff in `04-handoff-prompt.md`
