import { db } from "./db";
import { auditLog } from "./db/schema";
import { generateId } from "./utils";

export type AuditAction = "create" | "update" | "delete";
export type EntityType =
  | "plan"
  | "process_step"
  | "hazard"
  | "step_hazard"
  | "control_measure"
  | "ccp"
  | "critical_limit"
  | "monitoring_procedure"
  | "corrective_action"
  | "verification_procedure"
  | "ingredient";

interface AuditOptions {
  planId: string;
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  previousValue?: unknown;
  newValue?: unknown;
  changedBy?: string;
  sessionId?: string;
}

export async function logAudit(options: AuditOptions): Promise<void> {
  await db.insert(auditLog)
    .values({
      id: generateId(),
      planId: options.planId,
      entityType: options.entityType,
      entityId: options.entityId,
      action: options.action,
      previousValue: options.previousValue
        ? JSON.stringify(options.previousValue)
        : null,
      newValue: options.newValue ? JSON.stringify(options.newValue) : null,
      changedBy: options.changedBy ?? null,
      sessionId: options.sessionId ?? null,
    })
    .run();
}
