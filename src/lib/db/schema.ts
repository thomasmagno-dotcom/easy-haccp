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
  // stepType mirrors the Codex/FSEP canonical category enum:
  // processing | storage | transport | inspection | other
  stepType: text("step_type"),
  isCcp: integer("is_ccp", { mode: "boolean" }).notNull().default(false),
  ccpNumber: text("ccp_number"), // e.g. "CCP-1"
  notes: text("notes"),
  // true when this step is referenced by more than one flow chart
  isSharedMaster: integer("is_shared_master", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Flow Charts (Multiple Flow Charts per HACCP Plan) ──────────────────────
//
// A single HACCP Plan can contain multiple independent flow charts:
// e.g. main process, by-product stream, incoming ingredient sub-flow, etc.
// Each FlowChart contains an ordered set of Steps via the FlowChartStep junction.

export const flowCharts = sqliteTable("flow_charts", {
  id: text("id").primaryKey(),
  haccpPlanId: text("haccp_plan_id")
    .notNull()
    .references(() => haccpPlans.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  // main_process | byproduct | incoming_ingredient | waste_stream | other
  flowChartType: text("flow_chart_type").notNull().default("main_process"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── StepConnection (Graph Edges) ───────────────────────────────────────────
//
// Directed edges in the process graph.  An Output of any Step in any FlowChart
// can feed as Input into any other Step in any FlowChart of the same plan.
// The app enforces a DAG (no circular references).

export const stepConnections = sqliteTable("step_connections", {
  id: text("id").primaryKey(),
  sourceStepId: text("source_step_id")
    .notNull()
    .references(() => processSteps.id, { onDelete: "cascade" }),
  sourceOutputId: text("source_output_id")
    .notNull()
    .references(() => stepOutputs.id, { onDelete: "cascade" }),
  targetStepId: text("target_step_id")
    .notNull()
    .references(() => processSteps.id, { onDelete: "cascade" }),
  sourceFlowChartId: text("source_flow_chart_id")
    .notNull()
    .references(() => flowCharts.id, { onDelete: "cascade" }),
  targetFlowChartId: text("target_flow_chart_id")
    .notNull()
    .references(() => flowCharts.id, { onDelete: "cascade" }),
  // direct   = output physically moves to the next step
  // reference = shared/linked step, operates independently
  connectionType: text("connection_type").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── FlowChart–Step Junction (Shared Steps) ─────────────────────────────────
//
// One row per (flowChart, step) pair.  When a step appears in only one flow
// chart this mirrors processSteps.planId / stepNumber.  When it appears in
// multiple flow charts each row carries its own sequence and optional local
// overrides for name / description (hazards & controls are NEVER overridden).

export const flowChartSteps = sqliteTable("flow_chart_steps", {
  id: text("id").primaryKey(),
  flowChartId: text("flow_chart_id")
    .notNull()
    .references(() => flowCharts.id, { onDelete: "cascade" }),
  stepId: text("step_id")
    .notNull()
    .references(() => processSteps.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  isShared: integer("is_shared", { mode: "boolean" }).notNull().default(false),
  // JSON: { name?: string, description?: string }
  // Only step-level display attributes. Hazards/controls are always master.
  localOverrides: text("local_overrides"),
  createdAt: text("created_at")
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
  severityWithControls: text("severity_with_controls"),
  likelihoodWithControls: text("likelihood_with_controls"),
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

// ─── Ingredients & Incoming Materials (Form 2) ──────────────────────────────

export const ingredients = sqliteTable("ingredients", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => haccpPlans.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category"), // raw-material | packaging | water | additive | processing-aid | chemical | other
  description: text("description"),
  supplier: text("supplier"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const ingredientHazards = sqliteTable("ingredient_hazards", {
  id: text("id").primaryKey(),
  ingredientId: text("ingredient_id")
    .notNull()
    .references(() => ingredients.id, { onDelete: "cascade" }),
  hazardId: text("hazard_id")
    .notNull()
    .references(() => hazards.id),
  isSignificant: integer("is_significant", { mode: "boolean" })
    .notNull()
    .default(false),
  justification: text("justification"),
  severityOverride: text("severity_override"),
  likelihoodOverride: text("likelihood_override"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Ingredient Control Measures ────────────────────────────────────────────

export const ingredientControlMeasures = sqliteTable("ingredient_control_measures", {
  id: text("id").primaryKey(),
  ingredientHazardId: text("ingredient_hazard_id")
    .notNull()
    .references(() => ingredientHazards.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  type: text("type"), // preventive | eliminative | reductive | prp | external
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Step Inputs ─────────────────────────────────────────────────────────────

export const stepInputs = sqliteTable("step_inputs", {
  id: text("id").primaryKey(),
  stepId: text("step_id")
    .notNull()
    .references(() => processSteps.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type"), // water | chemical | material | energy | other
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Input Subgraph Steps ─────────────────────────────────────────────────────
// Each stepInput can have its own mini process-flow (e.g. Receiving → Storage
// for a packaging-materials input before it enters the main flow).

export const inputSubgraphSteps = sqliteTable("input_subgraph_steps", {
  id: text("id").primaryKey(),
  inputId: text("input_id")
    .notNull()
    .references(() => stepInputs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  stepNumber: integer("step_number").notNull().default(1),
  category: text("category"), // receiving | storage | processing | inspection | other
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Input Subgraph Step Hazards ─────────────────────────────────────────────

export const inputSubgraphStepHazards = sqliteTable("input_subgraph_step_hazards", {
  id: text("id").primaryKey(),
  subgraphStepId: text("subgraph_step_id").notNull().references(() => inputSubgraphSteps.id, { onDelete: "cascade" }),
  hazardId: text("hazard_id").notNull().references(() => hazards.id),
  isSignificant: integer("is_significant", { mode: "boolean" }).notNull().default(false),
  justification: text("justification"),
  severityOverride: text("severity_override"),
  likelihoodOverride: text("likelihood_override"),
  severityWithControls: text("severity_with_controls"),
  likelihoodWithControls: text("likelihood_with_controls"),
  decisionTreeAnswers: text("decision_tree_answers"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const inputSubgraphStepControlMeasures = sqliteTable("input_subgraph_step_control_measures", {
  id: text("id").primaryKey(),
  subgraphHazardId: text("subgraph_hazard_id").notNull().references(() => inputSubgraphStepHazards.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  type: text("type"),
  prpMasterId: text("prp_master_id").references(() => prpMaster.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
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
  // Auto-generated structured change log (JSON array of strings)
  changeLog: text("change_log"),
  // Version lifecycle
  status: text("status").notNull().default("active"), // draft | active | superseded | archived
  effectiveDate: text("effective_date"),
  clonedFromVersionId: text("cloned_from_version_id"),
  isRestorable: integer("is_restorable", { mode: "boolean" }).notNull().default(true),
});

// ─── PRP Master Registry ─────────────────────────────────────────────────────

export const prpMaster = sqliteTable("prp_master", {
  id: text("id").primaryKey(),
  programName: text("program_name").notNull(),
  prpType: text("prp_type").notNull(), // A | B | C | D | E | F | G  (FSEP main category)
  fsepCode: text("fsep_code"),         // e.g. "A.1", "E.2", "G.1"  (FSEP element code)
  sfcrSection: text("sfcr_section"),   // e.g. "s.56, s.59"  (Safe Food for Canadians Regulations legal reference)
  description: text("description"),
  documentReference: text("document_reference"), // e.g. "SOP-012"
  documentUrl: text("document_url"),             // live link to actual document
  documentSource: text("document_source"),       // internal_upload | google_drive | sharepoint | other
  owner: text("owner"),                          // responsible party
  reviewFrequency: text("review_frequency"),
  lastReviewDate: text("last_review_date"),
  nextReviewDate: text("next_review_date"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Hazard ↔ PRP Junction (many-to-many) ───────────────────────────────────

export const hazardPrp = sqliteTable("hazard_prp", {
  id: text("id").primaryKey(),
  hazardId: text("hazard_id")
    .notNull()
    .references(() => hazards.id, { onDelete: "cascade" }),
  prpMasterId: text("prp_master_id")
    .notNull()
    .references(() => prpMaster.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Step Outputs ────────────────────────────────────────────────────────────

export const stepOutputs = sqliteTable("step_outputs", {
  id: text("id").primaryKey(),
  stepId: text("step_id")
    .notNull()
    .references(() => processSteps.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  outputType: text("output_type").notNull(), // primary_product | waste | rejected_product | water_discharge | other
  description: text("description"),
  isCcp: integer("is_ccp", { mode: "boolean" }).notNull().default(false),
  ccpNumber: text("ccp_number"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Step Output Sources (multiple steps → same output) ─────────────────────
//
// When multiple process steps produce the same physical output (e.g. multiple
// wash steps all reclaim the same water stream) this junction links each
// additional source step to the output.  The primary step is still tracked via
// stepOutputs.stepId; every other contributing step gets a row here.

export const stepOutputSources = sqliteTable("step_output_sources", {
  id: text("id").primaryKey(),
  outputId: text("output_id")
    .notNull()
    .references(() => stepOutputs.id, { onDelete: "cascade" }),
  stepId: text("step_id")
    .notNull()
    .references(() => processSteps.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Output-Hazard Junction ──────────────────────────────────────────────────

export const outputHazards = sqliteTable("output_hazards", {
  id: text("id").primaryKey(),
  outputId: text("output_id")
    .notNull()
    .references(() => stepOutputs.id, { onDelete: "cascade" }),
  hazardId: text("hazard_id")
    .notNull()
    .references(() => hazards.id),
  isSignificant: integer("is_significant", { mode: "boolean" })
    .notNull()
    .default(false),
  justification: text("justification"),
  severityOverride: text("severity_override"),
  likelihoodOverride: text("likelihood_override"),
  severityWithControls: text("severity_with_controls"),
  likelihoodWithControls: text("likelihood_with_controls"),
  decisionTreeAnswers: text("decision_tree_answers"), // JSON: { q1, q2, q3, q4, result }
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Output Control Measures ─────────────────────────────────────────────────

export const outputControlMeasures = sqliteTable("output_control_measures", {
  id: text("id").primaryKey(),
  outputHazardId: text("output_hazard_id")
    .notNull()
    .references(() => outputHazards.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  type: text("type"), // preventive | eliminative | reductive | prp | external
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Output CCPs ─────────────────────────────────────────────────────────────

export const outputCcps = sqliteTable("output_ccps", {
  id: text("id").primaryKey(),
  outputId: text("output_id")
    .notNull()
    .references(() => stepOutputs.id, { onDelete: "cascade" }),
  hazardDescription: text("hazard_description").notNull(),
  controlMeasureDescription: text("control_measure_description").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Output Critical Limits ──────────────────────────────────────────────────

export const outputCriticalLimits = sqliteTable("output_critical_limits", {
  id: text("id").primaryKey(),
  outputCcpId: text("output_ccp_id")
    .notNull()
    .references(() => outputCcps.id, { onDelete: "cascade" }),
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

// ─── Output Monitoring Procedures ────────────────────────────────────────────

export const outputMonitoringProcedures = sqliteTable("output_monitoring_procedures", {
  id: text("id").primaryKey(),
  outputCcpId: text("output_ccp_id")
    .notNull()
    .references(() => outputCcps.id, { onDelete: "cascade" }),
  what: text("what").notNull(),
  how: text("how").notNull(),
  frequency: text("frequency").notNull(),
  who: text("who").notNull(),
  recordForm: text("record_form"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Output Corrective Actions ────────────────────────────────────────────────

export const outputCorrectiveActions = sqliteTable("output_corrective_actions", {
  id: text("id").primaryKey(),
  outputCcpId: text("output_ccp_id")
    .notNull()
    .references(() => outputCcps.id, { onDelete: "cascade" }),
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

// ─── Output Verification Procedures ─────────────────────────────────────────

export const outputVerificationProcedures = sqliteTable("output_verification_procedures", {
  id: text("id").primaryKey(),
  outputCcpId: text("output_ccp_id")
    .notNull()
    .references(() => outputCcps.id, { onDelete: "cascade" }),
  activity: text("activity").notNull(),
  frequency: text("frequency").notNull(),
  responsiblePerson: text("responsible_person").notNull(),
  method: text("method"),
  recordReference: text("record_reference"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
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
