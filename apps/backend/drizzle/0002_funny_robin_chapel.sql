ALTER TABLE `memories` ADD `category` text DEFAULT 'core' NOT NULL;--> statement-breakpoint
ALTER TABLE `memories` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_memories_chat_status` ON `memories` (`chat_id`,`status`);