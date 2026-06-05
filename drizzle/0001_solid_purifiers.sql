CREATE TABLE `flow_chart_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`flow_chart_id` text NOT NULL,
	`step_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`is_shared` integer DEFAULT false NOT NULL,
	`local_overrides` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`flow_chart_id`) REFERENCES `flow_charts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`step_id`) REFERENCES `process_steps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `flow_charts` (
	`id` text PRIMARY KEY NOT NULL,
	`haccp_plan_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`flow_chart_type` text DEFAULT 'main_process' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`haccp_plan_id`) REFERENCES `haccp_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `hazard_prp` (
	`id` text PRIMARY KEY NOT NULL,
	`hazard_id` text NOT NULL,
	`prp_master_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`hazard_id`) REFERENCES `hazards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prp_master_id`) REFERENCES `prp_master`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `input_subgraph_step_control_measures` (
	`id` text PRIMARY KEY NOT NULL,
	`subgraph_hazard_id` text NOT NULL,
	`description` text NOT NULL,
	`type` text,
	`prp_master_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`subgraph_hazard_id`) REFERENCES `input_subgraph_step_hazards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prp_master_id`) REFERENCES `prp_master`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `input_subgraph_step_hazards` (
	`id` text PRIMARY KEY NOT NULL,
	`subgraph_step_id` text NOT NULL,
	`hazard_id` text NOT NULL,
	`is_significant` integer DEFAULT false NOT NULL,
	`justification` text,
	`severity_override` text,
	`likelihood_override` text,
	`decision_tree_answers` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`subgraph_step_id`) REFERENCES `input_subgraph_steps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hazard_id`) REFERENCES `hazards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `output_ccps` (
	`id` text PRIMARY KEY NOT NULL,
	`output_id` text NOT NULL,
	`hazard_description` text NOT NULL,
	`control_measure_description` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`output_id`) REFERENCES `step_outputs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `output_control_measures` (
	`id` text PRIMARY KEY NOT NULL,
	`output_hazard_id` text NOT NULL,
	`description` text NOT NULL,
	`type` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`output_hazard_id`) REFERENCES `output_hazards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `output_corrective_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`output_ccp_id` text NOT NULL,
	`deviation` text NOT NULL,
	`immediate_action` text NOT NULL,
	`product_disposition` text NOT NULL,
	`root_cause_analysis` text,
	`preventive_action` text,
	`responsible_person` text NOT NULL,
	`record_form` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`output_ccp_id`) REFERENCES `output_ccps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `output_critical_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`output_ccp_id` text NOT NULL,
	`parameter` text NOT NULL,
	`minimum` text,
	`maximum` text,
	`target` text,
	`unit` text,
	`scientific_basis` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`output_ccp_id`) REFERENCES `output_ccps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `output_hazards` (
	`id` text PRIMARY KEY NOT NULL,
	`output_id` text NOT NULL,
	`hazard_id` text NOT NULL,
	`is_significant` integer DEFAULT false NOT NULL,
	`justification` text,
	`severity_override` text,
	`likelihood_override` text,
	`decision_tree_answers` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`output_id`) REFERENCES `step_outputs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hazard_id`) REFERENCES `hazards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `output_monitoring_procedures` (
	`id` text PRIMARY KEY NOT NULL,
	`output_ccp_id` text NOT NULL,
	`what` text NOT NULL,
	`how` text NOT NULL,
	`frequency` text NOT NULL,
	`who` text NOT NULL,
	`record_form` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`output_ccp_id`) REFERENCES `output_ccps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `output_verification_procedures` (
	`id` text PRIMARY KEY NOT NULL,
	`output_ccp_id` text NOT NULL,
	`activity` text NOT NULL,
	`frequency` text NOT NULL,
	`responsible_person` text NOT NULL,
	`method` text,
	`record_reference` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`output_ccp_id`) REFERENCES `output_ccps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `prp_master` (
	`id` text PRIMARY KEY NOT NULL,
	`program_name` text NOT NULL,
	`prp_type` text NOT NULL,
	`fsep_code` text,
	`description` text,
	`document_reference` text,
	`document_url` text,
	`document_source` text,
	`owner` text,
	`review_frequency` text,
	`last_review_date` text,
	`next_review_date` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `step_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`source_step_id` text NOT NULL,
	`source_output_id` text NOT NULL,
	`target_step_id` text NOT NULL,
	`source_flow_chart_id` text NOT NULL,
	`target_flow_chart_id` text NOT NULL,
	`connection_type` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`source_step_id`) REFERENCES `process_steps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_output_id`) REFERENCES `step_outputs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_step_id`) REFERENCES `process_steps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_flow_chart_id`) REFERENCES `flow_charts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_flow_chart_id`) REFERENCES `flow_charts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `step_output_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`output_id` text NOT NULL,
	`step_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`output_id`) REFERENCES `step_outputs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`step_id`) REFERENCES `process_steps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `step_outputs` (
	`id` text PRIMARY KEY NOT NULL,
	`step_id` text NOT NULL,
	`name` text NOT NULL,
	`output_type` text NOT NULL,
	`description` text,
	`is_ccp` integer DEFAULT false NOT NULL,
	`ccp_number` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`step_id`) REFERENCES `process_steps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `plan_versions` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `plan_versions` ADD `effective_date` text;--> statement-breakpoint
ALTER TABLE `plan_versions` ADD `cloned_from_version_id` text;--> statement-breakpoint
ALTER TABLE `plan_versions` ADD `is_restorable` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `process_steps` ADD `step_type` text;--> statement-breakpoint
ALTER TABLE `process_steps` ADD `is_shared_master` integer DEFAULT false NOT NULL;