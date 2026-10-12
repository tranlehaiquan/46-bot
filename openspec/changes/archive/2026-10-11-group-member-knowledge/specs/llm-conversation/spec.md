## ADDED Requirements

### Requirement: Group member context injection in system prompt
When generating a reply for a group chat, the system SHALL inject a structured list of known group members into the system prompt under a `<group_members>` section, detailing each member's display name, alias/role, and notes. The prompt SHALL also clearly identify the active speaker's name and alias to enable accurate distinction between participants.

#### Scenario: Group message with registered members
- **WHEN** preparing the LLM prompt for a group message where members are registered
- **THEN** the system prompt includes the `<group_members>` XML block listing known members and explicitly indicates the current speaker

#### Scenario: Private chat or empty group members
- **WHEN** preparing the LLM prompt for a private 1-on-1 chat or when no additional members are recorded
- **THEN** the `<group_members>` block is omitted from the system prompt
