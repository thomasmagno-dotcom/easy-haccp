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
import type { StepHazardAssignment, Hazard } from "@/lib/types";
import {
  SEVERITY_LEVELS,
  LIKELIHOOD_LEVELS,
  computeRiskScore,
  RISK_COLORS,
  migrateOldLevel,
} from "@/lib/risk-matrix";

// ── Type display config ───────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  biological:   "B",
  chemical:     "C",
  physical:     "P",
  allergen:     "A",
  radiological: "R",
  fraud:        "F",
};

const TYPE_COLORS: Record<string, string> = {
  biological:   "bg-red-100 text-red-700",
  chemical:     "bg-orange-100 text-orange-700",
  physical:     "bg-blue-100 text-blue-700",
  allergen:     "bg-purple-100 text-purple-700",
  radiological: "bg-yellow-100 text-yellow-700",
  fraud:        "bg-neutral-100 text-neutral-700",
};

const TYPE_ORDER = ["biological", "chemical", "physical", "allergen", "radiological", "fraud"];

const TYPE_FULL_LABELS: Record<string, string> = {
  biological:   "Biological",
  chemical:     "Chemical",
  physical:     "Physical",
  allergen:     "Allergen",
  radiological: "Radiological",
  fraud:        "Food Fraud / EMA",
};

