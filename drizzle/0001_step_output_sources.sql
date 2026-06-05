CREATE TABLE IF NOT EXISTS `step_output_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`output_id` text NOT NULL REFERENCES `step_outputs`(`id`) ON DELETE CASCADE,
	`step_id` text NOT NULL REFERENCES `process_steps`(`id`) ON DELETE CASCADE,
	`created_at` text NOT NULL DEFAULT (datetime('now'))
);
