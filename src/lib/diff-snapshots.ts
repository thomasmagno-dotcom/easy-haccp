/**
 * Compares two HACCP plan snapshots and returns a human-readable list of changes.
 * Used to auto-generate the change log when publishing a new version.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Snapshot = Record<string, any>;

export interface ChangeEntry {
  section: "plan" | "steps" | "ingredients" | "team";
  text: string;
}

export function diffSnapshots(previous: Snapshot | null, current: Snapshot): ChangeEntry[] {
  const changes: ChangeEntry[] = [];

  // ── First ever version ────────────────────────────────────────────────────
  if (!previous) {
    changes.push({ section: "plan", text: "Initial version — full plan created" });
    return changes;
  }

  const prevPlan = previous.plan || {};
  const currPlan = current.plan || {};

  // ── Plan metadata ─────────────────────────────────────────────────────────
  if (prevPlan.name !== currPlan.name) {
    changes.push({ section: "plan", text: `Plan name changed: "${prevPlan.name}" → "${currPlan.name}"` });
  }
  if (prevPlan.facilityName !== currPlan.facilityName) {
    changes.push({ section: "plan", text: `Facility name changed: "${prevPlan.facilityName}" → "${currPlan.facilityName}"` });
  }
  if ((prevPlan.facilityAddress || "") !== (currPlan.facilityAddress || "")) {
    changes.push({ section: "plan", text: "Facility address updated" });
  }
  if ((prevPlan.scope || "") !== (currPlan.scope || "")) {
    changes.push({ section: "plan", text: "Plan scope updated" });
  }

  // Product description (JSON object)
  let prevDesc: Record<string, string> = {};
  let currDesc: Record<string, string> = {};
  try { prevDesc = JSON.parse(prevPlan.productDescription || "{}"); } catch { /* ignore */ }
  try { currDesc = JSON.parse(currPlan.productDescription || "{}"); } catch { /* ignore */ }

  const descFieldLabels: Record<string, string> = {
    name: "Product name",
    characteristics: "Characteristics",
    intendedUse: "Intended use",
    targetConsumer: "Target consumer",
    shelfLife: "Shelf life",
    packaging: "Packaging",
    storageDistribution: "Storage & distribution",
    labellingInstructions: "Labelling instructions",
    regulatoryClassification: "Regulatory classification",
  };
  const changedDescFields: string[] = [];
  for (const [key, label] of Object.entries(descFieldLabels)) {
    if ((prevDesc[key] || "") !== (currDesc[key] || "")) changedDescFields.push(label);
  }
  if (changedDescFields.length > 0) {
    changes.push({ section: "plan", text: `Product description updated: ${changedDescFields.join(", ")}` });
  }

  // Team members
  let prevTeam: Array<Record<string, string>> = [];
  let currTeam: Array<Record<string, string>> = [];
  try { prevTeam = JSON.parse(prevPlan.teamMembers || "[]"); } catch { /* ignore */ }
  try { currTeam = JSON.parse(currPlan.teamMembers || "[]"); } catch { /* ignore */ }

  const prevTeamNames = new Set(prevTeam.map((m) => m.name));
  const currTeamNames = new Set(currTeam.map((m) => m.name));
  for (const m of currTeam) {
    if (!prevTeamNames.has(m.name)) {
      changes.push({ section: "team", text: `Team member added: ${m.name}${m.role ? ` (${m.role})` : ""}` });
    }
  }
  for (const m of prevTeam) {
    if (!currTeamNames.has(m.name)) {
      changes.push({ section: "team", text: `Team member removed: ${m.name}` });
    }
  }
  // Check for role/title changes on existing members
  for (const curr of currTeam) {
    const prev = prevTeam.find((m) => m.name === curr.name);
    if (!prev) continue;
    if ((prev.role || "") !== (curr.role || "") || (prev.title || "") !== (curr.title || "")) {
      changes.push({ section: "team", text: `Team member updated: ${curr.name}` });
    }
  }

  // ── Process steps ─────────────────────────────────────────────────────────
  const prevSteps: Snapshot[] = previous.processSteps || [];
  const currSteps: Snapshot[] = current.processSteps || [];

  const prevStepById = new Map(prevSteps.map((s) => [s.id, s]));
  const currStepById = new Map(currSteps.map((s) => [s.id, s]));

  for (const step of currSteps) {
    if (!prevStepById.has(step.id)) {
      changes.push({ section: "steps", text: `Process step added: Step ${step.stepNumber} — "${step.name}"` });
    }
  }
  for (const step of prevSteps) {
    if (!currStepById.has(step.id)) {
      changes.push({ section: "steps", text: `Process step removed: "${step.name}"` });
    }
  }

  for (const curr of currSteps) {
    const prev = prevStepById.get(curr.id);
    if (!prev) continue;

    const label = `Step ${curr.stepNumber} "${curr.name}"`;

    if (prev.stepNumber !== curr.stepNumber) {
      changes.push({ section: "steps", text: `"${curr.name}" reordered to position ${curr.stepNumber}` });
    }
    if (prev.name !== curr.name) {
      changes.push({ section: "steps", text: `Step ${curr.stepNumber}: renamed from "${prev.name}" to "${curr.name}"` });
    }
    if ((prev.description || "") !== (curr.description || "")) {
      changes.push({ section: "steps", text: `${label}: description updated` });
    }
    if (!prev.isCcp && curr.isCcp) {
      changes.push({ section: "steps", text: `${label}: designated as ${curr.ccpNumber}` });
    } else if (prev.isCcp && !curr.isCcp) {
      changes.push({ section: "steps", text: `${label}: CCP designation (${prev.ccpNumber}) removed` });
    } else if (prev.isCcp && curr.isCcp && prev.ccpNumber !== curr.ccpNumber) {
      changes.push({ section: "steps", text: `${label}: CCP number changed from ${prev.ccpNumber} to ${curr.ccpNumber}` });
    }

    // Hazard assignments
    const prevHazards: Snapshot[] = prev.hazards || [];
    const currHazards: Snapshot[] = curr.hazards || [];
    const prevHazardById = new Map(prevHazards.map((h) => [h.hazardId, h]));
    const currHazardById = new Map(currHazards.map((h) => [h.hazardId, h]));

    for (const h of currHazards) {
      if (!prevHazardById.has(h.hazardId)) {
        changes.push({ section: "steps", text: `${label}: hazard added — ${h.hazard?.name} (${capitalize(h.hazard?.type)})` });
      }
    }
    for (const h of prevHazards) {
      if (!currHazardById.has(h.hazardId)) {
        changes.push({ section: "steps", text: `${label}: hazard removed — ${h.hazard?.name}` });
      }
    }
    for (const h of currHazards) {
      const prevH = prevHazardById.get(h.hazardId);
      if (!prevH) continue;
      if (prevH.isSignificant !== h.isSignificant) {
        changes.push({ section: "steps", text: `${label}: "${h.hazard?.name}" significance changed to ${h.isSignificant ? "Significant" : "Not Significant"}` });
      }
      if ((prevH.severityOverride || prevH.hazard?.severity || "") !== (h.severityOverride || h.hazard?.severity || "")) {
        changes.push({ section: "steps", text: `${label}: "${h.hazard?.name}" severity updated` });
      }
      if ((prevH.likelihoodOverride || prevH.hazard?.likelihood || "") !== (h.likelihoodOverride || h.hazard?.likelihood || "")) {
        changes.push({ section: "steps", text: `${label}: "${h.hazard?.name}" likelihood updated` });
      }
      // Control measures
      const prevCms: Snapshot[] = prevH.controlMeasures || [];
      const currCms: Snapshot[] = h.controlMeasures || [];
      const diff = currCms.length - prevCms.length;
      if (diff > 0) {
        changes.push({ section: "steps", text: `${label}: ${diff} control measure${diff > 1 ? "s" : ""} added for "${h.hazard?.name}"` });
      } else if (diff < 0) {
        changes.push({ section: "steps", text: `${label}: ${Math.abs(diff)} control measure${Math.abs(diff) > 1 ? "s" : ""} removed from "${h.hazard?.name}"` });
      } else {
        // Same count — check if content changed
        const prevTexts = prevCms.map((c) => c.description).sort().join("|");
        const currTexts = currCms.map((c) => c.description).sort().join("|");
        if (prevTexts !== currTexts) {
          changes.push({ section: "steps", text: `${label}: control measures updated for "${h.hazard?.name}"` });
        }
      }
    }

    // Step inputs
    const prevInputs: Snapshot[] = prev.inputs || [];
    const currInputs: Snapshot[] = curr.inputs || [];
    const prevInputById = new Map(prevInputs.map((inp) => [inp.id, inp]));
    const currInputById = new Map(currInputs.map((inp) => [inp.id, inp]));
    for (const inp of currInputs) {
      if (!prevInputById.has(inp.id)) {
        changes.push({ section: "steps", text: `${label}: input added — "${inp.name}"${inp.type ? ` (${inp.type})` : ""}` });
      }
    }
    for (const inp of prevInputs) {
      if (!currInputById.has(inp.id)) {
        changes.push({ section: "steps", text: `${label}: input removed — "${inp.name}"` });
      }
    }
    for (const inp of currInputs) {
      const prevInp = prevInputById.get(inp.id);
      if (!prevInp) continue;
      if (prevInp.name !== inp.name) {
        changes.push({ section: "steps", text: `${label}: input renamed from "${prevInp.name}" to "${inp.name}"` });
      }
      if ((prevInp.type || "") !== (inp.type || "")) {
        changes.push({ section: "steps", text: `${label}: input "${inp.name}" type changed to ${inp.type || "other"}` });
      }
    }

    // CCP details
    if (curr.isCcp) {
      const prevCcp = prev.ccp;
      const currCcp = curr.ccp;
      if (!prevCcp && currCcp) {
        changes.push({ section: "steps", text: `${label}: CCP details added` });
      } else if (prevCcp && currCcp) {
        if ((prevCcp.hazardDescription || "") !== (currCcp.hazardDescription || "")) {
          changes.push({ section: "steps", text: `${label}: CCP hazard description updated` });
        }
        if ((prevCcp.controlMeasureDescription || "") !== (currCcp.controlMeasureDescription || "")) {
          changes.push({ section: "steps", text: `${label}: CCP control measure description updated` });
        }
        const limDiff = (currCcp.criticalLimits || []).length - (prevCcp.criticalLimits || []).length;
        if (limDiff > 0) changes.push({ section: "steps", text: `${label}: ${limDiff} critical limit${limDiff > 1 ? "s" : ""} added` });
        if (limDiff < 0) changes.push({ section: "steps", text: `${label}: ${Math.abs(limDiff)} critical limit${Math.abs(limDiff) > 1 ? "s" : ""} removed` });

        const monDiff = (currCcp.monitoringProcedures || []).length - (prevCcp.monitoringProcedures || []).length;
        if (monDiff !== 0) changes.push({ section: "steps", text: `${label}: monitoring procedures updated (${(prevCcp.monitoringProcedures || []).length} → ${(currCcp.monitoringProcedures || []).length})` });

        const corrDiff = (currCcp.correctiveActions || []).length - (prevCcp.correctiveActions || []).length;
        if (corrDiff !== 0) changes.push({ section: "steps", text: `${label}: corrective actions updated (${(prevCcp.correctiveActions || []).length} → ${(currCcp.correctiveActions || []).length})` });

        const verDiff = (currCcp.verificationProcedures || []).length - (prevCcp.verificationProcedures || []).length;
        if (verDiff !== 0) changes.push({ section: "steps", text: `${label}: verification procedures updated (${(prevCcp.verificationProcedures || []).length} → ${(currCcp.verificationProcedures || []).length})` });
      }
    }
  }

  // ── Ingredients ───────────────────────────────────────────────────────────
  const prevIngs: Snapshot[] = previous.ingredients || [];
  const currIngs: Snapshot[] = current.ingredients || [];
  const prevIngById = new Map(prevIngs.map((i) => [i.id, i]));
  const currIngById = new Map(currIngs.map((i) => [i.id, i]));

  for (const ing of currIngs) {
    if (!prevIngById.has(ing.id)) {
      changes.push({ section: "ingredients", text: `Ingredient added: "${ing.name}"${ing.category ? ` (${ing.category.replace(/-/g, " ")})` : ""}` });
    }
  }
  for (const ing of prevIngs) {
    if (!currIngById.has(ing.id)) {
      changes.push({ section: "ingredients", text: `Ingredient removed: "${ing.name}"` });
    }
  }
  for (const curr of currIngs) {
    const prev = prevIngById.get(curr.id);
    if (!prev) continue;

    const ingLabel = `Ingredient "${curr.name}"`;

    if (prev.name !== curr.name) {
      changes.push({ section: "ingredients", text: `${ingLabel}: renamed from "${prev.name}"` });
    }
    if ((prev.supplier || "") !== (curr.supplier || "")) {
      changes.push({ section: "ingredients", text: `${ingLabel}: supplier updated` });
    }
    if ((prev.category || "") !== (curr.category || "")) {
      changes.push({ section: "ingredients", text: `${ingLabel}: category changed to ${curr.category}` });
    }

    const prevHazards: Snapshot[] = prev.hazards || [];
    const currHazards: Snapshot[] = curr.hazards || [];
    const prevHazardById = new Map(prevHazards.map((h) => [h.hazardId, h]));
    const currHazardById = new Map(currHazards.map((h) => [h.hazardId, h]));

    for (const h of currHazards) {
      if (!prevHazardById.has(h.hazardId)) {
        changes.push({ section: "ingredients", text: `${ingLabel}: hazard added — ${h.hazard?.name} (${capitalize(h.hazard?.type)})` });
      }
    }
    for (const h of prevHazards) {
      if (!currHazardById.has(h.hazardId)) {
        changes.push({ section: "ingredients", text: `${ingLabel}: hazard removed — ${h.hazard?.name}` });
      }
    }
    for (const h of currHazards) {
      const prevH = prevHazardById.get(h.hazardId);
      if (!prevH) continue;
      if (prevH.isSignificant !== h.isSignificant) {
        changes.push({ section: "ingredients", text: `${ingLabel}: "${h.hazard?.name}" significance changed to ${h.isSignificant ? "Significant" : "Not Significant"}` });
      }
      const prevCms: Snapshot[] = prevH.controlMeasures || [];
      const currCms: Snapshot[] = h.controlMeasures || [];
      const diff = currCms.length - prevCms.length;
      if (diff > 0) {
        changes.push({ section: "ingredients", text: `${ingLabel}: ${diff} control measure${diff > 1 ? "s" : ""} added for "${h.hazard?.name}"` });
      } else if (diff < 0) {
        changes.push({ section: "ingredients", text: `${ingLabel}: ${Math.abs(diff)} control measure${Math.abs(diff) > 1 ? "s" : ""} removed from "${h.hazard?.name}"` });
      } else {
        const prevTexts = prevCms.map((c) => c.description).sort().join("|");
        const currTexts = currCms.map((c) => c.description).sort().join("|");
        if (prevTexts !== currTexts) {
          changes.push({ section: "ingredients", text: `${ingLabel}: control measures updated for "${h.hazard?.name}"` });
        }
      }
    }
  }

  return changes;
}

function capitalize(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
