import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── HACCP Plans ────────────────────────────────────────────────────────────

export const haccpPlans = sqliteTable("haccp_plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  facilityName: text("facility_name").notNull(),
  facilityAddress: text("facility_address"),
  // JSON: { name, characteristics, intendedUse, targetConsumer, shelfLife, packaging, storageDistribution, labellingInstructions, regulatoryClassification }
  productDescription: text("product_description"),
  // JSON array: [{ name, title, role, qualifications }]
  teamMembers: text("team_members"),
  scope: text("scope"),
  status: text("status").notNull().default("draft"), // draft | published | archived
  currentVersion: integer("current_version").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Process Steps ──────────────────────────────────────────────────────────

export const processSteps = sqliteTable("process_steps", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => haccpPlans.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"), // receiving | storage | processing | packaging | shipping
  isCcp: integer("is_ccp", { mode: "boolean" }).notNull().default(false),
  ccpNumber: text("ccp_number"), // e.g. "CCP-1"
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Hazards Reference Database ─────────────────────────────────────────────

export const hazards = sqliteTable("hazards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // biological | chemical | physical | allergen
  description: text("description"),
  severity: text("severity"), // low | medium | high
  likelihood: text("likelihood"), // low | medium | high
  sourceCategory: text("source_category"), // soil | water | equipment | personnel | supplier | environment
  isSystemDefault: integer("is_system_default", { mode: "boolean" })
    .notNull()
    .default(false),
  // JSON array of step categories this hazard commonly applies to
  applicableStepCategories: text("applicable_step_categories"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Step-Hazard Junction ───────────────────────────────────────────────────

export const stepHazards = sqliteTable("step_hazards", {
  id: text("id").primaryKey(),
  stepId: text("step_id")
    .notNull()
    .references(() => processSteps.id, { onDelete: "cascade" }),
  hazardId: text("hazard_id")
    .notNull()
    .references(() => hazards.id),
  isSignificant: integer("is_significant", { mode: "boolean" })
    .notNull()
    .default(false),
  justification: text("justification"),
  severityOverride: text("severity_override"),
  likelihoodOverride: text("likelihood_override"),
  // Decision tree answers (JSON): { q1, q2, q3, q4, result }
  decisionTreeAnswers: text("decision_tree_answers"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Control Measures ───────────────────────────────────────────────────────

export const controlMeasures = sqliteTable("control_measures", {
  id: text("id").primaryKey(),
  stepHazardId: text("step_hazard_id")
    .notNull()
    .references(() => stepHazards.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  type: text("type"), // preventive | eliminative | reductive | prp | external
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── CCPs (Critical Control Points) ────────────────────────────────────────

export const ccps = sqliteTable("ccps", {
  id: text("id").primaryKey(),
  stepId: text("step_id")
    .notNull()
    .references(() => processSteps.id, { onDelete: "cascade" }),
  hazardDescription: text("hazard_description").notNull(),
  controlMeasureDescription: text("control_measure_description").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Critical Limits ────────────────────────────────────────────────────────

export const criticalLimits = sqliteTable("critical_limits", {
  id: text("id").primaryKey(),
  ccpId: text("ccp_id")
    .notNull()
    .references(() => ccps.id, { onDelete: "cascade" }),
  parameter: text("parameter").notNull(),
  minimum: text("minimum"),
  maximum: text("maximum"),
  target: text("target"),
  unit: text("unit"),
  scientificBasis: text("scientific_basis"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Monitoring Procedures ──────────────────────────────────────────────────

export const monitoringProcedures = sqliteTable("monitoring_procedures", {
  id: text("id").primaryKey(),
  ccpId: text("ccp_id")
    .notNull()
    .references(() => ccps.id, { onDelete: "cascade" }),
  what: text("what").notNull(),
  how: text("how").notNull(),
  frequency: text("frequency").notNull(),
  who: text("who").notNull(),
  recordForm: text("record_form"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Corrective Actions ─────────────────────────────────────────────────────

export const correctiveActions = sqliteTable("corrective_actions", {
  id: text("id").primaryKey(),
  ccpId: text("ccp_id")
    .notNull()
    .references(() => ccps.id, { onDelete: "cascade" }),
  deviation: text("deviation").notNull(),
  immediateAction: text("immediate_action").notNull(),
  productDisposition: text("product_disposition").notNull(),
  rootCauseAnalysis: text("root_cause_analysis"),
  preventiveAction: text("preventive_action"),
  responsiblePerson: text("responsible_person").notNull(),
  recordForm: text("record_form"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Verification Procedures ────────────────────────────────────────────────

export const verificationProcedures = sqliteTable("verification_procedures", {
  id: text("id").primaryKey(),
  ccpId: text("ccp_id")
    .notNull()
    .references(() => ccps.id, { onDelete: "cascade" }),
  activity: text("activity").notNull(),
  frequency: text("frequency").notNull(),
  responsiblePerson: text("responsible_person").notNull(),
  method: text("method"),
  recordReference: text("record_reference"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Plan Versions (Immutable Snapshots) ────────────────────────────────────

export const planVersions = sqliteTable("plan_versions", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => haccpPlans.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  snapshot: text("snapshot").notNull(), // Full JSON snapshot
  publishedAt: text("published_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  publishedBy: text("published_by"),
  changeDescription: text("change_description"),
  previousVersionId: text("previous_version_id"),
});

// ─── Audit Log ──────────────────────────────────────────────────────────────

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => haccpPlans.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(), // process_step | hazard | step_hazard | ccp | critical_limit | monitoring_procedure | corrective_action | verification_procedure | plan
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(), // create | update | delete
  previousValue: text("previous_value"), // JSON
  newValue: text("new_value"), // JSON
  changedBy: text("changed_by"),
  changedAt: text("changed_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  sessionId: text("session_id"),
});
