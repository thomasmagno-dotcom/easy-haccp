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
  SEVERITY_LEVELS,
  LIKELIHOOD_LEVELS,
  computeRiskScore,
  RISK_COLORS,
  migrateOldLevel,
} from "@/lib/risk-matrix";
import {
  computeResult,
  parseDecisionTree,
} from "@/lib/logic/decision-tree";
import type { DecisionTreeAnswers } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ControlMeasure {
  id: string; description: string; type: string | null;
  prpMasterId: string | null; prpName: string | null; prpFsepCode: string | null;
}

interface SubgraphHazardAssignment {
  id: string; subgraphStepId: string; hazardId: string;
  isSignificant: boolean; justification: string | null;
  severityOverride: string | null; likelihoodOverride: string | null;
  severityWithControls: string | null; likelihoodWithControls: string | null;
  decisionTreeAnswers: string | null;
  hazard: { id: string; name: string; type: string; severity: string | null; likelihood: string | null; description: string | null };
  controlMeasures: ControlMeasure[];
}

interface Prp { id: string; programName: string; prpType: string; fsepCode: string | null }
interface AvailableHazard { id: string; name: string; type: string; severity: string | null; likelihood: string | null }

interface Props {
  planId: string; subgraphStepId: string; subgraphStepName: string;
  availableHazards: AvailableHazard[];
  initialAssignments: SubgraphHazardAssignment[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  biological:"B", chemical:"C", physical:"P", allergen:"A", radiological:"R", fraud:"F",
};
const TYPE_COLORS: Record<string, string> = {
  biological:   "bg-red-100 text-red-700 border-red-200",
  chemical:     "bg-orange-100 text-orange-700 border-orange-200",
  physical:     "bg-blue-100 text-blue-700 border-blue-200",
  allergen:     "bg-purple-100 text-purple-700 border-purple-200",
  radiological: "bg-yellow-100 text-yellow-700 border-yellow-200",
  fraud:        "bg-neutral-100 text-neutral-600 border-neutral-200",
};
const TYPE_FULL: Record<string, string> = {
  biological:"Biological", chemical:"Chemical", physical:"Physical",
  allergen:"Allergen", radiological:"Radiological", fraud:"Food Fraud / EMA",
};
const HAZARD_TYPES = ["biological","chemical","physical","allergen","radiological","fraud"];
const CM_TYPES = [
  { value:"preventive",  label:"Preventive"  },
  { value:"eliminative", label:"Eliminative" },
  { value:"reductive",   label:"Reductive"   },
  { value:"prp",         label:"PRP / GHP"   },
  { value:"external",    label:"External"    },
];

const DT_RESULT_CONFIG: Record<string, { label: string; classes: string }> = {
  ccp:     { label:"CCP",              classes:"bg-red-100 text-red-700 border border-red-300"         },
  not_ccp: { label:"Not a CCP",        classes:"bg-green-100 text-green-700 border border-green-300"   },
  prp:     { label:"GHP / PRP",        classes:"bg-teal-100 text-teal-700 border border-teal-300"      },
  modify:  { label:"Modify Process",   classes:"bg-orange-100 text-orange-700 border border-orange-300"},
};

const DT_QUESTIONS = [
  { key:"q1", text:"Q1 — Can the hazard be controlled to an acceptable level by existing GHPs/PRPs?" },
  { key:"q2", text:"Q2 — Do specific control measures for this hazard exist at this step?"           },
  { key:"q3", text:"Q3 — Will a subsequent step eliminate or reduce this hazard to acceptable levels?"},
  { key:"q4", text:"Q4 — Can this specific step prevent or eliminate the hazard?"                    },
] as const;

// Which questions are visible given current answers
function visibleQuestions(dt: DecisionTreeAnswers): (typeof DT_QUESTIONS[number]["key"])[] {
  const qs: (typeof DT_QUESTIONS[number]["key"])[] = ["q1"];
  if (dt.q1 === false) { qs.push("q2"); }
  if (dt.q1 === false && dt.q2 === true) { qs.push("q3"); }
  if (dt.q1 === false && dt.q2 === true && dt.q3 === false) { qs.push("q4"); }
  return qs;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SubgraphStepAnalysis({
  planId, subgraphStepId, availableHazards: initialHazards, initialAssignments,
}: Props) {
  const [assignments, setAssignments] = useState<SubgraphHazardAssignment[]>(initialAssignments);
  const [hazardLibrary, setHazardLibrary] = useState<AvailableHazard[]>(initialHazards);
  const [dtAnswers, setDtAnswers] = useState<Record<string, DecisionTreeAnswers>>(() => {
    const m: Record<string, DecisionTreeAnswers> = {};
    for (const a of initialAssignments) m[a.id] = parseDecisionTree(a.decisionTreeAnswers);
    return m;
  });

  // Assign hazard
  const [selectedHazardId, setSelectedHazardId] = useState("");
  const [adding, setAdding] = useState(false);

  // Control measures
  const [cmText, setCmText] = useState<Record<string, string>>({});
  const [cmType, setCmType] = useState<Record<string, string>>({});
  const [cmPrpId, setCmPrpId] = useState<Record<string, string>>({});
  const [addingCm, setAddingCm] = useState<Record<string, boolean>>({});
  const [prps, setPrps] = useState<Prp[]>([]);
  const [prpsLoaded, setPrpsLoaded] = useState(false);

  // Custom hazard dialog
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState("biological");
  const [customSeverity, setCustomSeverity] = useState("");
  const [customLikelihood, setCustomLikelihood] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [creatingCustom, setCreatingCustom] = useState(false);

  const assignedIds = new Set(assignments.map((a) => a.hazardId));
  const unassigned = hazardLibrary.filter((h) => !assignedIds.has(h.id));

  function ensurePrpsLoaded() {
    if (!prpsLoaded) {
      fetch("/api/prp-registry").then((r) => r.json()).then((data: Prp[]) => { setPrps(data); setPrpsLoaded(true); });
    }
  }

  // ── Hazard assign ──────────────────────────────────────────────────────────

  async function addHazard() {
    if (!selectedHazardId) return;
    setAdding(true);
    const res = await fetch(`/api/plans/${planId}/subgraph-hazard-analysis`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ subgraphStepId, hazardId: selectedHazardId }),
    });
    if (res.ok) {
      const data: SubgraphHazardAssignment = await res.json();
      setAssignments((p) => [...p, data]);
      setDtAnswers((p) => ({ ...p, [data.id]: parseDecisionTree(null) }));
      setSelectedHazardId("");
    }
    setAdding(false);
  }

  async function removeHazard(id: string) {
    if (!confirm("Remove this hazard? Control measures will also be deleted.")) return;
    const res = await fetch(`/api/plans/${planId}/subgraph-hazard-analysis?id=${id}`, { method:"DELETE" });
    if (res.ok) {
      setAssignments((p) => p.filter((a) => a.id !== id));
      setDtAnswers((p) => { const n={...p}; delete n[id]; return n; });
    }
  }

  // ── Custom hazard ──────────────────────────────────────────────────────────

  async function createCustomHazard() {
    if (!customName.trim()) return;
    setCreatingCustom(true);
    const createRes = await fetch("/api/hazards", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ name:customName.trim(), type:customType,
        severity:customSeverity||null, likelihood:customLikelihood||null, description:customDesc.trim()||null }),
    });
    if (!createRes.ok) { setCreatingCustom(false); return; }
    const { id: newId } = await createRes.json();

    // Refresh library
    const allRes = await fetch("/api/hazards");
    if (allRes.ok) setHazardLibrary(await allRes.json());

    // Assign
    const assignRes = await fetch(`/api/plans/${planId}/subgraph-hazard-analysis`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ subgraphStepId, hazardId: newId }),
    });
    if (assignRes.ok) {
      const data: SubgraphHazardAssignment = await assignRes.json();
      setAssignments((p) => [...p, data]);
      setDtAnswers((p) => ({ ...p, [data.id]: parseDecisionTree(null) }));
    }
    setCreatingCustom(false); setShowCustom(false);
    setCustomName(""); setCustomType("biological"); setCustomSeverity(""); setCustomLikelihood(""); setCustomDesc("");
  }

  // ── Update assignment ──────────────────────────────────────────────────────

  async function updateAssignment(id: string, patch: Partial<Pick<SubgraphHazardAssignment,
    "isSignificant"|"justification"|"severityOverride"|"likelihoodOverride"|"severityWithControls"|"likelihoodWithControls"|"decisionTreeAnswers">>) {
    const current = assignments.find((a) => a.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };
    await fetch(`/api/plans/${planId}/subgraph-hazard-analysis`, {
      method:"PUT", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id, isSignificant:merged.isSignificant, justification:merged.justification,
        severityOverride:merged.severityOverride, likelihoodOverride:merged.likelihoodOverride,
        severityWithControls:merged.severityWithControls, likelihoodWithControls:merged.likelihoodWithControls }),
    });
    setAssignments((p) => p.map((a) => a.id===id ? { ...a, ...patch } : a));
  }

  // ── Decision tree ──────────────────────────────────────────────────────────

  async function updateDt(assignmentId: string, question: keyof DecisionTreeAnswers, value: boolean) {
    const current = dtAnswers[assignmentId] || { q1:null, q2:null, q3:null, q4:null, result:null };
    const updated: DecisionTreeAnswers = { ...current, [question]: value };
    if (question==="q1") { updated.q2=null; updated.q3=null; updated.q4=null; }
    if (question==="q2") { updated.q3=null; updated.q4=null; }
    if (question==="q3") { updated.q4=null; }
    updated.result = computeResult(updated);
    setDtAnswers((p) => ({ ...p, [assignmentId]: updated }));
    await fetch(`/api/plans/${planId}/subgraph-hazard-analysis`, {
      method:"PUT", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id:assignmentId, decisionTreeAnswers: updated,
        isSignificant: assignments.find(a=>a.id===assignmentId)?.isSignificant ?? false,
        justification: assignments.find(a=>a.id===assignmentId)?.justification ?? null,
        severityOverride: assignments.find(a=>a.id===assignmentId)?.severityOverride ?? null,
        likelihoodOverride: assignments.find(a=>a.id===assignmentId)?.likelihoodOverride ?? null,
      }),
    });
  }

  // ── Control measures ───────────────────────────────────────────────────────

  async function addControlMeasure(assignmentId: string) {
    const rawText = cmText[assignmentId]?.trim();
    const isPrp = cmType[assignmentId] === "prp";
    const selectedPrp = isPrp ? prps.find((p) => p.id === cmPrpId[assignmentId]) : undefined;
    // Fallback: use PRP name as description if description is empty
    const description = rawText || (selectedPrp ? selectedPrp.programName : "");
    if (!description) return;
    setAddingCm((p) => ({ ...p, [assignmentId]: true }));
    const prpMasterId = isPrp ? (cmPrpId[assignmentId] || null) : null;
    const res = await fetch(`/api/plans/${planId}/subgraph-hazard-analysis`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ action:"add_measure", subgraphHazardId:assignmentId, description, type:cmType[assignmentId]||null, prpMasterId }),
    });
    if (res.ok) {
      const measure: ControlMeasure = await res.json();
      setAssignments((p) => p.map((a) => a.id===assignmentId ? { ...a, controlMeasures:[...a.controlMeasures, measure] } : a));
      setCmText((p) => ({ ...p, [assignmentId]:"" }));
      setCmType((p) => ({ ...p, [assignmentId]:"" }));
      setCmPrpId((p) => ({ ...p, [assignmentId]:"" }));
    }
    setAddingCm((p) => ({ ...p, [assignmentId]: false }));
  }

  async function deleteControlMeasure(assignmentId: string, measureId: string) {
    const res = await fetch(`/api/plans/${planId}/subgraph-hazard-analysis?measureId=${measureId}`, { method:"DELETE" });
    if (res.ok) setAssignments((p) => p.map((a) => a.id===assignmentId
      ? { ...a, controlMeasures: a.controlMeasures.filter((m)=>m.id!==measureId) } : a));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Assign hazard ── */}
      <div className="border rounded-lg p-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-700">Assign Hazard</h2>
          <Button variant="outline" size="sm" onClick={() => setShowCustom(true)}>
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
            </svg>
            Create Custom Hazard
          </Button>
        </div>
        <div className="flex gap-2">
          <Select value={selectedHazardId} onValueChange={(v) => setSelectedHazardId(v ?? "")}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select from hazard library…" />
            </SelectTrigger>
            <SelectContent>
              {unassigned.length === 0
                ? <div className="px-3 py-2 text-sm text-neutral-400">All library hazards assigned</div>
                : unassigned.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    <span className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-1 rounded border ${TYPE_COLORS[h.type] ?? ""}`}>
                        {TYPE_LABELS[h.type] ?? h.type[0].toUpperCase()}
                      </span>
                      {h.name}
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button onClick={addHazard} disabled={adding || !selectedHazardId}>
            {adding ? "Adding…" : "Add"}
          </Button>
        </div>
      </div>

      {/* ── Custom hazard dialog ── */}
      <Dialog open={showCustom} onOpenChange={setShowCustom}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Custom Hazard</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Hazard Name *</label>
              <Input placeholder="e.g., Chlorine residual from wash water" value={customName} onChange={(e)=>setCustomName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Type *</label>
              <Select value={customType} onValueChange={(v)=>v&&setCustomType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HAZARD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      <span className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-1 rounded border ${TYPE_COLORS[t]}`}>{TYPE_LABELS[t]}</span>
                        {TYPE_FULL[t]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1">Default Severity</label>
                <Select value={customSeverity} onValueChange={(v)=>setCustomSeverity(v??"")}>
                  <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Not set</SelectItem>
                    {SEVERITY_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.value} — {l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1">Default Likelihood</label>
                <Select value={customLikelihood} onValueChange={(v)=>setCustomLikelihood(v??"")}>
                  <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Not set</SelectItem>
                    {LIKELIHOOD_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.value} — {l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Description</label>
              <Textarea placeholder="Optional: describe the hazard nature or source…" value={customDesc} onChange={(e)=>setCustomDesc(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={()=>setShowCustom(false)}>Cancel</Button>
              <Button onClick={createCustomHazard} disabled={creatingCustom||!customName.trim()}>
                {creatingCustom ? "Creating…" : "Create & Assign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Assigned hazards ── */}
      {assignments.length === 0 ? (
        <p className="text-sm text-neutral-400 italic">
          No hazards assigned yet. Select from the library or create a custom hazard.
        </p>
      ) : (
        <div className="space-y-6">
          {assignments.map((a) => {
            const effectiveSev = a.severityOverride ?? migrateOldLevel(a.hazard.severity);
            const effectiveLik = a.likelihoodOverride ?? migrateOldLevel(a.hazard.likelihood);
            const risk = computeRiskScore(effectiveSev, effectiveLik);
            const autoSig = risk.score >= 8;
            const dt = dtAnswers[a.id] || { q1:null, q2:null, q3:null, q4:null, result:null };
            const significant = autoSig || a.isSignificant;
            const visible = visibleQuestions(dt);

            return (
              <div key={a.id} className="border rounded-lg bg-white overflow-hidden shadow-sm">

                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-neutral-50 border-b">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded font-bold text-xs border shrink-0 ${TYPE_COLORS[a.hazard.type] ?? ""}`}
                    title={TYPE_FULL[a.hazard.type] ?? a.hazard.type}>
                    {TYPE_LABELS[a.hazard.type] ?? a.hazard.type[0].toUpperCase()}
                  </span>
                  <span className="font-semibold text-sm text-neutral-900 flex-1">{a.hazard.name}</span>
                  {risk.score > 0 && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${RISK_COLORS[risk.category]}`}>
                      {risk.label} ({risk.score})
                    </span>
                  )}
                  {dt.result && DT_RESULT_CONFIG[dt.result] && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${DT_RESULT_CONFIG[dt.result].classes}`}>
                      {DT_RESULT_CONFIG[dt.result].label}
                    </span>
                  )}
                  {(autoSig || a.isSignificant) && (
                    <Badge variant="destructive" className="text-xs shrink-0">Significant</Badge>
                  )}
                  <button onClick={()=>removeHazard(a.id)} className="text-neutral-400 hover:text-red-500 shrink-0" title="Remove">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div className="px-4 py-4 space-y-4">

                  {/* Risk assessment */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Risk Without Controls</p>
                    <div className="grid grid-cols-3 gap-3 items-end">
                      <div>
                        <label className="text-xs font-medium text-neutral-600 block mb-1">
                          Severity {a.hazard.severity && <span className="text-neutral-400 font-normal">(default: {migrateOldLevel(a.hazard.severity) ?? a.hazard.severity})</span>}
                        </label>
                        <Select value={a.severityOverride ?? migrateOldLevel(a.hazard.severity) ?? ""}
                          onValueChange={(v)=>updateAssignment(a.id,{severityOverride:v||null})}>
                          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            {SEVERITY_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.value} — {l.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-600 block mb-1">
                          Likelihood {a.hazard.likelihood && <span className="text-neutral-400 font-normal">(default: {migrateOldLevel(a.hazard.likelihood) ?? a.hazard.likelihood})</span>}
                        </label>
                        <Select value={a.likelihoodOverride ?? migrateOldLevel(a.hazard.likelihood) ?? ""}
                          onValueChange={(v)=>updateAssignment(a.id,{likelihoodOverride:v||null})}>
                          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            {LIKELIHOOD_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.value} — {l.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-600 block mb-1">Risk Score</label>
                        <div className={`h-10 flex items-center justify-center rounded-md border text-sm font-semibold ${risk.score>0 ? RISK_COLORS[risk.category] : "bg-neutral-50 text-neutral-400 border-neutral-200"}`}>
                          {risk.score > 0 ? `${risk.score} — ${risk.label}` : "Not assessed"}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide pt-1">Risk With Controls</p>
                    <div className="grid grid-cols-3 gap-3 items-end">
                      <div>
                        <label className="text-xs font-medium text-neutral-600 block mb-1">Severity (w/ controls)</label>
                        <Select value={a.severityWithControls ?? ""}
                          onValueChange={(v)=>updateAssignment(a.id,{severityWithControls:v??null})}>
                          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            {SEVERITY_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.value} — {l.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-neutral-600 block mb-1">Likelihood (w/ controls)</label>
                        <Select value={a.likelihoodWithControls ?? ""}
                          onValueChange={(v)=>updateAssignment(a.id,{likelihoodWithControls:v??null})}>
                          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            {LIKELIHOOD_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.value} — {l.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        {(() => {
                          const rwc = computeRiskScore(a.severityWithControls ?? null, a.likelihoodWithControls ?? null);
                          return (
                            <>
                              <label className="text-xs font-medium text-neutral-600 block mb-1">Risk Score (w/ controls)</label>
                              <div className={`h-10 flex items-center justify-center rounded-md border text-sm font-semibold ${rwc.score>0 ? RISK_COLORS[rwc.category] : "bg-neutral-50 text-neutral-400 border-neutral-200"}`}>
                                {rwc.score > 0 ? `${rwc.score} — ${rwc.label}` : "Not assessed"}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Significance */}
                  <div className="flex items-center gap-3 py-2 px-3 rounded-md bg-neutral-50 border">
                    {autoSig ? (
                      <p className="text-sm text-red-700 font-medium">⚠ Automatically significant — risk score ≥ 8.</p>
                    ) : (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={a.isSignificant}
                          onChange={(e)=>updateAssignment(a.id,{isSignificant:e.target.checked})}
                          className="w-4 h-4 rounded border-neutral-300 accent-red-600" />
                        <span className="text-sm font-medium text-neutral-700">
                          Mark as significant <span className="text-xs text-neutral-400 font-normal">(borderline — professional judgment)</span>
                        </span>
                      </label>
                    )}
                  </div>

                  {/* Justification */}
                  <div>
                    <label className="text-xs font-medium text-neutral-600 block mb-1">Justification / Notes</label>
                    <Textarea placeholder="Explain why this hazard is or is not significant…"
                      value={a.justification ?? ""}
                      onChange={(e)=>updateAssignment(a.id,{justification:e.target.value||null})} rows={2} />
                  </div>

                  {/* ── CCP Decision Tree (significant hazards only) ── */}
                  {significant && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide">CCP Decision Tree</p>
                          <p className="text-[10px] text-slate-300 mt-0.5">Codex Alimentarius CXC 1-1969 Rev. 2020</p>
                        </div>
                        {dt.result && DT_RESULT_CONFIG[dt.result] && (
                          <span className={`text-xs font-bold px-2 py-1 rounded ${DT_RESULT_CONFIG[dt.result].classes}`}>
                            {DT_RESULT_CONFIG[dt.result].label}
                          </span>
                        )}
                      </div>
                      <div className="p-4 space-y-3 bg-slate-50">
                        {DT_QUESTIONS.map((q) => {
                          if (!visible.includes(q.key)) return null;
                          const answer = dt[q.key as keyof DecisionTreeAnswers];
                          return (
                            <div key={q.key} className="border rounded-md overflow-hidden bg-white">
                              <p className="text-xs font-medium text-neutral-700 px-3 py-2 border-b bg-neutral-50">{q.text}</p>
                              <div className="flex gap-2 px-3 py-2">
                                {[true, false].map((val) => (
                                  <button
                                    key={String(val)}
                                    onClick={() => updateDt(a.id, q.key as keyof DecisionTreeAnswers, val)}
                                    className={`px-4 py-1.5 rounded text-sm font-medium border transition-colors ${
                                      answer === val
                                        ? val ? "bg-green-600 text-white border-green-600" : "bg-red-600 text-white border-red-600"
                                        : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50"
                                    }`}
                                  >
                                    {val ? "Yes" : "No"}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        {dt.result === "modify" && (
                          <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-3 py-2">
                            ⚠ Process modification required — implement control measures before proceeding.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Control Measures ── */}
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-700 mb-2 uppercase tracking-wide">Control Measures</h3>
                    {a.controlMeasures.length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        {a.controlMeasures.map((m) => (
                          <div key={m.id} className="flex items-start gap-2 p-2.5 bg-neutral-50 rounded-md border group/measure">
                            {m.type && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium shrink-0 capitalize mt-0.5">
                                {m.type === "prp" ? "PRP" : m.type}
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-neutral-700">{m.description}</span>
                              {m.prpName && (
                                <p className="text-xs text-teal-700 mt-0.5">
                                  {m.prpFsepCode && <span className="font-semibold mr-1">{m.prpFsepCode}</span>}
                                  {m.prpName}
                                </p>
                              )}
                            </div>
                            <button onClick={()=>deleteControlMeasure(a.id,m.id)}
                              className="text-neutral-300 hover:text-red-500 opacity-0 group-hover/measure:opacity-100 transition-all shrink-0">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2 border border-dashed border-neutral-300 rounded-md p-3 bg-neutral-50/50">
                      <div className="flex gap-2">
                        <Input placeholder="Describe control measure…" className="flex-1"
                          value={cmText[a.id]??""} onChange={(e)=>setCmText((p)=>({...p,[a.id]:e.target.value}))}
                          onKeyDown={(e)=>{ if(e.key==="Enter"&&cmType[a.id]!=="prp") addControlMeasure(a.id); }} />
                        <Select value={cmType[a.id]??""} onValueChange={(v)=>{ setCmType((p)=>({...p,[a.id]:v??""})); if(v==="prp") ensurePrpsLoaded(); }}>
                          <SelectTrigger className="w-36"><SelectValue placeholder="Type…" /></SelectTrigger>
                          <SelectContent>
                            {CM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={()=>addControlMeasure(a.id)} disabled={addingCm[a.id] || (
                          !cmText[a.id]?.trim() && !(cmType[a.id]==="prp" && cmPrpId[a.id])
                        )}>
                          Add
                        </Button>
                      </div>

                      {/* PRP picker */}
                      {cmType[a.id] === "prp" && (
                        <div>
                          <label className="text-xs font-medium text-neutral-600 block mb-1">
                            Link to PRP Registry <span className="text-neutral-400 font-normal">(optional — or type a description above)</span>
                          </label>
                          <Select value={cmPrpId[a.id]??""} onValueChange={(v)=>{
                            setCmPrpId((p)=>({...p,[a.id]:v??""}));
                            // Auto-fill description with PRP name if description is empty
                            if (v && !cmText[a.id]?.trim()) {
                              const prp = prps.find((p)=>p.id===v);
                              if (prp) setCmText((prev)=>({...prev,[a.id]:prp.programName}));
                            }
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a PRP from registry…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">No specific PRP</SelectItem>
                              {prps.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <span className="flex items-center gap-2">
                                    {p.fsepCode && <span className="text-xs font-bold text-teal-700 bg-teal-50 px-1 rounded">{p.fsepCode}</span>}
                                    <span className="truncate">{p.programName}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
