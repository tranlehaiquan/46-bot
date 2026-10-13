CREATE TABLE `channels` (
	`chat_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`chat_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`last_active_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_channels_status` ON `channels` (`status`);--> statement-breakpoint
CREATE TABLE `seen_messages` (
	`message_id` text PRIMARY KEY NOT NULL,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`sender_name` text NOT NULL,
	`alias` text,
	`relationship` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_group_members_chat_sender` ON `group_members` (`chat_id`,`sender_id`);--> statement-breakpoint
CREATE INDEX `idx_group_members_chat` ON `group_members` (`chat_id`);--> statement-breakpoint
CREATE TABLE `memories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` text NOT NULL,
	`subject` text NOT NULL,
	`fact` text NOT NULL,
	`created_by` text NOT NULL,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_memories_chat_subject` ON `memories` (`chat_id`,`subject`);--> statement-breakpoint
CREATE TABLE `memory_book` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` text NOT NULL,
	`title` text NOT NULL,
	`story` text NOT NULL,
	`people` text NOT NULL,
	`happened_on` text,
	`created_by` text NOT NULL,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_memory_book_chat` ON `memory_book` (`chat_id`,"ts" desc);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`sender_name` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_messages_chat_ts` ON `messages` (`chat_id`,"ts" desc);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`calendar` text NOT NULL,
	`day` integer NOT NULL,
	`month` integer NOT NULL,
	`year` integer,
	`is_leap_month` integer DEFAULT 0 NOT NULL,
	`recurrence` text DEFAULT 'none' NOT NULL,
	`remind_days_before` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_events_chat` ON `events` (`chat_id`);--> statement-breakpoint
CREATE TABLE `list_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`list_id` integer NOT NULL,
	`text` text NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`added_by` text NOT NULL,
	`ts` integer NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_list_items_list` ON `list_items` (`list_id`,`done`,"ts" asc);--> statement-breakpoint
CREATE TABLE `lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_lists_chat_norm_name` ON `lists` (`chat_id`,`normalized_name`);--> statement-breakpoint
CREATE TABLE `reminders_sent` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`occurrence_date` text NOT NULL,
	`sent_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reminders_sent_event_date` ON `reminders_sent` (`event_id`,`occurrence_date`);--> statement-breakpoint
CREATE TABLE `scheduled_lookup_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lookup_id` integer NOT NULL,
	`fire_date` text NOT NULL,
	`status` text NOT NULL,
	`attempt_count` integer DEFAULT 1 NOT NULL,
	`last_error` text,
	`sent_at` integer,
	`started_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`lookup_id`) REFERENCES `scheduled_lookups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_scheduled_lookup_runs_lookup_fire` ON `scheduled_lookup_runs` (`lookup_id`,`fire_date`);--> statement-breakpoint
CREATE TABLE `scheduled_lookups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` text NOT NULL,
	`instruction` text NOT NULL,
	`recurrence` text NOT NULL,
	`hour` integer NOT NULL,
	`minute` integer NOT NULL,
	`weekday` integer,
	`day_of_month` integer,
	`active` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_scheduled_lookups_chat` ON `scheduled_lookups` (`chat_id`);--> statement-breakpoint
CREATE TABLE `word_chain_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`chat_id` text NOT NULL,
	`word` text NOT NULL,
	`player_id` text NOT NULL,
	`player_name` text NOT NULL,
	`turn_index` integer NOT NULL,
	`points` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `word_chain_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_wc_history_session` ON `word_chain_history` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_wc_history_chat` ON `word_chain_history` (`chat_id`);--> statement-breakpoint
CREATE TABLE `word_chain_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` text NOT NULL,
	`status` text NOT NULL,
	`current_word` text NOT NULL,
	`starter_word` text NOT NULL,
	`total_words` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_wc_sessions_chat_status` ON `word_chain_sessions` (`chat_id`,`status`);--> statement-breakpoint
CREATE TABLE `word_chain_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` text NOT NULL,
	`player_id` text NOT NULL,
	`player_name` text NOT NULL,
	`total_score` integer DEFAULT 0 NOT NULL,
	`words_chained` integer DEFAULT 0 NOT NULL,
	`highest_streak` integer DEFAULT 0 NOT NULL,
	`games_played` integer DEFAULT 0 NOT NULL,
	`games_won` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_wc_stats_chat_player` ON `word_chain_stats` (`chat_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `idx_wc_stats_chat_score` ON `word_chain_stats` (`chat_id`,"total_score" desc);--> statement-breakpoint
CREATE INDEX `idx_wc_stats_global_score` ON `word_chain_stats` ("total_score" desc);