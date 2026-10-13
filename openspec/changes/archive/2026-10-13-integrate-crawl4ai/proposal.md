## Why

The bot currently supports searching the web via Tavily, but lacks the ability to deeply read, scrape, and extract structured content from specific URLs shared by users or discovered during search queries. Integrating Crawl4AI (specifically the Crawl4AI Cloud API at `https://api.crawl4ai.com`) provides LLM-ready markdown extraction and web crawling capabilities, configured and managed securely with an API token stored in system settings and admin UI.

## What Changes

- Introduce a Crawl4AI integration service and LLM tool (`scrape_url` / `crawl_url`) allowing the bot to retrieve clean markdown content from arbitrary web pages.
- Add Crawl4AI API token configuration support in backend `AppConfig`, `SettingsRepository`, and settings helper (`crawl4ai_api_token`).
- Expose the Crawl4AI token in the Admin Web UI Settings page (`apps/admin`) with masking, source indicators (`db` / `env` / `none`), and test connection capability.
- Register the web scraping tool into conversation delivery (`src/delivery.ts`) and scheduler workers alongside `web_search`.

## Capabilities

### New Capabilities
- `web-crawling`: Web scraping, content extraction, and page parsing using the Crawl4AI Cloud API with token-based authentication.

### Modified Capabilities
- `web-admin`: Extend system settings management to store, update, mask, and test the Crawl4AI API token (`crawl4ai_api_token`).
- `llm-conversation`: Add web scraping tool availability to conversational LLM execution when a Crawl4AI token is configured.

## Impact

- **Backend**:
  - `apps/backend/src/config.ts`: add `crawl4aiApiToken?: string` to `AppConfig`.
  - `apps/backend/src/admin/settings-helper.ts`: add `crawl4aiApiToken` to `EffectiveSettings` and masked settings.
  - `apps/backend/src/admin/routes.ts`: handle setting update and token testing endpoint.
  - `apps/backend/src/tools/crawl4ai.ts`: new tool wrapper calling `https://api.crawl4ai.com`.
  - `apps/backend/src/delivery.ts` & schedulers: provide Crawl4AI tool when token is available.
- **Frontend Admin**:
  - `apps/admin/src/api.ts` & `SettingsPage.tsx`: new UI fields to configure and test Crawl4AI token.
- **Dependencies**: Uses native fetch for HTTP calls to `https://api.crawl4ai.com` or lightweight client; no heavy browser binary required.
