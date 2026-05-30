// Shared types used across components

export interface Hazard {
  id: string;
  name: string;
  type: string;
  description: string | null;
  severity: string | null;
  likelihood: string | null;
  sourceCategory: string | null;
  isSystemDefault: boolean;
  applicableStepCategories: string | null;
  createdAt: string;
}

export interface StepHazardAssignment {
  id: string;
  stepId: string;
  hazardId: string;
  isSignificant: boolean;
  justification: string | null;
  severityOverride: string | null;
  likelihoodOverride: string | null;
  decisionTreeAnswers: string | null;
  createdAt: string;
  hazard: Hazard;
  controlMeasures: ControlMeasure[];
}

export interface ControlMeasure {
  id: string;
  stepHazardId: string;
  description: string;
  type: string | null;
  createdAt: string;
}

export interface ProcessStep {
  id: string;
  planId: string;
  stepNumber: number;
  name: string;
  description: string | null;
  category: string | null;
  isCcp: boolean;
  ccpNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CriticalLimit {
  id: string;
  ccpId: string;
  parameter: string;
  minimum: string | null;
  maximum: string | null;
  target: string | null;
  unit: string | null;
  scientificBasis: string | null;
}

export interface MonitoringProcedure {
  id: string;
  ccpId: string;
  what: string;
  how: string;
  frequency: string;
  who: string;
  recordForm: string | null;
}

export interface CorrectiveAction {
  id: string;
  ccpId: string;
  deviation: string;
  immediateAction: string;
  productDisposition: string;
  rootCauseAnalysis: string | null;
  preventiveAction: string | null;
  responsiblePerson: string;
  recordForm: string | null;
}

export interface VerificationProcedure {
  id: string;
  ccpId: string;
  activity: string;
  frequency: string;
  responsiblePerson: string;
  method: string | null;
  recordReference: string | null;
}

export interface CcpData {
  id: string;
  stepId: string;
  hazardDescription: string;
  controlMeasureDescription: string;
  criticalLimits: CriticalLimit[];
  monitoringProcedures: MonitoringProcedure[];
  correctiveActions: CorrectiveAction[];
  verificationProcedures: VerificationProcedure[];
}

export interface IngredientControlMeasure {
  id: string;
  ingredientHazardId: string;
  description: string;
  type: string | null;
  createdAt: string;
}

export interface IngredientHazardAssignment {
  id: string;
  ingredientId: string;
  hazardId: string;
  hazard: Hazard;
  isSignificant: boolean;
  justification: string | null;
  severityOverride: string | null;
  likelihoodOverride: string | null;
  createdAt: string;
  controlMeasures: IngredientControlMeasure[];
}

export interface Ingredient {
  id: string;
  planId: string;
  name: string;
  category: string | null;
  description: string | null;
  supplier: string | null;
  createdAt: string;
  hazards: IngredientHazardAssignment[];
}

/**
 * FSEP main category letters (A–G).
 * Based on CFIA Food Safety Enhancement Program (FSEP) prerequisite program structure.
 */
export type PrpType =
  | "A"   // Premises
  | "B"   // Food Conveyances, Purchasing, Receiving and Storage
  | "C"   // Conveyances and Equipment in the Establishment
  | "D"   // Personnel
  | "E"   // Sanitation and Pest Control
  | "F"   // Recall System
  | "G";  // Operational Prerequisite Programs

export type DocumentSource =
  | "internal_upload"
  | "google_drive"
  | "sharepoint"
  | "other";

export interface PrpMaster {
  id: string;
  programName: string;
  prpType: PrpType;              // FSEP main category (A–G)
  fsepCode: string | null;       // FSEP element code, e.g. "A.1", "E.2.1"
  description: string | null;
  documentReference: string | null;
  documentUrl: string | null;
  documentSource: DocumentSource | null;
  owner: string | null;
  reviewFrequency: string | null;
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HazardPrp {
  id: string;
  hazardId: string;
  prpMasterId: string;
  createdAt: string;
  prp?: PrpMaster;
}

export type OutputType =
  | "primary_product"
  | "waste"
  | "rejected_product"
  | "water_discharge"
  | "other";

export interface StepOutput {
  id: string;
  stepId: string;
  name: string;
  outputType: OutputType;
  description: string | null;
  isCcp: boolean;
  ccpNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutputHazardAssignment {
  id: string;
  outputId: string;
  hazardId: string;
  isSignificant: boolean;
  justification: string | null;
  severityOverride: string | null;
  likelihoodOverride: string | null;
  decisionTreeAnswers: string | null;
  createdAt: string;
  hazard: Hazard;
  controlMeasures: OutputControlMeasure[];
}

export interface OutputControlMeasure {
  id: string;
  outputHazardId: string;
  description: string;
  type: string | null;
  createdAt: string;
}

export interface OutputCcpData {
  id: string;
  outputId: string;
  hazardDescription: string;
  controlMeasureDescription: string;
  criticalLimits: OutputCriticalLimit[];
  monitoringProcedures: OutputMonitoringProcedure[];
  correctiveActions: OutputCorrectiveAction[];
  verificationProcedures: OutputVerificationProcedure[];
}

export interface OutputCriticalLimit {
  id: string;
  outputCcpId: string;
  parameter: string;
  minimum: string | null;
  maximum: string | null;
  target: string | null;
  unit: string | null;
  scientificBasis: string | null;
}

export interface OutputMonitoringProcedure {
  id: string;
  outputCcpId: string;
  what: string;
  how: string;
  frequency: string;
  who: string;
  recordForm: string | null;
}

export interface OutputCorrectiveAction {
  id: string;
  outputCcpId: string;
  deviation: string;
  immediateAction: string;
  productDisposition: string;
  rootCauseAnalysis: string | null;
  preventiveAction: string | null;
  responsiblePerson: string;
  recordForm: string | null;
}

export interface OutputVerificationProcedure {
  id: string;
  outputCcpId: string;
  activity: string;
  frequency: string;
  responsiblePerson: string;
  method: string | null;
  recordReference: string | null;
}

export interface DecisionTreeAnswers {
  q1: boolean | null; // Does a control measure exist?
  q2: boolean | null; // Is step designed to eliminate/reduce?
  q3: boolean | null; // Could contamination increase?
  q4: boolean | null; // Will subsequent step control?
  result: "ccp" | "not_ccp" | "prp" | "modify" | null;
}