// ── Suggestion engine ─────────────────────────────────────────────────────────
//
// Returns a relevance score 0–3 for a given hazard + step context:
//   3 = strongly suggested (name keyword match)
//   2 = suggested (category match in applicableStepCategories)
//   1 = weakly suggested (general hazard relevant to any food operation)
//   0 = not suggested
//
// Step keyword → hazard name fragment maps
const STEP_KEYWORD_HAZARD_MAP: { keywords: string[]; hazardFragments: string[] }[] = [
  // Receiving / incoming raw materials
  {
    keywords: ["receiv", "incoming", "intake", "accept", "unload", "delivery"],
    hazardFragments: ["salmonella", "listeria", "e. coli", "campylobacter", "pesticide", "heavy metal", "mycotoxin", "aflatoxin", "stone", "gravel", "glass", "wood", "metal fragment", "bone", "species substitution", "adulteration", "counterfeit", "fraud", "radiolog", "cesium", "strontium", "mercury"],
  },
  // Washing / rinsing / flume
  {
    keywords: ["wash", "rinse", "flume", "soak", "hydro", "clean"],
    hazardFragments: ["salmonella", "listeria", "e. coli", "cryptosporidium", "cyclospora", "chlorine", "sanitizer", "norovirus", "hepatitis"],
  },
  // Cooking / heating / pasteurising / baking / frying / roasting
  {
    keywords: ["cook", "heat", "pasteur", "bake", "fry", "roast", "grill", "boil", "blanch", "steril", "retort", "thermal"],
    hazardFragments: ["salmonella", "listeria", "e. coli", "campylobacter", "clostridium", "bacillus", "staphylococcus", "hepatitis", "norovirus", "acrylamide", "nitrite"],
  },
  // Cooling / chilling / refrigeration
  {
    keywords: ["cool", "chill", "refrigerat", "cold storage", "blast", "freeze", "frozen"],
    hazardFragments: ["listeria", "clostridium", "bacillus", "yersinia", "botulinum", "spoilage"],
  },
  // Cutting / slicing / dicing / trimming / deboning
  {
    keywords: ["cut", "slice", "dice", "trim", "chop", "debone", "fillet", "portion", "shap", "peel", "abras"],
    hazardFragments: ["metal fragment", "bone", "plastic", "rubber", "personal effect", "listeria", "salmonella", "staphylococcus", "e. coli"],
  },
  // Mixing / blending / formulating
  {
    keywords: ["mix", "blend", "formula", "combin", "compound", "knead", "homogen"],
    hazardFragments: ["allergen", "cleaning chemical", "lubricant", "staphylococcus", "cross-contact"],
  },
  // Packaging / filling / sealing
  {
    keywords: ["packag", "fill", "seal", "wrap", "bag", "can", "bottle", "jar", "MAP", "vacuum", "modified atmosphere"],
    hazardFragments: ["clostridium botulinum", "listeria", "glass", "plastic", "metal fragment", "allergen", "packaging material migration", "norovirus", "personal effect"],
  },
  // Metal detection / X-ray inspection
  {
    keywords: ["metal detect", "x-ray", "xray", "inspection", "detect"],
    hazardFragments: ["metal fragment", "bone", "glass", "stone", "plastic", "wire"],
  },
  // Storage (dry / ambient)
  {
    keywords: ["storage", "warehouse", "silo", "store", "stock", "hold"],
    hazardFragments: ["salmonella", "listeria", "aflatoxin", "ochratoxin", "mycotoxin", "don", "zearalenone", "patulin", "insect", "pest", "glass", "spoilage", "solanine"],
  },
  // Shipping / distribution / loading
  {
    keywords: ["ship", "distribut", "transport", "load", "dispatch", "deliver", "logistic"],
    hazardFragments: ["listeria", "salmonella", "temperature", "glass"],
  },
  // Fermentation / curing / brining
  {
    keywords: ["ferment", "cur", "brine", "pickle", "marinat", "age", "mature"],
    hazardFragments: ["clostridium", "botulinum", "listeria", "histamine", "nitrite", "nitrate"],
  },
  // Seafood-specific
  {
    keywords: ["seafood", "fish", "shellfish", "shrimp", "oyster", "salmon", "tuna", "crab", "lobster"],
    hazardFragments: ["vibrio", "anisakis", "histamine", "mercury", "polonium", "allergen — fish", "allergen — shellfish", "norovirus"],
  },
  // Dairy / milk
  {
    keywords: ["dairy", "milk", "cheese", "cream", "butter", "yogurt", "whey"],
    hazardFragments: ["listeria", "salmonella", "campylobacter", "brucella", "mycobacterium", "allergen — milk", "aflatoxin"],
  },
  // Meat / poultry
  {
    keywords: ["meat", "poultry", "chicken", "beef", "pork", "turkey", "slaughter", "deboning"],
    hazardFragments: ["salmonella", "campylobacter", "e. coli", "listeria", "clostridium", "staphylococcus", "toxoplasma", "trichinella", "bone fragment"],
  },
  // Grain / cereal / milling
  {
    keywords: ["grain", "cereal", "flour", "mill", "wheat", "barley", "oat", "corn", "maize"],
    hazardFragments: ["deoxynivalenol", "ochratoxin", "zearalenone", "aflatoxin", "bacillus", "stone", "metal fragment", "allergen — wheat"],
  },
  // Nuts / seeds
  {
    keywords: ["nut", "peanut", "almond", "cashew", "seed", "pistachio"],
    hazardFragments: ["aflatoxin", "allergen — peanut", "allergen — tree nut", "salmonella", "stone", "pit and stone"],
  },
  // Fresh produce / fruits / vegetables
  {
    keywords: ["produce", "fruit", "vegetable", "fresh", "salad", "leaf", "sprout", "herb"],
    hazardFragments: ["salmonella", "listeria", "e. coli", "cryptosporidium", "cyclospora", "pesticide", "heavy metal"],
  },
];

