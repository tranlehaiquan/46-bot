import type { SqliteDatabase } from "./connection.js";

export async function migrate(db: SqliteDatabase): Promise<void> {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS seen_messages (
      message_id TEXT PRIMARY KEY,
      ts INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      ts INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chat_ts ON messages(chat_id, ts DESC);

    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_lists_chat_norm_name ON lists(chat_id, normalized_name);

    CREATE TABLE IF NOT EXISTS list_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      added_by TEXT NOT NULL,
      ts INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_list_items_list ON list_items(list_id, done, ts ASC);

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      calendar TEXT NOT NULL,
      day INTEGER NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER,
      is_leap_month INTEGER NOT NULL DEFAULT 0,
      recurrence TEXT NOT NULL DEFAULT 'none',
      remind_days_before INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_by TEXT NOT NULL,
      ts INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_chat ON events(chat_id);

    CREATE TABLE IF NOT EXISTS reminders_sent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      occurrence_date TEXT NOT NULL,
      sent_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_sent_event_date ON reminders_sent(event_id, occurrence_date);

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      fact TEXT NOT NULL,
      created_by TEXT NOT NULL,
      ts INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memories_chat_subject ON memories(chat_id, subject);

    CREATE TABLE IF NOT EXISTS memory_book (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      title TEXT NOT NULL,
      story TEXT NOT NULL,
      people TEXT NOT NULL,
      happened_on TEXT,
      created_by TEXT NOT NULL,
      ts INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memory_book_chat ON memory_book(chat_id, ts DESC);

    CREATE TABLE IF NOT EXISTS channels (
      chat_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      chat_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_channels_status ON channels(status);

    CREATE TABLE IF NOT EXISTS scheduled_lookups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      instruction TEXT NOT NULL,
      recurrence TEXT NOT NULL,
      hour INTEGER NOT NULL,
      minute INTEGER NOT NULL,
      weekday INTEGER,
      day_of_month INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scheduled_lookups_chat ON scheduled_lookups(chat_id);

    CREATE TABLE IF NOT EXISTS scheduled_lookup_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lookup_id INTEGER NOT NULL REFERENCES scheduled_lookups(id) ON DELETE CASCADE,
      fire_date TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 1,
      last_error TEXT,
      sent_at INTEGER,
      started_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_lookup_runs_lookup_fire ON scheduled_lookup_runs(lookup_id, fire_date);
  `);
}
