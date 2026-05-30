"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HazardPrpPicker } from "@/components/prp-registry/HazardPrpPicker";
import { parseDecisionTree } from "@/lib/logic/decision-tree";
import type {
  StepHazardAssignment,
  ControlMeasure,
  CcpData,
  PrpMaster,
  HazardPrp,
} from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const CM_TYPE_LABELS: Record<string, string> = {
  preventive:  "Preventive",
  eliminative: "Eliminative",
  reductive:   "Reductive",
  prp:         "PRP",
  external:    "External (Form 9)",
};

const RESULT_CONFIG: Record<string, { label: string; badgeClass: string; isCcp: boolean }> = {
  ccp:     { label: "CCP",            badgeClass: "bg-red-100 text-red-700 border-red-200",           isCcp: true  },
  not_ccp: { label: "Not CCP",        badgeClass: "bg-neutral-100 text-neutral-600 border-neutral-200", isCcp: false },
  prp:     { label: "GHP / PRP",      badgeClass: "bg-green-100 text-green-700 border-green-200",      isCcp: false },
  modify:  { label: "Modify Process", badgeClass: "bg-orange-100 text-orange-700 border-orange-200",   isCcp: false },
};

// ── CCP Controls summary ──────────────────────────────────────────────────────

function CcpControlsSummary({ ccpData, ccpNumber }: { ccpData: CcpData | null; ccpNumber: string | null }) {
  const firstLimit    = ccpData?.criticalLimits?.[0] ?? null;
  const firstMon      = ccpData?.monitoringProcedures?.[0] ?? null;
  const firstCa       = ccpData?.correctiveActions?.[0] ?? null;
  const extraLimits   = (ccpData?.criticalLimits?.length ?? 0) - 1;

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/40 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-red-100/60 border-b border-red-200 flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span className="text-xs font-semibold text-red-800">
          CCP Controls{ccpNumber ? ` — ${ccpNumber}` : ""}
        </span>
        <span className="ml-auto text-[10px] text-red-600 italic">
          Forms 10–11 · managed in CCP Details section ↓
        </span>
      </div>

      {/* Field grid */}
      <div className="p-3 grid grid-cols-2 gap-x-6 gap-y-3">
        {/* Critical Limit */}
        <div>
          <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-1">Critical Limit</p>
          {firstLimit ? (
            <div>
              <p className="text-xs text-neutral-800">
                {firstLimit.parameter}
                {firstLimit.minimum  ? ` ≥ ${firstLimit.minimum}` : ""}
                {firstLimit.maximum  ? ` ≤ ${firstLimit.maximum}` : ""}
                {firstLimit.target   ? ` (target: ${firstLimit.target})` : ""}
                {firstLimit.unit     ? ` ${firstLimit.unit}` : ""}
              </p>
              {firstLimit.scientificBasis && (
                <p className="text-[10px] text-neutral-500 mt-0.5 italic">{firstLimit.scientificBasis}</p>
              )}
              {extraLimits > 0 && (
                <p className="text-[10px] text-neutral-400 mt-0.5">+{extraLimits} more limit{extraLimits > 1 ? "s" : ""}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-neutral-400 italic">Not yet defined — complete CCP Details ↓</p>
          )}
        </div>

        {/* Monitoring Procedure */}
        <div>
          <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-1">Monitoring Procedure</p>
          {firstMon ? (
            <div>
              <p className="text-xs text-neutral-800">{firstMon.what}</p>
              <p className="text-[10px] text-neutral-500 mt-0.5">
                How: {firstMon.how}
              </p>
            </div>
          ) : (
            <p className="text-xs text-neutral-400 italic">Not yet defined</p>
          )}
        </div>

        {/* Monitoring Frequency */}
        <div>
          <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-1">Monitoring Frequency</p>
          {firstMon?.frequency ? (
            <p className="text-xs text-neutral-800">{firstMon.frequency}</p>
          ) : (
            <p className="text-xs text-neutral-400 italic">Not yet defined</p>
          )}
        </div>

        {/* Responsible Party */}
        <div>
          <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-1">Responsible Party</p>
          {firstMon?.who ? (
            <p className="text-xs text-neutral-800">{firstMon.who}</p>
          ) : firstCa?.responsiblePerson ? (
            <p className="text-xs text-neutral-800">{firstCa.responsiblePerson}</p>
          ) : (
            <p className="text-xs text-neutral-400 italic">Not yet defined</p>
          )}
        </div>

        {/* Corrective Action */}
        <div className="col-span-2">
          <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-1">Corrective Action</p>
          {firstCa?.immediateAction ? (
            <p className="text-xs text-neutral-800 line-clamp-3">{firstCa.immediateAction}</p>
          ) : (
            <p className="text-xs text-neutral-400 italic">Not yet defined — complete CCP Details ↓</p>
          )}
        </div>
      </div>

      {/* Hazard description */}
      {ccpData?.hazardDescription && (
        <div className="px-3 pb-3 border-t border-red-100 pt-2">
          <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-1">Hazard(s) Controlled</p>
          <p className="text-xs text-neutral-700">{ccpData.hazardDescription}</p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  planId: string;
  assignments: StepHazardAssignment[];
  ccpData: CcpData | null;
  ccpNumber: string | null;
  allPrps: PrpMaster[];
  prpLinksByHazard: Record<string, HazardPrp[]>;
  onUpdate: (assignments: StepHazardAssignment[]) => void;
}

export function ControlMeasuresSection({
  planId,
  assignments,
  ccpData,
  ccpNumber,
  allPrps,
  prpLinksByHazard,
  onUpdate,
}: Props) {
  const [newMeasure, setNewMeasure] = useState<{
    shId: string;
    description: string;
    type: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  async function addMeasure(shId: string, description: string, type: string) {
    if (!description.trim()) return;
    setSaving(true);
    const assignment = assignments.find((a) => a.id === shId);
    if (!assignment) { setSaving(false); return; }

    const existing = assignment.controlMeasures || [];
    const allMeasures = [
      ...existing.map((cm) => ({ description: cm.description, type: cm.type || "preventive" })),
      { description: description.trim(), type },
    ];

    const res = await fetch(`/api/plans/${planId}/hazard-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: shId, controlMeasureUpdates: allMeasures }),
    });

    if (res.ok) {
      const newCm: ControlMeasure = {
        id: `temp-${Date.now()}`,
        stepHazardId: shId,
        description: description.trim(),
        type,
        createdAt: new Date().toISOString(),
      };
      onUpdate(assignments.map((a) =>
        a.id === shId ? { ...a, controlMeasures: [...a.controlMeasures, newCm] } : a,
      ));
    }
    setNewMeasure(null);
    setSaving(false);
  }

  async function removeMeasure(shId: string, cmId: string) {
    const assignment = assignments.find((a) => a.id === shId);
    if (!assignment) return;
    const remaining = assignment.controlMeasures.filter((cm) => cm.id !== cmId);
    const res = await fetch(`/api/plans/${planId}/hazard-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: shId,
        controlMeasureUpdates: remaining.map((cm) => ({ description: cm.description, type: cm.type || "preventive" })),
      }),
    });
    if (res.ok) {
      onUpdate(assignments.map((a) => a.id === shId ? { ...a, controlMeasures: remaining } : a));
    }
  }

  if (assignments.length === 0) {
    return (
      <p className="text-sm text-neutral-400 italic">
        No hazards assigned. Add hazards in Section 1 to define control measures.
      </p>
    );
  }

  // Sort: CCP hazards first, then significant, then others
  const sorted = [...assignments].sort((a, b) => {
    const ra = parseDecisionTree(a.decisionTreeAnswers).result;
    const rb = parseDecisionTree(b.decisionTreeAnswers).result;
    if (ra === "ccp" && rb !== "ccp") return -1;
    if (ra !== "ccp" && rb === "ccp") return 1;
    if (a.isSignificant && !b.isSignificant) return -1;
    if (!a.isSignificant && b.isSignificant) return 1;
    return 0;
  });

  return (
    <div className="space-y-4">
      {sorted.map((a) => {
        const dt = parseDecisionTree(a.decisionTreeAnswers);
        const result = dt.result;
        const cfg = result ? RESULT_CONFIG[result] : null;
        const isCcpHazard = result === "ccp";
        const cms = a.controlMeasures || [];

        return (
          <div
            key={a.id}
            className={`rounded-xl border overflow-hidden ${
              isCcpHazard ? "border-red-200" : "border-neutral-200"
            }`}
          >
            {/* ── Hazard header ── */}
            <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${
              isCcpHazard
                ? "bg-red-50 border-red-200"
                : "bg-neutral-50 border-neutral-200"
            }`}>
              <span className="text-sm font-semibold text-neutral-900 flex-1">{a.hazard.name}</span>
              {a.isSignificant && (
                <Badge variant="destructive" className="text-xs shrink-0">Significant</Badge>
              )}
              {cfg ? (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border shrink-0 ${cfg.badgeClass}`}>
                  {cfg.label}
                </span>
              ) : a.isSignificant ? (
                <span className="text-[11px] text-neutral-400 italic shrink-0">Decision tree not complete</span>
              ) : null}
            </div>

            <div className="p-4 space-y-4">

              {/* ─── CCP Controls ─── */}
              {isCcpHazard && (
                <CcpControlsSummary ccpData={ccpData} ccpNumber={ccpNumber} />
              )}

              {/* ─── PRP Controls (non-CCP hazards) ─── */}
              {!isCcpHazard && (
                <div className="rounded-lg border border-neutral-200 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-semibold text-neutral-700">PRP Controls</p>
                    {result === "prp" && (
                      <span className="text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200 font-medium">
                        Controlled by GHPs / PRPs
                      </span>
                    )}
                    {result === "modify" && (
                      <span className="text-[10px] text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200 font-medium">
                        ⚠ Process modification required — apply PRPs as interim control
                      </span>
                    )}
                  </div>
                  <HazardPrpPicker
                    hazardId={a.hazardId}
                    hazardName={a.hazard.name}
                    allPrps={allPrps}
                    initialLinks={prpLinksByHazard[a.hazardId] ?? []}
                  />
                  {allPrps.length === 0 && (
                    <p className="text-xs text-neutral-400 mt-2">
                      No PRPs in registry.{" "}
                      <a href="/prp-registry" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        Add PRPs →
                      </a>
                    </p>
                  )}
                </div>
              )}

              {/* ─── Supplementary / Additional Control Measures ─── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-neutral-700">
                    {isCcpHazard ? "Supplementary Control Measures" : "Additional Control Measures"}
                  </p>
                  {newMeasure?.shId !== a.id && (
                    <button
                      onClick={() => setNewMeasure({ shId: a.id, description: "", type: "preventive" })}
                      className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center gap-0.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                      </svg>
                      Add
                    </button>
                  )}
                </div>

                {cms.length === 0 && newMeasure?.shId !== a.id ? (
                  <p className="text-xs text-neutral-400 italic">None defined.</p>
                ) : (
                  <div className="space-y-1.5">
                    {cms.map((cm) => (
                      <div key={cm.id} className="flex items-center gap-2 group">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 shrink-0 whitespace-nowrap">
                          {CM_TYPE_LABELS[cm.type || ""] || cm.type || "Preventive"}
                        </span>
                        <span className="text-xs text-neutral-700 flex-1">{cm.description}</span>
                        <button
                          onClick={() => { if (confirm("Remove this control measure?")) removeMeasure(a.id, cm.id); }}
                          className="text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline add form */}
                {newMeasure?.shId === a.id && (
                  <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-blue-50/50 border border-blue-100">
                    <Select
                      value={newMeasure.type}
                      onValueChange={(v) => v && setNewMeasure((p) => p ? { ...p, type: v } : p)}
                    >
                      <SelectTrigger className="h-7 text-xs w-32 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preventive">Preventive</SelectItem>
                        <SelectItem value="eliminative">Eliminative</SelectItem>
                        <SelectItem value="reductive">Reductive</SelectItem>
                        <SelectItem value="prp">PRP</SelectItem>
                        <SelectItem value="external">External (Form 9)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Describe the control measure…"
                      value={newMeasure.description}
                      onChange={(e) => setNewMeasure((p) => p ? { ...p, description: e.target.value } : p)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addMeasure(newMeasure.shId, newMeasure.description, newMeasure.type);
                        if (e.key === "Escape") setNewMeasure(null);
                      }}
                      className="text-xs flex-1 h-7"
                      autoFocus
                      disabled={saving}
                    />
                    <Button size="sm" className="h-7 text-xs"
                      onClick={() => addMeasure(newMeasure.shId, newMeasure.description, newMeasure.type)}
                      disabled={saving || !newMeasure.description.trim()}
                    >
                      {saving ? "…" : "Save"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setNewMeasure(null)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
