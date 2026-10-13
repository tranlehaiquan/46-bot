# web-crawling Specification

## Purpose

Provide web scraping, content extraction, and webpage parsing using the Crawl4AI Cloud API with token-based authentication.

## Requirements

### Requirement: Crawl4AI Cloud API client
The system SHALL provide an HTTP client to communicate with Crawl4AI Cloud API at `https://api.crawl4ai.com` using Bearer token authentication via the `Authorization: Bearer <token>` header.

#### Scenario: Successful URL scrape request
- **WHEN** client invokes the Crawl4AI scrape method with a valid URL and active API token
- **THEN** client posts JSON `{"url": "<url>"}` to `https://api.crawl4ai.com/scrape` with `Authorization: Bearer <token>` and returns the scraped markdown content and page metadata

#### Scenario: Authentication failure or missing token
- **WHEN** client invokes Crawl4AI scrape without a configured API token
- **THEN** client immediately returns an error indicating the Crawl4AI API token is not configured without initiating remote network requests

#### Scenario: Remote API error handling
- **WHEN** the Crawl4AI Cloud API returns an HTTP error response (e.g. 401, 429, 500)
- **THEN** client captures the response status and error message and throws a structured error indicating crawl failure

### Requirement: Web scraping tool for conversational assistant
The system SHALL provide an AI tool (`scrape_url`) that accepts a URL and optional CSS selector or extraction instructions, invoking Crawl4AI Cloud API and returning sanitized markdown for LLM reasoning.

#### Scenario: Assistant requests webpage content
- **WHEN** the conversational model invokes `scrape_url` with a target URL
- **THEN** the tool fetches the webpage content via Crawl4AI and returns formatted markdown text truncated to a safe maximum size (e.g., 20,000 characters)

#### Scenario: Tool execution when token is unconfigured
- **WHEN** `scrape_url` is invoked but no Crawl4AI token is present in settings or environment
- **THEN** the tool returns a user-friendly explanation that web page crawling is not configured
