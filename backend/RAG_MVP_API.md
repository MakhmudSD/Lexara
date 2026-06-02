# Lexara API

Base URL: configured via environment  
Auth: Bearer JWT token required on all routes except /auth/register and /auth/login

## Auth
POST /auth/register — create account  
POST /auth/login — returns JWT  
GET  /auth/me — current user  

## Workspaces
POST /workspaces — create workspace  
GET  /workspaces — list your workspaces  
PATCH /workspaces/{id}/name — rename  
DELETE /workspaces/{id} — delete  

## Documents
POST /documents/upload — upload PDF/DOCX/TXT  
GET  /documents — list workspace documents  

## Chat
POST /chat/query — RAG query, returns answer + sources  
POST /chat/stream — streaming RAG response  

## Admin (admin role only)
GET /admin/health  
GET /admin/logs  
GET /admin/requests  
GET /admin/conversations  
