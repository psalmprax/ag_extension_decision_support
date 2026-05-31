---
name: backend-api-debug
description: Debug and troubleshoot the Express/TypeScript backend API. Use when investigating middleware issues, authentication failures, route errors, CORS problems, rate limiting, i18n URL rewriting, or OpenAPI issues.
---

# Backend API Debugging

## Quick Diagnostics

```bash
# Health check (full dependency check)
curl http://localhost:7500/health | jq .

# Liveness/readiness probes
curl http://localhost:7500/health/live
curl http://localhost:7500/health/ready

# API version info
curl http://localhost:7500/api/versions

# Swagger docs
open http://localhost:7500/api-docs
```

## Middleware Stack (outermost first)

| Order | Middleware | File | Purpose |
|---|---|---|---|
| 1 | helmet | app.ts | Security headers (HSTS disabled for dev) |
| 2 | compression | app.ts | Gzip responses |
| 3 | cors | app.ts | CORS with configurable origins from config |
| 4 | morgan | app.ts | Request logging (combined format) |
| 5 | express.json | app.ts | JSON body parser (10mb limit) |
| 6 | cookieParser | app.ts | Cookie parsing |
| 7 | optionalAuth | authorize.ts | Parse optional JWT before rate limiting |
| 8 | perUserRateLimit | rateLimitMiddleware.ts | Per-user/IP rate limiting |
| 9 | securityGate | securityGate.ts | Security gate checks |
| 10 | i18nUrlMiddleware | i18nUrlMiddleware.ts | Locale prefix stripping for i18n URLs |

## Route Structure

All routes under `/api/v1/` with legacy `/api/` redirects. 30 route files covering:
auth, knowledge, chatbot, reporting, analytics, portfolio, users, farmers, visits,
alerts, external, language, ai, upload, notifications, sms, billing, contextMenus,
shares, support, telemetry, emailWorkflows, agents, systemHealth, diagnostics,
memories, diseases, whatsapp, apiClients, commercialKnowledge, mcp.

## Key Files

| File | Purpose |
|---|---|
| src/backend/src/app.ts | App init, middleware stack, route registration |
| src/backend/src/index.ts | Server entry point, port binding |
| src/backend/src/config/index.ts | Configuration singleton |
| src/backend/src/middleware/authorize.ts | JWT auth, optionalAuth, requireAuth |
| src/backend/src/middleware/errorHandler.ts | Global error handler |
| src/backend/src/middleware/rateLimitMiddleware.ts | Per-user rate limiting |
| src/backend/src/middleware/securityGate.ts | Security gate |
| src/backend/src/middleware/i18nUrlMiddleware.ts | i18n URL rewriting |
| src/backend/src/services/selfHealing.ts | Self-healing health monitoring |
| src/backend/src/utils/logger.ts | Winston logger |
| src/backend/src/utils/swagger.ts | Swagger/OpenAPI setup |

## Authentication

JWT-based auth. Flow:
1. Extract JWT from `Authorization: Bearer <token>` or cookie
2. Decode with jsonwebtoken (HS256, JWT_SECRET)
3. Attach user to `req.user`

Route-level: `requireAuth` (mandatory) or `optionalAuth` (parse but don't block).

## Health Check Response

```json
{
  "status": "healthy|degraded|unhealthy",
  "services": {
    "database": "connected|error",
    "cache": "connected|not connected",
    "ai_provider": "healthy|degraded (fallback active)|unhealthy",
    "external_apis": "3/3 configured",
    "agent_orchestrator": "2 registered, all healthy"
  }
}
```

## Common Issues

### CORS errors
Check `config.cors.origin` in config/index.ts. Origins are comma-separated.

### 401 on valid token
JWT_SECRET mismatch between services? Token expired? Check `optionalAuth` vs `requireAuth` on route.

### Rate limit 429
Check per-user rate limit config. Admin: 10k, auth: 500, guest: 50 per 15min.

### i18n URL issues
`i18nUrlMiddleware` strips locale prefixes like `/en/api/v1/...`. If routes 404, check middleware order.

### Health check shows degraded
Check individual services in response. `ai_provider: unhealthy` means all fallbacks failed.

### MCP router not loaded
`createMCPRouter()` is loaded synchronously via `require()`. If 503, check import errors in logs.
