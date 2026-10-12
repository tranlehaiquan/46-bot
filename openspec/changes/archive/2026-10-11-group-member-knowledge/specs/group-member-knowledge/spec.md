# group-member-knowledge Specification

## Purpose

Maintain persistent records and profiles of individual group members in family chats, distinguish between participants, and provide tools for listing and updating member information (aliases, relationships, and notes).

## ADDED Requirements

### Requirement: Group member tracking and auto-discovery
The system SHALL maintain a `group_members` SQLite table with columns: `id`, `chat_id`, `sender_id`, `sender_name`, `alias`, `relationship`, `notes`, `created_at`, and `last_seen_at`. When an incoming message arrives in a group chat, the system SHALL record a new member record if the `(chat_id, sender_id)` combination does not exist, or update `sender_name` and `last_seen_at` if the member already exists.

#### Scenario: First message from a group member
- **WHEN** a group member sends a message in a group chat for the first time
- **THEN** the system creates a new entry in `group_members` capturing `chat_id`, `sender_id`, and `sender_name`

#### Scenario: Subsequent message updates activity
- **WHEN** a previously registered member sends another message in the group
- **THEN** the system updates `last_seen_at` and refreshes `sender_name` if changed, preserving existing `alias`, `relationship`, and `notes`

### Requirement: Listing group members tool
The system SHALL provide an LLM tool `list_group_members` that retrieves recorded members for the active `chat_id`. The tool output SHALL include each member's identifier, display name, configured alias or family title, relationship, and notes.

#### Scenario: User asks to list group members
- **WHEN** a user asks "Nhóm mình gồm những ai?" or "Ai đang ở trong nhóm này?"
- **THEN** the LLM invokes `list_group_members` and provides a summary of all registered members and their roles

#### Scenario: No members found
- **WHEN** `list_group_members` is invoked for a chat with no recorded members
- **THEN** the tool returns an empty list and a friendly notification message

### Requirement: Updating member profile attributes
The system SHALL provide an LLM tool `update_group_member` that allows updating a member's `alias`, `relationship`, and `notes`. The tool SHALL accept either an exact `sender_id` or a target search name/alias to identify the member. The system SHALL reject any notes containing sensitive credentials or prompt injection attacks.

#### Scenario: Speaker registers their own family alias
- **WHEN** a user says "Nhớ mình là Bố nhé"
- **THEN** the LLM executes `update_group_member` with the current speaker's `sender_id` and sets `alias` to "Bố"

#### Scenario: Updating notes for another family member
- **WHEN** a user says "Ghi chú thêm là mẹ thích uống trà thảo mộc"
- **THEN** the LLM invokes `update_group_member` identifying the member with alias "Mẹ" and updates their `notes`

#### Scenario: Rejection of sensitive data in member notes
- **WHEN** a user requests storing passwords or banking details into member notes
- **THEN** the tool rejects the modification with a privacy protection message
