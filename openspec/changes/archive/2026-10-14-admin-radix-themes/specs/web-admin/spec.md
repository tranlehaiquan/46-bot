## ADDED Requirements

### Requirement: Unified Radix Themes UI system
The admin web application SHALL use `@radix-ui/themes` as its primary component design system. All interactive controls, dialogs, dropdowns, badges, buttons, inputs, tabs, and form elements in the admin SPA SHALL be rendered using components imported directly from `@radix-ui/themes`, eliminating handcrafted UI wrapper components in `src/components/ui/`.

#### Scenario: Admin UI renders with dark theme configuration
- **WHEN** the user opens the admin dashboard in the browser
- **THEN** the entire application is enclosed in `<Theme appearance="dark" accentColor="indigo" grayColor="slate">` with consistent dark styling and accessible keyboard navigation

#### Scenario: Form select inputs use Radix Themes Select
- **WHEN** the user selects channel status, calendar filter, or model options in the admin UI
- **THEN** the component SHALL be rendered using Radix Themes `<Select.Root>` instead of native unstyled HTML select elements

### Requirement: Non-blocking feedback notifications
The admin web application SHALL use a non-blocking toast notification library (`sonner`) to display feedback for all user actions and mutations. The application SHALL NOT invoke blocking browser `alert()` popups for mutation errors or successes.

#### Scenario: Channel status update failure
- **WHEN** an admin updates a channel's status and the API request fails
- **THEN** the UI SHALL display a toast notification with the error description using `toast.error()` without interrupting or freezing the browser UI thread

#### Scenario: Successful setting or event update
- **WHEN** an admin saves settings or updates a scheduled reminder event
- **THEN** the UI SHALL display a confirmation toast notification using `toast.success()`

### Requirement: Resilient API error handling
The admin API client (`api.ts`) SHALL safely inspect server responses before attempting JSON parsing. When a non-JSON response is received (e.g. 502/504 Bad Gateway, HTML error pages, or empty bodies), the client SHALL construct a meaningful human-readable Error rather than throwing an unhandled JSON parse SyntaxError.

#### Scenario: Gateway or server error response
- **WHEN** an API call returns a 502 Bad Gateway with an HTML error page
- **THEN** the `request()` helper catches the failure and throws a clear Error message indicating server unavailability
