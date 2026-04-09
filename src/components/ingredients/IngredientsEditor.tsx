"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  Ingredient,
  IngredientHazardAssignment,
  IngredientControlMeasure,
  Hazard,
} from "@/lib/types";
import {
  SEVERITY_LEVELS,
  LIKELIHOOD_LEVELS,
  computeRiskScore,
  RISK_COLORS,
  migrateOldLevel,
} from "@/lib/risk-matrix";

const INGREDIENT_CATEGORIES = [
  { value: "raw-material", label: "Raw Material" },
  { value: "packaging", label: "Packaging" },
  { value: "water", label: "Water" },
  { value: "additive", label: "Additive" },
  { value: "processing-aid", label: "Processing Aid" },
  { value: "chemical", label: "Chemical" },
  { value: "other", label: "Other" },
];

const CM_TYPE_LABELS: Record<string, string> = {
  preventive: "Preventive",
  eliminative: "Eliminative",
  reductive: "Reductive",
  prp: "PRP",
  external: "External (Form 9)",
};

const TYPE_LABELS: Record<string, string> = {
  biological: "B",
  chemical: "C",
  physical: "P",
  allergen: "A",
};

const TYPE_COLORS: Record<string, string> = {
  biological: "bg-red-100 text-red-700",
  chemical: "bg-orange-100 text-orange-700",
  physical: "bg-blue-100 text-blue-700",
  allergen: "bg-purple-100 text-purple-700",
};

interface Props {
  planId: string;
  initialIngredients: Ingredient[];
  allHazards: Hazard[];
}

