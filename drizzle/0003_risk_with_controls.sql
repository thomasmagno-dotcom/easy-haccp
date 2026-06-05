ALTER TABLE `step_hazards` ADD `severity_with_controls` text;
--> statement-breakpoint
ALTER TABLE `step_hazards` ADD `likelihood_with_controls` text;
--> statement-breakpoint
ALTER TABLE `output_hazards` ADD `severity_with_controls` text;
--> statement-breakpoint
ALTER TABLE `output_hazards` ADD `likelihood_with_controls` text;
--> statement-breakpoint
ALTER TABLE `input_subgraph_step_hazards` ADD `severity_with_controls` text;
--> statement-breakpoint
ALTER TABLE `input_subgraph_step_hazards` ADD `likelihood_with_controls` text;