function scoreSuggestion(hazard: Hazard, stepName: string, stepCategory: string | null): number {
  const nameLower = stepName.toLowerCase();
  const hazardNameLower = hazard.name.toLowerCase();

  // Check for step-name keyword → hazard name fragment matches (score 3)
  for (const rule of STEP_KEYWORD_HAZARD_MAP) {
    const keywordMatch = rule.keywords.some((kw) => nameLower.includes(kw));
    if (keywordMatch) {
      const hazardMatch = rule.hazardFragments.some((frag) =>
        hazardNameLower.includes(frag.toLowerCase()),
      );
      if (hazardMatch) return 3;
    }
  }

  // Check applicableStepCategories from the hazard's own metadata (score 2)
  if (stepCategory && hazard.applicableStepCategories) {
    try {
      const cats: string[] = JSON.parse(hazard.applicableStepCategories);
      if (cats.includes(stepCategory)) return 2;
    } catch {
      // ignore
    }
  }

  return 0;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  planId: string;
  stepId: string;
  stepName: string;
  stepCategory: string | null;
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

// ── Component ─────────────────────────────────────────────────────────────────

export function HazardIdentificationSection({
  planId,
  stepId,
  stepName,
  stepCategory,
  assignments,
  availableHazards,
  onUpdate,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingJustification, setEditingJustification] = useState<string | null>(null);
  const [pickerTab, setPickerTab] = useState<"suggested" | "all">("suggested");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const assignedIds = new Set(assignments.map((a) => a.hazardId));
  const unassignedHazards = availableHazards.filter((h) => !assignedIds.has(h.id));

  // Score and sort suggestions
  const scoredUnassigned = useMemo(() => {
    return unassignedHazards
      .map((h) => ({ hazard: h, score: scoreSuggestion(h, stepName, stepCategory) }))
      .sort((a, b) => b.score - a.score || a.hazard.name.localeCompare(b.hazard.name));
  }, [unassignedHazards, stepName, stepCategory]);

  const suggestedHazards = scoredUnassigned.filter((x) => x.score >= 2).map((x) => x.hazard);

  // Filtered list for the "All hazards" tab
  const filteredAll = useMemo(() => {
    return scoredUnassigned
      .map((x) => x.hazard)
      .filter((h) => {
        if (filterType !== "all" && h.type !== filterType) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return h.name.toLowerCase().includes(q) || (h.description ?? "").toLowerCase().includes(q);
        }
        return true;
      });
  }, [scoredUnassigned, filterType, search]);

  // All types present in the unassigned list
  const presentTypes = useMemo(() => {
    const types = new Set(unassignedHazards.map((h) => h.type));
    return TYPE_ORDER.filter((t) => types.has(t));
  }, [unassignedHazards]);

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
    const res = await fetch(`/api/plans/${planId}/hazard-analysis`, {
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

  async function toggleSignificantOverride(assignment: StepHazardAssignment) {
    const newSig = !assignment.isSignificant;
    const res = await fetch(`/api/plans/${planId}/hazard-analysis`, {
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
    const res = await fetch(`/api/plans/${planId}/hazard-analysis`, {
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
    const res = await fetch(`/api/plans/${planId}/hazard-analysis?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      onUpdate(assignments.filter((a) => a.id !== id));
    }
  }

  // ── Shared hazard row renderer for picker ────────────────────────────────
  function HazardPickerRow({ hazard, isSuggested, score }: { hazard: Hazard; isSuggested: boolean; score?: number }) {
    const risk = computeRiskScore(migrateOldLevel(hazard.severity), migrateOldLevel(hazard.likelihood));
    return (
      <button
        onClick={() => assignHazard(hazard)}
        className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
          isSuggested
            ? "border-amber-200 bg-amber-50/50 hover:bg-amber-50 hover:border-amber-300"
            : "border-transparent hover:bg-neutral-50 hover:border-neutral-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 ${TYPE_COLORS[hazard.type] ?? "bg-neutral-100 text-neutral-600"}`}>
            {TYPE_LABELS[hazard.type] ?? hazard.type[0].toUpperCase()}
          </span>
          <span className="text-sm font-medium flex-1 text-left">{hazard.name}</span>
          {isSuggested && score === 3 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold border border-amber-200 shrink-0">
              Strong match
            </span>
          )}
          {risk.score > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border shrink-0 ${RISK_COLORS[risk.category]}`}>
              {risk.label}
            </span>
          )}
        </div>
        {hazard.description && (
          <p className="text-xs text-neutral-500 mt-1 ml-8 line-clamp-2">
            {hazard.description}
          </p>
        )}
      </button>
    );
  }

  return (
    <div>
      {/* ── Assigned hazards table ────────────────────────────────────────── */}
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
                No hazards assigned to this step. Add hazards below.
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
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${TYPE_COLORS[a.hazard.type] || ""}`}>
                      {TYPE_LABELS[a.hazard.type] || a.hazard.type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{a.hazard.name}</div>
                  </TableCell>
                  <TableCell>
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
                  <TableCell>
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
                  <TableCell className="text-center">
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
                        if (confirm(`Remove "${a.hazard.name}" from this step?`)) removeAssignment(a.id);
                      }}
                      className="text-neutral-400 hover:text-red-600"
                      title="Remove hazard from this step"
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

      {/* ── Add Hazard button + Dialog ────────────────────────────────────── */}
      <div className="mt-3">
        <Dialog open={pickerOpen} onOpenChange={(o) => {
          setPickerOpen(o);
          if (o) { setPickerTab(suggestedHazards.length > 0 ? "suggested" : "all"); setSearch(""); setFilterType("all"); }
        }}>
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            + Add Hazard
          </Button>

          <DialogContent className="max-w-2xl max-h-[82vh] flex flex-col overflow-hidden">
            <DialogHeader className="shrink-0">
              <DialogTitle>Add Hazard to This Step</DialogTitle>
            </DialogHeader>

            {/* ── Tabs ── */}
            <div className="flex gap-1 border-b pb-0 shrink-0 mt-1">
              <button
                onClick={() => setPickerTab("suggested")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  pickerTab === "suggested"
                    ? "border-amber-500 text-amber-700"
                    : "border-transparent text-neutral-500 hover:text-neutral-700"
                }`}
              >
                ✦ Suggested
                {suggestedHazards.length > 0 && (
                  <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">
                    {suggestedHazards.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setPickerTab("all")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  pickerTab === "all"
                    ? "border-neutral-800 text-neutral-800"
                    : "border-transparent text-neutral-500 hover:text-neutral-700"
                }`}
              >
                All Hazards
                <span className="ml-1.5 text-xs bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full">
                  {unassignedHazards.length}
                </span>
              </button>
            </div>

            {/* ── Tab content ── */}
            <div className="overflow-y-auto flex-1 pt-2">

              {/* SUGGESTED TAB */}
              {pickerTab === "suggested" && (
                <div>
                  {suggestedHazards.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-sm text-neutral-500">No automatic suggestions for this step name.</p>
                      <p className="text-xs text-neutral-400 mt-1">Switch to &quot;All Hazards&quot; to browse the full database.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-neutral-500 mb-3 px-1">
                        Hazards commonly associated with{" "}
                        <span className="font-medium text-neutral-700">&quot;{stepName}&quot;</span>
                        {stepCategory ? ` (${stepCategory})` : ""} steps.
                        Based on step name keywords and category matching.
                      </p>
                      <div className="space-y-1">
                        {scoredUnassigned
                          .filter((x) => x.score >= 2)
                          .map(({ hazard, score }) => (
                            <HazardPickerRow key={hazard.id} hazard={hazard} isSuggested score={score} />
                          ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ALL HAZARDS TAB */}
              {pickerTab === "all" && (
                <div>
                  {/* Search + type filter */}
                  <div className="flex gap-2 mb-3">
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

                  {filteredAll.length === 0 ? (
                    <p className="text-sm text-neutral-500 text-center py-6">
                      {unassignedHazards.length === 0
                        ? "All hazards have been assigned to this step."
                        : "No hazards match your search."}
                    </p>
                  ) : (
                    <>
                      {/* Group by type */}
                      {(filterType === "all" ? presentTypes : [filterType]).map((type) => {
                        const items = filteredAll.filter((h) => h.type === type);
                        if (items.length === 0) return null;
                        // Mark suggested ones
                        const suggestedSet = new Set(suggestedHazards.map((h) => h.id));
                        return (
                          <div key={type} className="mb-4">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${TYPE_COLORS[type] ?? "bg-neutral-100 text-neutral-600"}`}>
                                {TYPE_FULL_LABELS[type] ?? type}
                              </span>
                              <span className="text-xs text-neutral-400">{items.length}</span>
                            </div>
                            <div className="space-y-1">
                              {items.map((h) => (
                                <HazardPickerRow
                                  key={h.id}
                                  hazard={h}
                                  isSuggested={suggestedSet.has(h.id)}
                                  score={scoredUnassigned.find((x) => x.hazard.id === h.id)?.score}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
