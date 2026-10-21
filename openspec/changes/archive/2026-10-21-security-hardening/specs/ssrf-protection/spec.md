## ADDED Requirements

### Requirement: Outbound URL validation and protocol restriction
The system SHALL validate any target URL provided for web scraping or remote HTTP fetching before initiating network connections. The system SHALL only permit `http` and `https` schemes, and SHALL immediately reject non-HTTP protocols (such as `file:`, `ftp:`, `gopher:`, `data:`, or `javascript:`).

#### Scenario: User requests scraping an HTTP/HTTPS website
- **WHEN** user or bot requests scraping a public URL starting with `https://`
- **THEN** URL validation succeeds and the request proceeds

#### Scenario: Disallowed URL scheme
- **WHEN** a scrape request specifies a URL like `file:///etc/passwd` or `ftp://internal`
- **THEN** the scraper rejects the URL with a validation error indicating disallowed protocol

### Requirement: Private and internal IP address blocking (SSRF defense)
The system SHALL resolve the hostname of any outbound crawl target and reject URLs that resolve to loopback addresses, private network ranges, link-local addresses, or cloud provider metadata endpoints (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, `::1`, `fc00::/7`).

#### Scenario: Scrape request targets loopback or local server
- **WHEN** an input URL points to `http://localhost:3000` or `http://127.0.0.1:8080/api/admin`
- **THEN** the request is blocked and returns an error explaining that internal addresses cannot be crawled

#### Scenario: Scrape request targets cloud metadata endpoint
- **WHEN** an input URL points to `http://169.254.169.254/latest/meta-data`
- **THEN** the request is blocked as a prohibited metadata address