export function IngredientsEditor({ planId, initialIngredients, allHazards: initialAllHazards }: Props) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [allHazards, setAllHazards] = useState<Hazard[]>(initialAllHazards);
  const [expandedIngredientId, setExpandedIngredientId] = useState<string | null>(null);
  const [expandedHazardId, setExpandedHazardId] = useState<string | null>(null);
  const [addingIngredient, setAddingIngredient] = useState(false);
  const [newIngredient, setNewIngredient] = useState<{ name: string; category: string; description: string; supplier: string }>({ name: "", category: "raw-material", description: "", supplier: "" });
  const [saving, setSaving] = useState(false);
  const [hazardPickerFor, setHazardPickerFor] = useState<string | null>(null);
  const [editingJustification, setEditingJustification] = useState<string | null>(null);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  // Control measures inline add form state: key = hazard assignment id
  const [newCmFor, setNewCmFor] = useState<{ ingId: string; assignmentId: string; description: string; type: string } | null>(null);
  // Custom hazard creation
  const [creatingHazard, setCreatingHazard] = useState(false);
  const [newHazard, setNewHazard] = useState({ name: "", type: "biological", description: "", severity: "", likelihood: "" });
  const [savingHazard, setSavingHazard] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getIngredient(id: string) {
    return ingredients.find((i) => i.id === id)!;
  }

  function updateIngredientHazards(ingId: string, hazardAssignments: IngredientHazardAssignment[]) {
    setIngredients((prev) => prev.map((i) => i.id === ingId ? { ...i, hazards: hazardAssignments } : i));
  }

  async function pushHazardUpdates(ingId: string, hazardAssignments: IngredientHazardAssignment[]) {
    await fetch(`/api/plans/${planId}/ingredients`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: ingId,
        hazardUpdates: hazardAssignments.map((h) => ({
          hazardId: h.hazardId,
          isSignificant: h.isSignificant,
          justification: h.justification,
          severityOverride: h.severityOverride,
          likelihoodOverride: h.likelihoodOverride,
          controlMeasures: h.controlMeasures.map((cm) => ({ description: cm.description, type: cm.type })),
        })),
      }),
    });
  }

  // ── Ingredient CRUD ────────────────────────────────────────────────────────

  async function createIngredient() {
    if (!newIngredient.name.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/plans/${planId}/ingredients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newIngredient),
    });
    if (res.ok) {
      const data = await res.json();
      const created: Ingredient = {
        id: data.id,
        planId,
        name: newIngredient.name.trim(),
        category: newIngredient.category || null,
        description: newIngredient.description || null,
        supplier: newIngredient.supplier || null,
        createdAt: new Date().toISOString(),
        hazards: [],
      };
      setIngredients((prev) => [...prev, created]);
      setExpandedIngredientId(created.id);
    }
    setNewIngredient({ name: "", category: "raw-material", description: "", supplier: "" });
    setAddingIngredient(false);
    setSaving(false);
  }

  async function deleteIngredient(id: string) {
    if (!confirm("Delete this ingredient and all its hazard assignments?")) return;
    const res = await fetch(`/api/plans/${planId}/ingredients?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setIngredients((prev) => prev.filter((i) => i.id !== id));
      if (expandedIngredientId === id) setExpandedIngredientId(null);
    }
  }

  async function saveIngredientEdit() {
    if (!editingIngredient) return;
    setSaving(true);
    const { id, hazards: _h, ...updates } = editingIngredient;
    await fetch(`/api/plans/${planId}/ingredients`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    setIngredients((prev) => prev.map((i) => i.id === id ? { ...i, ...updates } : i));
    setEditingIngredient(null);
    setSaving(false);
  }

  // ── Hazard assignment ──────────────────────────────────────────────────────

  async function assignHazard(ingId: string, hazard: Hazard) {
    const ing = getIngredient(ingId);
    const risk = computeRiskScore(migrateOldLevel(hazard.severity), migrateOldLevel(hazard.likelihood));
    const newAssignment: IngredientHazardAssignment = {
      id: `temp-${Date.now()}`,
      ingredientId: ingId,
      hazardId: hazard.id,
      hazard,
      isSignificant: risk.isSignificant,
      justification: null,
      severityOverride: migrateOldLevel(hazard.severity),
      likelihoodOverride: migrateOldLevel(hazard.likelihood),
      createdAt: new Date().toISOString(),
      controlMeasures: [],
    };
    const updated = [...ing.hazards, newAssignment];
    updateIngredientHazards(ingId, updated);
    await pushHazardUpdates(ingId, updated);
    setHazardPickerFor(null);
  }

  async function removeHazard(ingId: string, assignmentId: string) {
    const ing = getIngredient(ingId);
    const updated = ing.hazards.filter((h) => h.id !== assignmentId);
    updateIngredientHazards(ingId, updated);
    await pushHazardUpdates(ingId, updated);
  }

  async function updateHazardField(
    ingId: string,
    assignmentId: string,
    field: "severityOverride" | "likelihoodOverride" | "isSignificant" | "justification",
    value: string | boolean,
  ) {
    const ing = getIngredient(ingId);
    const updated = ing.hazards.map((h) => {
      if (h.id !== assignmentId) return h;
      const patch = { ...h, [field]: value };
      if (field === "severityOverride" || field === "likelihoodOverride") {
        const sev = field === "severityOverride" ? (value as string) : h.severityOverride;
        const lik = field === "likelihoodOverride" ? (value as string) : h.likelihoodOverride;
        patch.isSignificant = computeRiskScore(sev, lik).isSignificant;
      }
      return patch;
    });
    updateIngredientHazards(ingId, updated);
    await pushHazardUpdates(ingId, updated);
    if (field === "justification") setEditingJustification(null);
  }

  // ── Control measures ───────────────────────────────────────────────────────

  async function addControlMeasure(ingId: string, assignmentId: string, description: string, type: string) {
    if (!description.trim()) return;
    const ing = getIngredient(ingId);
    const newCm: IngredientControlMeasure = {
      id: `temp-${Date.now()}`,
      ingredientHazardId: assignmentId,
      description: description.trim(),
      type,
      createdAt: new Date().toISOString(),
    };
    const updated = ing.hazards.map((h) =>
      h.id === assignmentId ? { ...h, controlMeasures: [...h.controlMeasures, newCm] } : h,
    );
    updateIngredientHazards(ingId, updated);
    await pushHazardUpdates(ingId, updated);
    setNewCmFor(null);
  }

  async function removeControlMeasure(ingId: string, assignmentId: string, cmId: string) {
    const ing = getIngredient(ingId);
    const updated = ing.hazards.map((h) =>
      h.id === assignmentId ? { ...h, controlMeasures: h.controlMeasures.filter((cm) => cm.id !== cmId) } : h,
    );
    updateIngredientHazards(ingId, updated);
    await pushHazardUpdates(ingId, updated);
  }

  // ── Custom hazard creation ─────────────────────────────────────────────────

  async function createCustomHazard() {
    if (!newHazard.name.trim()) return;
    setSavingHazard(true);
    const res = await fetch("/api/hazards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newHazard),
    });
    if (res.ok) {
      const data = await res.json();
      const created: Hazard = {
        id: data.id,
        name: newHazard.name.trim(),
        type: newHazard.type,
        description: newHazard.description || null,
        severity: newHazard.severity || null,
        likelihood: newHazard.likelihood || null,
        sourceCategory: null,
        isSystemDefault: false,
        applicableStepCategories: null,
        createdAt: new Date().toISOString(),
      };
      setAllHazards((prev) => [...prev, created]);
      // Immediately assign if picker is open
      if (hazardPickerFor) {
        await assignHazard(hazardPickerFor, created);
      }
    }
    setNewHazard({ name: "", type: "biological", description: "", severity: "", likelihood: "" });
    setCreatingHazard(false);
    setSavingHazard(false);
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const pickerIngredient = hazardPickerFor ? getIngredient(hazardPickerFor) : null;
  const assignedHazardIds = new Set(pickerIngredient?.hazards.map((h) => h.hazardId) ?? []);
  const availableForPicker = allHazards.filter((h) => !assignedHazardIds.has(h.id));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {ingredients.length === 0 && !addingIngredient && (
        <div className="border rounded-lg p-8 text-center text-neutral-500 text-sm">
          No ingredients added yet. Click &ldquo;+ Add Ingredient&rdquo; to get started.
        </div>
      )}

      {ingredients.map((ing) => {
        const isExpanded = expandedIngredientId === ing.id;
        const sigCount = ing.hazards.filter((h) => h.isSignificant).length;

        return (
          <div key={ing.id} className="border rounded-lg overflow-hidden">
            {/* Ingredient header */}
            <div
              className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-neutral-50 cursor-pointer select-none"
              onClick={() => setExpandedIngredientId(isExpanded ? null : ing.id)}
            >
              <svg
                className={`w-4 h-4 text-neutral-400 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{ing.name}</span>
                  {ing.category && (
                    <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded">
                      {INGREDIENT_CATEGORIES.find((c) => c.value === ing.category)?.label ?? ing.category}
                    </span>
                  )}
                  {ing.supplier && <span className="text-xs text-neutral-400">Supplier: {ing.supplier}</span>}
                </div>
                {ing.description && <p className="text-xs text-neutral-500 mt-0.5 truncate">{ing.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {ing.hazards.length > 0 && (
                  <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded">
                    {ing.hazards.length} hazard{ing.hazards.length !== 1 ? "s" : ""}
                  </span>
                )}
                {sigCount > 0 && (
                  <Badge variant="destructive" className="text-xs">{sigCount} significant</Badge>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingIngredient({ ...ing }); }}
                  className="text-neutral-400 hover:text-neutral-700 p-1"
                  title="Edit ingredient"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536M9 11l6.5-6.5a2 2 0 012.828 2.828L11.828 13.83A4 4 0 019.828 15H9v-.828a4 4 0 011.172-2.828z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteIngredient(ing.id); }}
                  className="text-neutral-400 hover:text-red-600 p-1"
                  title="Delete ingredient"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Hazard analysis section */}
            {isExpanded && (
              <div className="border-t bg-neutral-50/50 px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Hazard Analysis</span>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setHazardPickerFor(ing.id)}>
                    + Add Hazard
                  </Button>
                </div>

                {ing.hazards.length === 0 ? (
                  <p className="text-sm text-neutral-400 italic text-center py-4">
                    No hazards assigned. Click &ldquo;+ Add Hazard&rdquo; to begin.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ing.hazards.map((assignment) => {
                      const sev = migrateOldLevel(assignment.severityOverride || assignment.hazard.severity);
                      const lik = migrateOldLevel(assignment.likelihoodOverride || assignment.hazard.likelihood);
                      const risk = computeRiskScore(sev, lik);
                      const isAutoSig = risk.isSignificant;
                      const isOverridden = assignment.isSignificant !== isAutoSig;
                      const isHazardExpanded = expandedHazardId === assignment.id;

                      return (
                        <div key={assignment.id} className="border rounded-lg overflow-hidden bg-white">
                          {/* Hazard row */}
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10">Type</TableHead>
                                <TableHead>Hazard</TableHead>
                                <TableHead className="w-32">Severity</TableHead>
                                <TableHead className="w-32">Likelihood</TableHead>
                                <TableHead className="w-20 text-center">Risk</TableHead>
                                <TableHead className="w-24 text-center">Significant?</TableHead>
                                <TableHead>Justification</TableHead>
                                <TableHead className="w-8"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${TYPE_COLORS[assignment.hazard.type] || ""}`}>
                                    {TYPE_LABELS[assignment.hazard.type] || assignment.hazard.type}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium text-sm">{assignment.hazard.name}</div>
                                  {assignment.hazard.description && (
                                    <div className="text-xs text-neutral-400 truncate max-w-xs">{assignment.hazard.description}</div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Select value={sev || ""} onValueChange={(v) => v && updateHazardField(ing.id, assignment.id, "severityOverride", v)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                                    <SelectContent>
                                      {SEVERITY_LEVELS.map((l) => (
                                        <SelectItem key={l.value} value={l.value}><span className="font-semibold">{l.value}</span>&nbsp;{l.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Select value={lik || ""} onValueChange={(v) => v && updateHazardField(ing.id, assignment.id, "likelihoodOverride", v)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                                    <SelectContent>
                                      {LIKELIHOOD_LEVELS.map((l) => (
                                        <SelectItem key={l.value} value={l.value}><span className="font-semibold">{l.value}</span>&nbsp;{l.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-center">
                                  {risk.score > 0 ? (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${RISK_COLORS[risk.category]}`}>
                                          {risk.score}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="font-semibold">{risk.label}</p>
                                        <p className="text-xs text-neutral-400">S{risk.severity} × L{risk.likelihood} = {risk.score}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : <span className="text-neutral-300 text-xs">—</span>}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <button
                                        onClick={() => updateHazardField(ing.id, assignment.id, "isSignificant", !assignment.isSignificant)}
                                        className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${assignment.isSignificant ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"} ${isOverridden ? "ring-2 ring-offset-1 ring-amber-400" : ""}`}
                                      >
                                        {assignment.isSignificant ? "Yes" : "No"}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {isOverridden
                                        ? <p className="text-amber-600 font-medium">Manually overridden (auto: {isAutoSig ? "Yes" : "No"})</p>
                                        : <p>Auto-determined. Click to override.</p>}
                                    </TooltipContent>
                                  </Tooltip>
                                </TableCell>
                                <TableCell>
                                  {editingJustification === assignment.id ? (
                                    <Textarea
                                      defaultValue={assignment.justification || ""}
                                      autoFocus rows={2} className="text-xs"
                                      onBlur={(e) => updateHazardField(ing.id, assignment.id, "justification", e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); updateHazardField(ing.id, assignment.id, "justification", (e.target as HTMLTextAreaElement).value); }
                                      }}
                                    />
                                  ) : (
                                    <button onClick={() => setEditingJustification(assignment.id)} className="text-xs text-left w-full text-neutral-600 hover:text-neutral-900">
                                      {assignment.justification || <span className="italic text-neutral-400">Click to add justification...</span>}
                                    </button>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <button onClick={() => { if (confirm(`Remove "${assignment.hazard.name}"?`)) removeHazard(ing.id, assignment.id); }} className="text-neutral-300 hover:text-red-500 p-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>

                          {/* Control measures sub-section */}
                          <div className="border-t bg-neutral-50/60">
                            <div
                              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-neutral-100/60"
                              onClick={() => setExpandedHazardId(isHazardExpanded ? null : assignment.id)}
                            >
                              <div className="flex items-center gap-2">
                                <svg className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${isHazardExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span className="text-xs font-medium text-neutral-600">Control Measures</span>
                                {assignment.controlMeasures.length > 0 && (
                                  <span className="text-xs bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded-full">
                                    {assignment.controlMeasures.length}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedHazardId(assignment.id);
                                  setNewCmFor({ ingId: ing.id, assignmentId: assignment.id, description: "", type: "preventive" });
                                }}
                                className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center gap-1"
                              >
                                + Add
                              </button>
                            </div>

                            {isHazardExpanded && (
                              <div className="px-3 pb-3">
                                {assignment.controlMeasures.length === 0 && newCmFor?.assignmentId !== assignment.id && (
                                  <p className="text-xs text-neutral-400 italic py-1">No control measures defined.</p>
                                )}
                                {assignment.controlMeasures.map((cm) => (
                                  <div key={cm.id} className="flex items-center gap-3 py-1.5 border-b last:border-b-0 group">
                                    <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded shrink-0 w-28 text-center">
                                      {CM_TYPE_LABELS[cm.type || ""] || cm.type || "Preventive"}
                                    </span>
                                    <span className="text-sm flex-1">{cm.description}</span>
                                    <button
                                      onClick={() => { if (confirm("Remove this control measure?")) removeControlMeasure(ing.id, assignment.id, cm.id); }}
                                      className="text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                ))}

                                {/* Inline add form */}
                                {newCmFor?.assignmentId === assignment.id && (
                                  <div className="flex items-center gap-2 mt-2 bg-blue-50/50 p-2 rounded">
                                    <Select
                                      value={newCmFor.type}
                                      onValueChange={(v) => v && setNewCmFor((prev) => prev ? { ...prev, type: v } : prev)}
                                    >
                                      <SelectTrigger className="h-7 text-xs w-36 shrink-0">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="preventive">Preventive</SelectItem>
                                        <SelectItem value="eliminative">Eliminative</SelectItem>
                                        <SelectItem value="reductive">Reductive</SelectItem>
                                        <SelectItem value="prp">PRP</SelectItem>
                                        <SelectItem value="external">External (Form 9)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      autoFocus
                                      placeholder="Describe the control measure..."
                                      value={newCmFor.description}
                                      onChange={(e) => setNewCmFor((prev) => prev ? { ...prev, description: e.target.value } : prev)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") addControlMeasure(newCmFor.ingId, newCmFor.assignmentId, newCmFor.description, newCmFor.type);
                                        if (e.key === "Escape") setNewCmFor(null);
                                      }}
                                      className="text-sm flex-1 h-7"
                                    />
                                    <Button size="sm" className="h-7 text-xs" onClick={() => addControlMeasure(newCmFor.ingId, newCmFor.assignmentId, newCmFor.description, newCmFor.type)} disabled={!newCmFor.description.trim()}>
                                      Save
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setNewCmFor(null)}>
                                      Cancel
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add ingredient form */}
      {addingIngredient ? (
        <div className="border rounded-lg p-4 bg-blue-50/40 space-y-3">
          <p className="text-sm font-medium">New Ingredient / Incoming Material</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Name *</label>
              <Input autoFocus value={newIngredient.name}
                onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                placeholder="e.g. Raw Carrots" className="text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") createIngredient(); if (e.key === "Escape") setAddingIngredient(false); }}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Category</label>
              <Select value={newIngredient.category ?? "raw-material"} onValueChange={(v) => v && setNewIngredient((prev) => ({ ...prev, category: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INGREDIENT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Supplier</label>
              <Input value={newIngredient.supplier} onChange={(e) => setNewIngredient({ ...newIngredient, supplier: e.target.value })} placeholder="Supplier name (optional)" className="text-sm" />
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Description</label>
              <Input value={newIngredient.description} onChange={(e) => setNewIngredient({ ...newIngredient, description: e.target.value })} placeholder="Brief description (optional)" className="text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={createIngredient} disabled={saving || !newIngredient.name.trim()}>{saving ? "Saving..." : "Add Ingredient"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setAddingIngredient(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setAddingIngredient(true)}>+ Add Ingredient / Material</Button>
      )}

      {/* Edit ingredient dialog */}
      <Dialog open={!!editingIngredient} onOpenChange={(o) => { if (!o) setEditingIngredient(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Ingredient</DialogTitle></DialogHeader>
          {editingIngredient && (
            <div className="space-y-3 mt-2">
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Name *</label>
                <Input value={editingIngredient.name} onChange={(e) => setEditingIngredient({ ...editingIngredient, name: e.target.value })} className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Category</label>
                <Select value={editingIngredient.category || "other"} onValueChange={(v) => v && setEditingIngredient({ ...editingIngredient, category: v })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INGREDIENT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Supplier</label>
                <Input value={editingIngredient.supplier || ""} onChange={(e) => setEditingIngredient({ ...editingIngredient, supplier: e.target.value })} className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Description</label>
                <Textarea value={editingIngredient.description || ""} onChange={(e) => setEditingIngredient({ ...editingIngredient, description: e.target.value })} rows={3} className="text-sm" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={saveIngredientEdit} disabled={saving || !editingIngredient.name.trim()}>{saving ? "Saving..." : "Save"}</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingIngredient(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hazard picker dialog */}
      <Dialog open={!!hazardPickerFor} onOpenChange={(o) => { if (!o) { setHazardPickerFor(null); setCreatingHazard(false); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Hazard to {pickerIngredient?.name}</DialogTitle>
          </DialogHeader>

          {/* Custom hazard creation form */}
          {creatingHazard ? (
            <div className="border rounded-lg p-4 bg-blue-50/40 space-y-3 mt-4">
              <p className="text-sm font-semibold">Create Custom Hazard</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-neutral-500 block mb-1">Hazard Name *</label>
                  <Input autoFocus value={newHazard.name} onChange={(e) => setNewHazard({ ...newHazard, name: e.target.value })} placeholder="e.g. Pesticide residue" className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Type *</label>
                  <Select value={newHazard.type} onValueChange={(v) => v && setNewHazard({ ...newHazard, type: v })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="biological">Biological</SelectItem>
                      <SelectItem value="chemical">Chemical</SelectItem>
                      <SelectItem value="physical">Physical</SelectItem>
                      <SelectItem value="allergen">Allergen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Description</label>
                  <Input value={newHazard.description} onChange={(e) => setNewHazard({ ...newHazard, description: e.target.value })} placeholder="Brief description" className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Default Severity</label>
                  <Select value={newHazard.severity || ""} onValueChange={(v) => setNewHazard({ ...newHazard, severity: v ?? "" })}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {SEVERITY_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}><span className="font-semibold">{l.value}</span>&nbsp;{l.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Default Likelihood</label>
                  <Select value={newHazard.likelihood || ""} onValueChange={(v) => setNewHazard({ ...newHazard, likelihood: v ?? "" })}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {LIKELIHOOD_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}><span className="font-semibold">{l.value}</span>&nbsp;{l.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={createCustomHazard} disabled={savingHazard || !newHazard.name.trim()}>{savingHazard ? "Saving..." : "Create & Add"}</Button>
                <Button size="sm" variant="ghost" onClick={() => setCreatingHazard(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <Button variant="outline" size="sm" className="w-full mb-4 border-dashed" onClick={() => setCreatingHazard(true)}>
                + Create Custom Hazard (not in database)
              </Button>
            </div>
          )}

          {/* Existing hazards from database */}
          {!creatingHazard && (
            <div className="space-y-4">
              {["biological", "chemical", "physical", "allergen"].map((type) => {
                const typeHazards = availableForPicker.filter((h) => h.type === type);
                if (typeHazards.length === 0) return null;
                return (
                  <div key={type}>
                    <h4 className="text-xs font-semibold uppercase text-neutral-500 mb-2">{type}</h4>
                    <div className="space-y-1">
                      {typeHazards.map((h) => {
                        const risk = computeRiskScore(migrateOldLevel(h.severity), migrateOldLevel(h.likelihood));
                        return (
                          <button key={h.id} onClick={() => hazardPickerFor && assignHazard(hazardPickerFor, h)}
                            className="w-full text-left p-2.5 rounded-lg hover:bg-neutral-50 border border-transparent hover:border-neutral-200 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${TYPE_COLORS[h.type]}`}>{TYPE_LABELS[h.type]}</span>
                              <span className="text-sm font-medium flex-1">{h.name}</span>
                              {!h.isSystemDefault && <span className="text-xs text-neutral-400 italic">custom</span>}
                              {risk.score > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${RISK_COLORS[risk.category]}`}>{risk.label}</span>
                              )}
                            </div>
                            {h.description && <p className="text-xs text-neutral-500 mt-1 ml-8 line-clamp-1">{h.description}</p>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {availableForPicker.length === 0 && (
                <p className="text-sm text-neutral-500 text-center py-4">All hazards have been assigned to this ingredient.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
