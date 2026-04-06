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

export interface DecisionTreeAnswers {
  q1: boolean | null; // Does a control measure exist?
  q2: boolean | null; // Is step designed to eliminate/reduce?
  q3: boolean | null; // Could contamination increase?
  q4: boolean | null; // Will subsequent step control?
  result: "ccp" | "not_ccp" | "prp" | null;
}
