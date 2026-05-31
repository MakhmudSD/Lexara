# Scope — Lexara MyPage "My info" tab

**Audited surface:** MyPage profile page, "My info" tab  
**Live URL at audit time:** lexara-top.vercel.app (screenshot: 2026-06-01 02:45)  
**Component paths:**
- `frontend/src/pages/MyPage.jsx`
- `frontend/src/styles/MyPage.css`

**Primary user:** Authenticated Lexara user (any plan)  
**Primary task:** Check remaining query quota for the month; manage account language preference

**Constraints:**
- Stack: React + Vite frontend, FastAPI backend
- Brand: Lexara tokens (CSS custom properties in global stylesheet)
- Must support 5 languages (English, Uzbek, Korean, Russian, Japanese)
- Production app — changes must not break existing flows

**Reference:** screenshot `~/Desktop/Screenshot 2026-06-01 at 02.45.09.png`  
**Input material reviewed:** full MyPage.jsx, full MyPage.css, translations.js (grepped)
