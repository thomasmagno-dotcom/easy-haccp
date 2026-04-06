"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { StepHazardAssignment, Hazard } from "@/lib/types";
import {
  SEVERITY_LEVELS,
  LIKELIHOOD_LEVELS,
  computeRiskScore,
  RISK_COLORS,
  migrateOldLevel,
} from "@/lib/risk-matrix";

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
  stepId: string;
  assignments: StepHazardAssignment[];
  availableHazards: Hazard[];
  onUpdate: (assignments: StepHazardAssignment[]) => void;
}

function getEffectiveSeverity(a: StepHazardAssignment): string | null {
  return migrateOldLevel(a.severityOverride || a.hazard.severity);
}

function getEffectiveLikelihood(a: StepHazardAssignment): string | null {
  return migrateOldLevel(a.likelihoodOverride || a.hazard.likelihood);
}

export function HazardIdentificationSection({
  planId,
  stepId,
  assignments,
  availableHazards,
  onUpdate,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingJustification, setEditingJustification] = useState<string | null>(null);

  const assignedIds = new Set(assignments.map((a) => a.hazardId));
  const unassignedHazards = availableHazards.filter((h) => !assignedIds.has(h.id));

  async function assignHazard(hazard: Hazard) {
    const risk = computeRiskScore(
      migrateOldLevel(hazard.severity),
      migrateOldLevel(hazard.likelihood),
    );

    const res = await fetch(`/api/plans/${planId}/hazard-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stepId,
        hazardId: hazard.id,
        isSignificant: risk.isSignificant,
        severityOverride: migrateOldLevel(hazard.severity),
        likelihoodOverride: migrateOldLevel(hazard.likelihood),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const newAssignment: StepHazardAssignment = {
        id: data.id,
        stepId,
        hazardId: hazard.id,
        isSignificant: risk.isSignificant,
        justification: null,
        severityOverride: migrateOldLevel(hazard.severity),
        likelihoodOverride: migrateOldLevel(hazard.likelihood),
        decisionTreeAnswers: null,
        createdAt: new Date().toISOString(),
        hazard,
        controlMeasures: [],
      };
      onUpdate([...assignments, newAssignment]);
    }
  }

  async function updateSeverity(id: string, value: string) {
    const assignment = assignments.find((a) => a.id === id);
    if (!assignment) return;
    const lik = getEffectiveLikelihood(assignment);
    const risk = computeRiskScore(value, lik);

    const res = await fetch(`/api/plans/${planId}/hazard-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        severityOverride: value,
        isSignificant: risk.isSignificant,
      }),
    });
    if (res.ok) {
      onUpdate(
        assignments.map((a) =>
          a.id === id
            ? { ...a, severityOverride: value, isSignificant: risk.isSignificant }
            : a,
        ),
      );
    }
  }

  async function updateLikelihood(id: string, value: string) {
    const assignment = assignments.find((a) => a.id === id);
    if (!assignment) return;
    const sev = getEffectiveSeverity(assignment);
    const risk = computeRiskScore(sev, value);

    const res = await fetch(`/api/plans/${planId}/hazard-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        likelihoodOverride: value,
        isSignificant: risk.isSignificant,
      }),
    });
    if (res.ok) {
      onUpdate(
        assignments.map((a) =>
          a.id === id
            ? { ...a, likelihoodOverride: value, isSignificant: risk.isSignificant }
            : a,
        ),
      );
    }
  }

  async function toggleSignificantOverride(assignment: StepHazardAssignment) {
    const newSig = !assignment.isSignificant;
    const res = await fetch(`/api/plans/${planId}/hazard-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: assignment.id, isSignificant: newSig }),
    });
    if (res.ok) {
      onUpdate(
        assignments.map((a) =>
          a.id === assignment.id ? { ...a, isSignificant: newSig } : a,
        ),
      );
    }
  }

  async function updateJustification(id: string, value: string) {
    const res = await fetch(`/api/plans/${planId}/hazard-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, justification: value }),
    });
    if (res.ok) {
      onUpdate(
        assignments.map((a) => (a.id === id ? { ...a, justification: value } : a)),
      );
    }
    setEditingJustification(null);
  }

  async function removeAssignment(id: string) {
    const res = await fetch(`/api/plans/${planId}/hazard-analysis?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onUpdate(assignments.filter((a) => a.id !== id));
    }
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Type</TableHead>
            <TableHead>Hazard</TableHead>
            <TableHead className="w-32">Severity</TableHead>
            <TableHead className="w-32">Likelihood</TableHead>
            <TableHead className="w-24 text-center">Risk Score</TableHead>
            <TableHead className="w-24 text-center">Significant?</TableHead>
            <TableHead>Justification</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-neutral-500 py-8">
                No hazards assigned to this step. Add hazards from the reference database.
              </TableCell>
            </TableRow>
          ) : (
            assignments.map((a) => {
              const sev = getEffectiveSeverity(a);
              const lik = getEffectiveLikelihood(a);
              const risk = computeRiskScore(sev, lik);
              const isAutoSignificant = risk.isSignificant;
              const isOverridden = a.isSignificant !== isAutoSignificant;

              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${TYPE_COLORS[a.hazard.type] || ""}`}
                    >
                      {TYPE_LABELS[a.hazard.type] || a.hazard.type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{a.hazard.name}</div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={sev || ""}
                      onValueChange={(v) => v && updateSeverity(a.id, v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITY_LEVELS.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            <span className="flex items-center gap-1.5">
                              <span className="font-semibold">{level.value}</span>
                              <span>{level.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={lik || ""}
                      onValueChange={(v) => v && updateLikelihood(a.id, v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {LIKELIHOOD_LEVELS.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            <span className="flex items-center gap-1.5">
                              <span className="font-semibold">{level.value}</span>
                              <span>{level.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    {risk.score > 0 ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border ${RISK_COLORS[risk.category]}`}
                          >
                            {risk.score}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold">{risk.label}</p>
                          <p className="text-xs text-neutral-400">
                            S{risk.severity} × L{risk.likelihood} = {risk.score}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-neutral-300 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Tooltip>
                      <TooltipTrigger>
                        <button
                          onClick={() => toggleSignificantOverride(a)}
                          className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                            a.isSignificant
                              ? "bg-red-100 text-red-700 hover:bg-red-200"
                              : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                          } ${isOverridden ? "ring-2 ring-offset-1 ring-amber-400" : ""}`}
                        >
                          {a.isSignificant ? "Yes" : "No"}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {risk.score === 0 ? (
                          <p>Set severity and likelihood first</p>
                        ) : isOverridden ? (
                          <p className="text-amber-600 font-medium">
                            Manually overridden (auto would be: {isAutoSignificant ? "Yes" : "No"})
                          </p>
                        ) : (
                          <p>
                            Auto-determined from risk score.
                            <br />
                            Click to override.
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    {editingJustification === a.id ? (
                      <Textarea
                        defaultValue={a.justification || ""}
                        autoFocus
                        rows={2}
                        className="text-xs"
                        onBlur={(e) => updateJustification(a.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            updateJustification(a.id, (e.target as HTMLTextAreaElement).value);
                          }
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingJustification(a.id)}
                        className="text-xs text-left w-full text-neutral-600 hover:text-neutral-900"
                      >
                        {a.justification || (
                          <span className="italic text-neutral-400">
                            Click to add justification...
                          </span>
                        )}
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Remove "${a.hazard.name}" from this step?`)) {
                          removeAssignment(a.id);
                        }
                      }}
                      className="text-neutral-400 hover:text-red-600"
                      title="Remove hazard from this step"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <div className="mt-3">
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            + Add Hazard
          </Button>
          <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Hazard from Reference Database</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {["biological", "chemical", "physical"].map((type) => {
                const typeHazards = unassignedHazards.filter((h) => h.type === type);
                if (typeHazards.length === 0) return null;
                return (
                  <div key={type}>
                    <h4 className="text-xs font-semibold uppercase text-neutral-500 mb-2">
                      {type}
                    </h4>
                    <div className="space-y-1">
                      {typeHazards.map((h) => {
                        const risk = computeRiskScore(
                          migrateOldLevel(h.severity),
                          migrateOldLevel(h.likelihood),
                        );
                        return (
                          <button
                            key={h.id}
                            onClick={() => assignHazard(h)}
                            className="w-full text-left p-2.5 rounded-lg hover:bg-neutral-50 border border-transparent hover:border-neutral-200 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-xs font-semibold ${TYPE_COLORS[h.type]}`}
                              >
                                {TYPE_LABELS[h.type]}
                              </span>
                              <span className="text-sm font-medium flex-1">{h.name}</span>
                              {risk.score > 0 && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${RISK_COLORS[risk.category]}`}
                                >
                                  {risk.label}
                                </span>
                              )}
                            </div>
                            {h.description && (
                              <p className="text-xs text-neutral-500 mt-1 ml-8 line-clamp-1">
                                {h.description}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {unassignedHazards.length === 0 && (
                <p className="text-sm text-neutral-500 text-center py-4">
                  All hazards from the reference database have been assigned.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
