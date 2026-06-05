"use client";

import { useState, useMemo } from "react";
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
import type { OutputHazardAssignment, Hazard } from "@/lib/types";
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
  radiological: "R",
  fraud: "F",
};

const TYPE_COLORS: Record<string, string> = {
  biological: "bg-red-100 text-red-700",
  chemical: "bg-orange-100 text-orange-700",
  physical: "bg-blue-100 text-blue-700",
  allergen: "bg-purple-100 text-purple-700",
  radiological: "bg-yellow-100 text-yellow-700",
  fraud: "bg-neutral-100 text-neutral-700",
};

const TYPE_ORDER = ["biological", "chemical", "physical", "allergen", "radiological", "fraud"];

const TYPE_FULL_LABELS: Record<string, string> = {
  biological: "Biological",
  chemical: "Chemical",
  physical: "Physical",
  allergen: "Allergen",
  radiological: "Radiological",
  fraud: "Food Fraud / EMA",
};

interface Props {
  planId: string;
  outputId: string;
  outputName: string;
  assignments: OutputHazardAssignment[];
  availableHazards: Hazard[];
  onUpdate: (assignments: OutputHazardAssignment[]) => void;
}

function getEffectiveSeverity(a: OutputHazardAssignment): string | null {
  return migrateOldLevel(a.severityOverride || a.hazard.severity);
}

function getEffectiveLikelihood(a: OutputHazardAssignment): string | null {
  return migrateOldLevel(a.likelihoodOverride || a.hazard.likelihood);
}

