# Scope — Lexara Platform UI Audit

**Date:** 2026-05-29  
**Auditor:** claude-mem:design-is (Dieter Rams framework)

## What is being audited

Three primary surfaces of the Lexara SaaS document Q&A platform:

1. **ChatPage** — `frontend/src/pages/ChatPage.jsx` + `ChatPage.css`
   - Sidebar (sessions, workspace selector)
   - Message bubbles (user/assistant/system)
   - Upload UX (progress bar, status)
   - Source cards (confidence badges, excerpts)
   - Onboarding empty state (3-step flow)

2. **MyPage** — `frontend/src/pages/MyPage.jsx` + `MyPage.css`
   - Profile tab (avatar, stats, usage bars)
   - Subscription tab (plan card, upgrade grid)
   - Promo tab (referral link, steps)

3. **LandingPage** — `frontend/src/pages/LandingPage.jsx` + `LandingPage.css`
   - Hero (headline, subhead, CTA)
   - Demo mockup
   - Features grid
   - Pricing section (dark)
   - FAQ accordion
   - Contact form
   - Footer

## Primary user
Knowledge workers (legal, research, business) who need to query dense documents — contracts, reports, research papers.

## Primary task
Upload a document → ask a question → get a cited answer in seconds.

## Stack constraints
- React SPA, Vite, CSS modules (flat CSS files)
- Light theme primary; no dark mode currently
- 5 languages (en, ko, ru, uz, ja)
- Brand: `#2356d8` (Lexara blue), `#1a1814` (near-black), `#faf9f7` (warm off-white)

## Reference
No explicit competitor referenced. Implied peers: Notion AI, ChatPDF, Claude.ai.
