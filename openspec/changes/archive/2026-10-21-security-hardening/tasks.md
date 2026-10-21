## 1. Dependencies & Crypto Foundation

- [x] 1.1 Install `@fastify/helmet` and `@fastify/rate-limit` in `apps/backend/package.json`
- [x] 1.2 Implement authenticated AES-256-GCM encryption/decryption helper in `apps/backend/src/crypto/encryption.ts` with key derivation from master password
- [x] 1.3 Add unit tests for `encryption.ts` verifying ciphertext formatting, decryption, and tampering detection

## 2. Admin Authentication & Header Hardening

- [x] 2.1 Remove raw password token bypass in `verifyToken()` in `apps/backend/src/admin/auth.ts`
- [x] 2.2 Configure and register `@fastify/rate-limit` in `apps/backend/src/server.ts`, specifically limiting attempts on `POST /api/admin/login`
- [x] 2.3 Configure and register `@fastify/helmet` in `apps/backend/src/server.ts` with appropriate directives for the Admin SPA
- [x] 2.4 Update backend tests in `apps/backend/src/admin/admin-api.test.ts` to use valid HMAC tokens instead of raw password bearer tokens

## 3. At-Rest Encryption for Sensitive Settings

- [x] 3.1 Update `SettingsRepository` in `apps/backend/src/db/repositories/settings.ts` to transparently encrypt sensitive keys on write and decrypt on read
- [x] 3.2 Ensure backward compatibility in `SettingsRepository` for existing unencrypted plaintext settings
- [x] 3.3 Add unit and integration tests verifying settings encryption at rest in SQLite and safe export via `/api/admin/export/db`

## 4. SSRF Defense in Web Crawling

- [x] 4.1 Create URL and IP validation helper `validateSafeUrl(url)` blocking non-HTTP protocols, loopback, private CIDR blocks, and cloud metadata (169.254.169.254)
- [x] 4.2 Integrate `validateSafeUrl` into `apps/backend/src/tools/crawl4ai.ts` before dispatching scraping requests
- [x] 4.3 Add unit tests for SSRF prevention covering localhost, IPv4/IPv6 private ranges, and valid public URLs

## 5. Indirect Prompt Injection & Delimiter Defense

- [x] 5.1 Implement `formatUntrustedContentTag(source, content, url?)` in `apps/backend/src/llm/prompt-security.ts` to isolate external content inside `<untrusted_content>`
- [x] 5.2 Add sanitization for nested closing tags and instruction override signatures in external scraped/search content
- [x] 5.3 Update LLM client system prompt instructions in `apps/backend/src/llm/client.ts` to establish strict hierarchy regarding untrusted external content
- [x] 5.4 Add tests in `prompt-security.test.ts` and `client.test.ts` verifying indirect injection defense

## 6. Verification & Regression Testing

- [x] 6.1 Run full backend test suite (`pnpm test` in backend) and verify all existing and new test suites pass
- [x] 6.2 Test admin login flow, rate limit triggers (429), and Settings UI saving/testing in end-to-end integration tests
