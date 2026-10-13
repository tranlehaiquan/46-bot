## ADDED Requirements

### Requirement: Dynamic web scraping tool availability
The conversational reply pipeline SHALL dynamically include the Crawl4AI `scrape_url` tool in the LLM tool suite whenever a Crawl4AI API token is configured in effective settings or environment.

#### Scenario: User provides URL and asks questions about page content
- **WHEN** user message contains a web URL and asks for summaries or questions about the webpage
- **THEN** the model invokes `scrape_url` with the target URL, inspects returned page content, and incorporates the information into its reply

#### Scenario: No Crawl4AI token configured
- **WHEN** neither database nor environment contains a Crawl4AI API token
- **THEN** the `scrape_url` tool is omitted from the tool definitions or gracefully informs the model that web crawling is unavailable