export function OutputHazardIdentificationSection({
  planId,
  outputId,
  outputName,
  assignments,
  availableHazards,
  onUpdate,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingJustification, setEditingJustification] = useState<string | null>(null);
  const [pickerTab, setPickerTab] = useState<"suggested" | "all">("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const assignedIds = new Set(assignments.map((a) => a.hazardId));
  const unassignedHazards = availableHazards.filter((h) => !assignedIds.has(h.id));

  const scoredUnassigned = useMemo(() => {
    return unassignedHazards
      .map((h) => ({ hazard: h, score: 0 }))
      .sort((a, b) => a.hazard.name.localeCompare(b.hazard.name));
  }, [unassignedHazards]);

  const filteredAll = useMemo(() => {
    return scoredUnassigned.map((x) => x.hazard).filter((h) => {
      if (filterType !== "all" && h.type !== filterType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return h.name.toLowerCase().includes(q) || (h.description ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [scoredUnassigned, filterType, search]);

  const presentTypes = useMemo(() => {
    const types = new Set(unassignedHazards.map((h) => h.type));
    return TYPE_ORDER.filter((t) => types.has(t));
  }, [unassignedHazards]);

  async function assignHazard(hazard: Hazard) {
    const risk = computeRiskScore(
      migrateOldLevel(hazard.severity),
      migrateOldLevel(hazard.likelihood),
    );
    const res = await fetch(`/api/plans/${planId}/output-hazard-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outputId,
        hazardId: hazard.id,
        isSignificant: risk.isSignificant,
        severityOverride: migrateOldLevel(hazard.severity),
        likelihoodOverride: migrateOldLevel(hazard.likelihood),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const newAssignment: OutputHazardAssignment = {
        id: data.id,
        outputId,
        hazardId: hazard.id,
        isSignificant: risk.isSignificant,
        justification: null,
        severityOverride: migrateOldLevel(hazard.severity),
        likelihoodOverride: migrateOldLevel(hazard.likelihood),
        severityWithControls: null,
        likelihoodWithControls: null,
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
    const res = await fetch(`/api/plans/${planId}/output-hazard-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, severityOverride: value, isSignificant: risk.isSignificant }),
    });
    if (res.ok) {
      onUpdate(assignments.map((a) =>
        a.id === id ? { ...a, severityOverride: value, isSignificant: risk.isSignificant } : a,
      ));
    }
  }

  async function updateLikelihood(id: string, value: string) {
    const assignment = assignments.find((a) => a.id === id);
    if (!assignment) return;
    const sev = getEffectiveSeverity(assignment);
    const risk = computeRiskScore(sev, value);
    const res = await fetch(`/api/plans/${planId}/output-hazard-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, likelihoodOverride: value, isSignificant: risk.isSignificant }),
    });
    if (res.ok) {
      onUpdate(assignments.map((a) =>
        a.id === id ? { ...a, likelihoodOverride: value, isSignificant: risk.isSignificant } : a,
      ));
    }
  }

  async function updateSeverityWithControls(id: string, value: string) {
    const res = await fetch(`/api/plans/${planId}/output-hazard-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, severityWithControls: value || null }),
    });
    if (res.ok) {
      onUpdate(assignments.map((a) =>
        a.id === id ? { ...a, severityWithControls: value || null } : a,
      ));
    }
  }

  async function updateLikelihoodWithControls(id: string, value: string) {
    const res = await fetch(`/api/plans/${planId}/output-hazard-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, likelihoodWithControls: value || null }),
    });
    if (res.ok) {
      onUpdate(assignments.map((a) =>
        a.id === id ? { ...a, likelihoodWithControls: value || null } : a,
      ));
    }
  }

  async function toggleSignificantOverride(assignment: OutputHazardAssignment) {
    const newSig = !assignment.isSignificant;
    const res = await fetch(`/api/plans/${planId}/output-hazard-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: assignment.id, isSignificant: newSig }),
    });
    if (res.ok) {
      onUpdate(assignments.map((a) =>
        a.id === assignment.id ? { ...a, isSignificant: newSig } : a,
      ));
    }
  }

  async function updateJustification(id: string, value: string) {
    const res = await fetch(`/api/plans/${planId}/output-hazard-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, justification: value }),
    });
    if (res.ok) {
      onUpdate(assignments.map((a) => (a.id === id ? { ...a, justification: value } : a)));
    }
    setEditingJustification(null);
  }

  async function removeAssignment(id: string) {
    const res = await fetch(`/api/plans/${planId}/output-hazard-analysis?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      onUpdate(assignments.filter((a) => a.id !== id));
    }
  }

  function HazardPickerRow({ hazard }: { hazard: Hazard }) {
    const risk = computeRiskScore(migrateOldLevel(hazard.severity), migrateOldLevel(hazard.likelihood));
    return (
      <button
        onClick={() => assignHazard(hazard)}
        className="w-full text-left p-2.5 rounded-lg border border-transparent hover:bg-neutral-50 hover:border-neutral-200 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 ${TYPE_COLORS[hazard.type] ?? "bg-neutral-100 text-neutral-600"}`}>
            {TYPE_LABELS[hazard.type] ?? hazard.type[0].toUpperCase()}
          </span>
          <span className="text-sm font-medium flex-1 text-left">{hazard.name}</span>
          {risk.score > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border shrink-0 ${RISK_COLORS[risk.category]}`}>
              {risk.label}
            </span>
          )}
        </div>
        {hazard.description && (
          <p className="text-xs text-neutral-500 mt-1 ml-8 line-clamp-2">{hazard.description}</p>
        )}
      </button>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Type</TableHead>
            <TableHead>Hazard</TableHead>
            <TableHead colSpan={3} className="text-center text-red-700 bg-red-50 text-xs font-semibold border-x border-red-200">
              Risk Without Controls
            </TableHead>
            <TableHead colSpan={3} className="text-center text-green-700 bg-green-50 text-xs font-semibold border-x border-green-200">
              Risk With Controls
            </TableHead>
            <TableHead className="w-24 text-center">Significant?</TableHead>
            <TableHead>Justification</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
          <TableRow className="text-xs">
            <TableHead className="w-12"></TableHead>
            <TableHead></TableHead>
            <TableHead className="w-28 bg-red-50/50">Severity</TableHead>
            <TableHead className="w-28 bg-red-50/50">Likelihood</TableHead>
            <TableHead className="w-20 text-center bg-red-50/50">Risk</TableHead>
            <TableHead className="w-28 bg-green-50/50">Severity</TableHead>
            <TableHead className="w-28 bg-green-50/50">Likelihood</TableHead>
            <TableHead className="w-20 text-center bg-green-50/50">Risk</TableHead>
            <TableHead className="w-24 text-center"></TableHead>
            <TableHead></TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center text-neutral-500 py-8">
                No hazards assigned to this output. Add hazards below.
              </TableCell>
            </TableRow>
          ) : (
            assignments.map((a) => {
              const sev = getEffectiveSeverity(a);
              const lik = getEffectiveLikelihood(a);
              const risk = computeRiskScore(sev, lik);
              const isAutoSignificant = risk.isSignificant;
              const isOverridden = a.isSignificant !== isAutoSignificant;
              const swc = migrateOldLevel(a.severityWithControls);
              const lwc = migrateOldLevel(a.likelihoodWithControls);
              const riskWithControls = computeRiskScore(swc, lwc);

              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${TYPE_COLORS[a.hazard.type] || ""}`}>
                      {TYPE_LABELS[a.hazard.type] || a.hazard.type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{a.hazard.name}</div>
                  </TableCell>
                  {/* Without controls */}
                  <TableCell className="bg-red-50/30">
                    <Select value={sev || ""} onValueChange={(v) => v && updateSeverity(a.id, v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
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
                  <TableCell className="bg-red-50/30">
                    <Select value={lik || ""} onValueChange={(v) => v && updateLikelihood(a.id, v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
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
                  <TableCell className="text-center bg-red-50/30">
                    {risk.score > 0 ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border ${RISK_COLORS[risk.category]}`}>
                            {risk.score}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold">{risk.label}</p>
                          <p className="text-xs text-neutral-400">S{risk.severity} × L{risk.likelihood} = {risk.score}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-neutral-300 text-xs">—</span>
                    )}
                  </TableCell>
                  {/* With controls */}
                  <TableCell className="bg-green-50/30">
                    <Select value={swc || ""} onValueChange={(v) => updateSeverityWithControls(a.id, v ?? "")}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
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
                  <TableCell className="bg-green-50/30">
                    <Select value={lwc || ""} onValueChange={(v) => updateLikelihoodWithControls(a.id, v ?? "")}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
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
                  <TableCell className="text-center bg-green-50/30">
                    {riskWithControls.score > 0 ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border ${RISK_COLORS[riskWithControls.category]}`}>
                            {riskWithControls.score}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold">{riskWithControls.label}</p>
                          <p className="text-xs text-neutral-400">S{riskWithControls.severity} × L{riskWithControls.likelihood} = {riskWithControls.score}</p>
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
                          <p>Auto-determined from risk score.<br />Click to override.</p>
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
                          <span className="italic text-neutral-400">Click to add justification...</span>
                        )}
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Remove "${a.hazard.name}" from this output?`)) removeAssignment(a.id);
                      }}
                      className="text-neutral-400 hover:text-red-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
        <Dialog open={pickerOpen} onOpenChange={(o) => {
          setPickerOpen(o);
          if (o) { setSearch(""); setFilterType("all"); }
        }}>
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            + Add Hazard
          </Button>

          <DialogContent className="max-w-2xl max-h-[82vh] flex flex-col overflow-hidden">
            <DialogHeader className="shrink-0">
              <DialogTitle>Add Hazard to &quot;{outputName}&quot;</DialogTitle>
            </DialogHeader>

            <div className="flex gap-2 mt-2 shrink-0">
              <input
                type="text"
                placeholder="Search hazards..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400"
              />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-sm border rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400"
              >
                <option value="all">All types</option>
                {presentTypes.map((t) => (
                  <option key={t} value={t}>{TYPE_FULL_LABELS[t] ?? t}</option>
                ))}
              </select>
            </div>

            <div className="overflow-y-auto flex-1 pt-2">
              {filteredAll.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-6">
                  {unassignedHazards.length === 0
                    ? "All hazards have been assigned to this output."
                    : "No hazards match your search."}
                </p>
              ) : (
                (filterType === "all" ? presentTypes : [filterType]).map((type) => {
                  const items = filteredAll.filter((h) => h.type === type);
                  if (items.length === 0) return null;
                  return (
                    <div key={type} className="mb-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${TYPE_COLORS[type] ?? "bg-neutral-100 text-neutral-600"}`}>
                          {TYPE_FULL_LABELS[type] ?? type}
                        </span>
                        <span className="text-xs text-neutral-400">{items.length}</span>
                      </div>
                      <div className="space-y-1">
                        {items.map((h) => <HazardPickerRow key={h.id} hazard={h} />)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
