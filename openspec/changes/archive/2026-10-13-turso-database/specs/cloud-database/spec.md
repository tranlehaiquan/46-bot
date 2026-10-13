# Spec Delta

## Purpose

Provide an asynchronous database client supporting both local SQLite files and remote Turso / libSQL cloud databases with authentication tokens.

## ADDED Requirements

### Requirement: Flexible database client initialization
The system SHALL initialize a libSQL client using `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` when configured. If `TURSO_DATABASE_URL` is omitted, the system SHALL automatically default to a local file URL using `file:${DB_PATH}` so that offline tests and local development run without external services.

#### Scenario: Connecting to remote Turso cloud
- **WHEN** `TURSO_DATABASE_URL` is set to a `libsql://` or `https://` endpoint and `TURSO_AUTH_TOKEN` is provided
- **THEN** the system initializes the libSQL client with the remote endpoint and credentials

#### Scenario: Defaulting to local file database
- **WHEN** `TURSO_DATABASE_URL` is not provided in the environment
- **THEN** the system creates a libSQL client targeting the local database file path specified by `DB_PATH`

### Requirement: Asynchronous repository operations
The database repositories (`channels`, `events`, `lists`, `lookups`, `memory`, `messages`, and `seen`) SHALL execute all reads and writes asynchronously via the libSQL client and return typed Promises.

#### Scenario: Asynchronous channel retrieval
- **WHEN** `channelRepo.getChannel(chatId)` is called
- **THEN** it executes asynchronously via libSQL and resolves with the channel record or undefined

#### Scenario: Asynchronous event creation
- **WHEN** `eventsRepo.createEvent(input)` is called
- **THEN** it inserts the record asynchronously and resolves with the created event record and autoincrement ID

### Requirement: Schema migrations via libSQL
The migration system SHALL execute SQL table migrations and index creations using the libSQL client, preserving table structures, constraints, and WAL compatibility.

#### Scenario: Running migrations on empty database
- **WHEN** the application starts with an empty database
- **THEN** the migration runner creates all tables and indexes asynchronously before the bot accepts incoming messages
