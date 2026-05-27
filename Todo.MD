# Lexara — Production Roadmap

Last updated: 2026-05-27
Status: LIVE at lexara-top.vercel.app + rag-project-production-80af.up.railway.app

---

## 🔴 CRITICAL — Do this week

- [ ] Change JWT_SECRET_KEY in Railway Variables to a real 32+ char secret
      Run: python3 -c "import secrets; print(secrets.token_hex(32))"
      Then: Railway → RAG-project → Variables → JWT_SECRET_KEY
- [ ] Buy domain (~$15/yr on Namecheap/Porkbun)
- [ ] Add domain to Railway + Vercel, update ALLOWED_ORIGINS + VITE_API_URL
- [ ] Add real SENTRY_DSN to Railway Variables + Vercel env vars
- [ ] Server-side quota enforcement: 50 queries/month for free users
- [ ] Email SMTP for password reset (resend.com free tier)
      Token flow exists — just needs SMTP wiring

---

## 🟡 Auth — Before taking payments

- [ ] Email verification on register
- [ ] Password reset sends real email (token flow exists, needs SMTP)
- [ ] Session expiry handling in frontend (auto-logout on JWT expire)
- [ ] Rate limiting on /auth/login (slowapi installed, add @limiter.limit)

---

## 🟡 Data & Observability

- [ ] 90-day auto-cleanup cron (service exists, needs APScheduler)
- [ ] PostgreSQL daily backup (script exists at backend/scripts/backup_db.py)
- [ ] Enable Railway managed backups (Postgres service → Settings → Backups)
- [ ] Real Sentry DSN from sentry.io free tier

---

## 🟢 Payment — After first 10 users

- [ ] Stripe or Paddle account (Paddle recommended for UZ payouts)
- [ ] Migration 009: stripe_customer_id + plan + queries_this_month columns
- [ ] POST /billing/create-checkout + POST /billing/webhook
- [ ] Quota enforcement tied to plan column
- [ ] Pricing CTAs link to real Stripe checkout

---

## 🟢 Quality & Performance

- [ ] Enable reranking: ENABLE_RERANKING=true in Railway (15-25% quality lift)
- [ ] BM25 hybrid retrieval (~2 days, biggest quality improvement)
- [ ] S3/Cloudflare R2 for uploaded file storage (files lost on redeploy)
- [ ] Conversation history persisted to PostgreSQL (currently localStorage)

---

## 🟢 UX Polish

- [ ] Test mobile on real device
- [ ] Document list in workspace (show uploaded docs, allow delete)
- [ ] Conversation export to PDF
- [ ] Workspace sharing (invite another user)

---

## 🔵 Post-launch Growth

- [ ] GitHub Actions CI/CD (auto-deploy on push to main)
- [ ] PostHog or Mixpanel for user analytics
- [ ] API key system for developers
- [ ] Team/organization workspaces UI

---

## ✅ Done — Production verified live

- [x] Deployed: Railway (backend) + Vercel (frontend) — LIVE
- [x] JWT auth with bcrypt, role-based access
- [x] Admin panel at /#admin with user management, search, role toggle
- [x] Full RAG pipeline (upload → chunk → embed → retrieve → answer)
- [x] Background embedding (upload returns instantly, embeds async)
- [x] SSE streaming responses
- [x] Token usage tracking in PostgreSQL
- [x] FAISS auto-rebuild from PostgreSQL on every startup
- [x] Sentence-aware chunking (no mid-word splits)
- [x] Conversational LLM prompt (natural language, same language as user)
- [x] Confidence badges (friendly UX — amber/gray, no red alarms)
- [x] Low-score warning injected into LLM system prompt
- [x] Admin conversations quality monitoring with score column
- [x] Cross-encoder reranking service (ENABLE_RERANKING flag, off by default)
- [x] Password reset flow (token returned in dev mode)
- [x] Soft delete for users
- [x] Security headers middleware
- [x] Filename sanitization
- [x] Unicode workspace names (Uzbek/Korean/Russian/Japanese)
- [x] Mobile sidebar hamburger
- [x] i18n: EN/KO/RU/UZ/JA — full UI coverage
- [x] Landing page with pricing modal gate
- [x] Privacy + Terms pages (GDPR-compatible)
- [x] Lexara logo and brand identity
- [x] CORS hardcoded fallback for Vercel
- [x] TTL cache for embeddings (24h) and retrieval (5min)
- [x] PostgreSQL connection pool tuning
- [x] 90-day cleanup service (needs scheduler)
- [x] make_admin script (backend/scripts/make_admin.py)
- [x] pg_dump backup script (backend/scripts/backup_db.py)
- [x] Migrations 001-008 applied in production
- [x] Conversation sessions in sidebar
- [x] Suggested questions with full i18n

---

## 📊 Current State

Frontend: https://lexara-top.vercel.app
Backend:  https://rag-project-production-80af.up.railway.app
Admin:    https://lexara-top.vercel.app/#admin
Admin account: makhwork15@gmail.com

Next 3 actions in order:
  1. JWT_SECRET_KEY → update in Railway now
  2. Buy domain → point to Railway + Vercel
  3. SMTP → enable real password reset emails