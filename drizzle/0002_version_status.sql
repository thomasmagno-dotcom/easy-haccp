-- Add version lifecycle fields to plan_versions
ALTER TABLE `plan_versions` ADD COLUMN `status` text NOT NULL DEFAULT 'active';
ALTER TABLE `plan_versions` ADD COLUMN `effective_date` text;
ALTER TABLE `plan_versions` ADD COLUMN `cloned_from_version_id` text;
ALTER TABLE `plan_versions` ADD COLUMN `is_restorable` integer NOT NULL DEFAULT 1;
