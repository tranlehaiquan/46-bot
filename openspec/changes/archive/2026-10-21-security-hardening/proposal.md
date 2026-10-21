## Why

As 46-bot integrates richer external tools (web crawling with Crawl4AI, web search via Tavily, dynamic API keys saved via Web Admin), two critical security surfaces require hardening:
1. **Admin Surface**: The `/api/admin/login` endpoint is vulnerable to brute-force attacks due to the absence of rate limiting; `verifyToken()` allows using the raw `ADMIN_PASSWORD` as a bearer token, defeating HMAC expiration; API keys and secrets stored in SQLite `system_settings` are stored in plaintext; and Fastify lacks defense-in-depth security headers (e.g. Helmet).
2. **Tool & Prompt Surface**: Content ingested from the web via Crawl4AI or web search is currently passed to the LLM without indirect prompt injection checks or clear delimiter isolation, allowing untrusted web pages to hijack bot instructions. Additionally, arbitrary URLs requested for scraping could target local network addresses or cloud metadata endpoints (SSRF).

Hardening these surfaces ensures robust defense against credential compromise, denial of service, prompt hijacking, and internal network reconnaissance.

## What Changes

- **Admin Authentication Hardening**:
  - Add rate limiting to `POST /api/admin/login` (e.g., maximum 5 failed attempts per IP per 15 minutes with exponential or timed backoff).
  - Remove the password-as-bearer-token fallback in `verifyToken()` so only signed, valid HMAC tokens with unexpired timestamps are accepted. **BREAKING** for any script or test passing raw password in `Authorization: Bearer <password>`.
  - Add `@fastify/helmet` to configure modern HTTP security headers (CSP, HSTS, X-Content-Type-Options, Frameguard) on all API and static `/admin` routes.
- **Secrets at Rest Encryption**:
  - Encrypt sensitive keys (`gemini_api_key`, `deepseek_api_key`, `tavily_api_key`, `crawl4ai_api_token`, `zipline_token`) stored in `system_settings` with AES-256-GCM using a key derived from `ADMIN_PASSWORD` (or dedicated secret).
  - Automatically encrypt on write and decrypt on read, with seamless fallback for unencrypted legacy keys during transition.
- **Indirect Prompt Injection Defense**:
  - Frame external tool outputs (web scrape results, web search summaries) inside explicit `<untrusted_content source="...">` delimiter tags before feeding to the LLM.
  - Sanitize and neutralize known prompt override signatures in crawled content, preventing external web pages from impersonating system or developer instructions.
- **SSRF Prevention in Web Crawling**:
  - Add strict URL validation in `scrapeUrlWithCrawl4Ai` / `createCrawl4AiTool` rejecting non-HTTP/HTTPS protocols and private/loopback/cloud-metadata IP ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, `::1`).

## Capabilities

### New Capabilities
- `ssrf-protection`: URL validation and IP blacklist checks to prevent Server-Side Request Forgery when scraping external links or making outbound HTTP tool requests.
- `secrets-encryption`: Symmetric authenticated encryption (AES-256-GCM) for sensitive credential values at rest in SQLite `system_settings`.

### Modified Capabilities
- `web-admin`: Add login rate limiting, enforce HMAC token verification exclusively (reject raw password bearer token), and apply HTTP security headers via `@fastify/helmet`.
- `prompt-security`: Extend prompt injection defense to cover indirect injection from external web and tool contents using structured isolation delimiters and instruction neutralization.

## Impact

- **Backend Dependencies**: Add `@fastify/helmet` and `@fastify/rate-limit` to `apps/backend/package.json`.
- **Backend Code**:
  - `apps/backend/src/admin/auth.ts`: Remove password bypass; integrate rate limiter.
  - `apps/backend/src/server.ts`: Register helmet and rate limit plugins.
  - `apps/backend/src/db/repositories/settings.ts` / `settings-helper.ts`: Encrypt and decrypt secrets at rest.
  - `apps/backend/src/tools/crawl4ai.ts`: Add URL and IP SSRF validation before scraping.
  - `apps/backend/src/llm/prompt-security.ts` & `client.ts`: Add untrusted content framing and sanitization.
- **Tests**: Update test cases in `admin-api.test.ts` that were relying on `headers: { authorization: 'Bearer ' + adminPassword }` to acquire a valid token via login or use `createToken`.
