CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`previous_value` text,
	`new_value` text,
	`changed_by` text,
	`changed_at` text DEFAULT (datetime('now')) NOT NULL,
	`session_id` text,
	FOREIGN KEY (`plan_id`) REFERENCES `haccp_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ccps` (
	`id` text PRIMARY KEY NOT NULL,
	`step_id` text NOT NULL,
	`hazard_description` text NOT NULL,
	`control_measure_description` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`step_id`) REFERENCES `process_steps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `control_measures` (
	`id` text PRIMARY KEY NOT NULL,
	`step_hazard_id` text NOT NULL,
	`description` text NOT NULL,
	`type` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`step_hazard_id`) REFERENCES `step_hazards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `corrective_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`ccp_id` text NOT NULL,
	`deviation` text NOT NULL,
	`immediate_action` text NOT NULL,
	`product_disposition` text NOT NULL,
	`root_cause_analysis` text,
	`preventive_action` text,
	`responsible_person` text NOT NULL,
	`record_form` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`ccp_id`) REFERENCES `ccps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `critical_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`ccp_id` text NOT NULL,
	`parameter` text NOT NULL,
	`minimum` text,
	`maximum` text,
	`target` text,
	`unit` text,
	`scientific_basis` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`ccp_id`) REFERENCES `ccps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `haccp_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`facility_name` text NOT NULL,
	`facility_address` text,
	`product_description` text,
	`team_members` text,
	`scope` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`current_version` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hazards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`severity` text,
	`likelihood` text,
	`source_category` text,
	`is_system_default` integer DEFAULT false NOT NULL,
	`applicable_step_categories` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingredient_control_measures` (
	`id` text PRIMARY KEY NOT NULL,
	`ingredient_hazard_id` text NOT NULL,
	`description` text NOT NULL,
	`type` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`ingredient_hazard_id`) REFERENCES `ingredient_hazards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ingredient_hazards` (
	`id` text PRIMARY KEY NOT NULL,
	`ingredient_id` text NOT NULL,
	`hazard_id` text NOT NULL,
	`is_significant` integer DEFAULT false NOT NULL,
	`justification` text,
	`severity_override` text,
	`likelihood_override` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hazard_id`) REFERENCES `hazards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`description` text,
	`supplier` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `haccp_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `input_subgraph_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`input_id` text NOT NULL,
	`name` text NOT NULL,
	`step_number` integer DEFAULT 1 NOT NULL,
	`category` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`input_id`) REFERENCES `step_inputs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `monitoring_procedures` (
	`id` text PRIMARY KEY NOT NULL,
	`ccp_id` text NOT NULL,
	`what` text NOT NULL,
	`how` text NOT NULL,
	`frequency` text NOT NULL,
	`who` text NOT NULL,
	`record_form` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`ccp_id`) REFERENCES `ccps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plan_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`snapshot` text NOT NULL,
	`published_at` text DEFAULT (datetime('now')) NOT NULL,
	`published_by` text,
	`change_description` text,
	`previous_version_id` text,
	`change_log` text,
	FOREIGN KEY (`plan_id`) REFERENCES `haccp_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `process_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`step_number` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`is_ccp` integer DEFAULT false NOT NULL,
	`ccp_number` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `haccp_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `step_hazards` (
	`id` text PRIMARY KEY NOT NULL,
	`step_id` text NOT NULL,
	`hazard_id` text NOT NULL,
	`is_significant` integer DEFAULT false NOT NULL,
	`justification` text,
	`severity_override` text,
	`likelihood_override` text,
	`decision_tree_answers` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`step_id`) REFERENCES `process_steps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hazard_id`) REFERENCES `hazards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `step_inputs` (
	`id` text PRIMARY KEY NOT NULL,
	`step_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`step_id`) REFERENCES `process_steps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `verification_procedures` (
	`id` text PRIMARY KEY NOT NULL,
	`ccp_id` text NOT NULL,
	`activity` text NOT NULL,
	`frequency` text NOT NULL,
	`responsible_person` text NOT NULL,
	`method` text,
	`record_reference` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`ccp_id`) REFERENCES `ccps`(`id`) ON UPDATE no action ON DELETE cascade
);
