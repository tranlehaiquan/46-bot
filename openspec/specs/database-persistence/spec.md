# database-persistence Specification

## Purpose

Provide type-safe schema definitions, Drizzle ORM client initialization on top of libSQL/SQLite, automated schema migrations, and typed repository data access implementations.

## Requirements

### Requirement: Type-safe schema definition
The backend database layer SHALL declare all database tables and relationships using Drizzle ORM schema builders (`drizzle-orm/sqlite-core`).

#### Scenario: Schema types are inferred at compile time
- **WHEN** a repository queries or inserts data into a table
- **THEN** TypeScript compiler validates query parameters, inputs, and selected fields against the inferred table schema types without manual `any` casting

### Requirement: Database connection and Drizzle client initialization
The backend database connection initialization SHALL expose a configured Drizzle ORM client instance connected to the underlying LibSQL/SQLite client.

#### Scenario: Connecting to local or in-memory database
- **WHEN** `openDatabase` is called with a local file path or `:memory:`
- **THEN** it returns a Drizzle database instance wrapping `@libsql/client` ready for execution

#### Scenario: Connecting to remote Turso database
- **WHEN** `openDatabase` is called with a remote `libsql://` or `https://` URL and auth token
- **THEN** it returns a Drizzle database instance connected to the remote LibSQL endpoint

### Requirement: Automated schema migration execution
The database layer SHALL provide automated migration capabilities using Drizzle migrations upon application startup.

#### Scenario: Fresh database initialization
- **WHEN** the backend starts up against an empty or in-memory database
- **THEN** all table definitions and indexes are created automatically matching the schema

#### Scenario: Existing database compatibility
- **WHEN** the backend starts up against an existing database containing legacy data
- **THEN** existing rows are preserved and queries execute against existing tables without data loss

### Requirement: Drizzle-backed repository implementations
All database repositories SHALL implement their data access operations using Drizzle query builders while preserving their existing public TypeScript interfaces.

#### Scenario: Repository operations execute via Drizzle
- **WHEN** repository methods are invoked (such as insert, select, update, delete)
- **THEN** they execute type-safe Drizzle queries and return typed entity objects matching the repository interface contract
