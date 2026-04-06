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
import type { StepHazardAssignment, ControlMeasure } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  preventive: "Preventive",
  eliminative: "Eliminative",
  reductive: "Reductive",
  prp: "PRP",
  external: "External (Form 9)",
};

interface Props {
  planId: string;
  assignments: StepHazardAssignment[];
  onUpdate: (assignments: StepHazardAssignment[]) => void;
}

export function ControlMeasuresSection({
  planId,
  assignments,
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

    const existingMeasures = assignment.controlMeasures || [];
    const allMeasures = [
      ...existingMeasures.map((cm) => ({ description: cm.description, type: cm.type || "preventive" })),
      { description: description.trim(), type },
    ];

    const res = await fetch(`/api/plans/${planId}/hazard-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: shId,
        controlMeasureUpdates: allMeasures,
      }),
    });

    if (res.ok) {
      // Optimistically update — add the new measure to local state
      const newCm: ControlMeasure = {
        id: `temp-${Date.now()}`,
        stepHazardId: shId,
        description: description.trim(),
        type,
        createdAt: new Date().toISOString(),
      };
      onUpdate(
        assignments.map((a) =>
          a.id === shId
            ? { ...a, controlMeasures: [...a.controlMeasures, newCm] }
            : a,
        ),
      );
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
        controlMeasureUpdates: remaining.map((cm) => ({
          description: cm.description,
          type: cm.type || "preventive",
        })),
      }),
    });

    if (res.ok) {
      onUpdate(
        assignments.map((a) =>
          a.id === shId ? { ...a, controlMeasures: remaining } : a,
        ),
      );
    }
  }

  const significantAssignments = assignments.filter((a) => a.isSignificant);
  const nonSignificantAssignments = assignments.filter((a) => !a.isSignificant);
  const orderedAssignments = [...significantAssignments, ...nonSignificantAssignments];

  if (assignments.length === 0) {
    return (
      <p className="text-sm text-neutral-500 italic">
        No hazards assigned. Add hazards in Section 1 above.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {orderedAssignments.map((a) => (
        <div key={a.id} className="border rounded-lg overflow-hidden">
          {/* Hazard header */}
          <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 border-b">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{a.hazard.name}</span>
              {a.isSignificant && (
                <Badge variant="destructive" className="text-xs">
                  Significant
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() =>
                setNewMeasure({ shId: a.id, description: "", type: "preventive" })
              }
            >
              + Add Control Measure
            </Button>
          </div>

          {/* Control measures list */}
          {a.controlMeasures.length === 0 && newMeasure?.shId !== a.id ? (
            <div className="px-3 py-3 text-sm text-neutral-400 italic">
              No control measures defined
            </div>
          ) : (
            <div>
              {a.controlMeasures.map((cm) => (
                <div
                  key={cm.id}
                  className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 group"
                >
                  <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded w-24 text-center shrink-0">
                    {TYPE_LABELS[cm.type || ""] || cm.type || "Preventive"}
                  </span>
                  <span className="text-sm flex-1">{cm.description}</span>
                  <button
                    onClick={() => {
                      if (confirm("Remove this control measure?")) {
                        removeMeasure(a.id, cm.id);
                      }
                    }}
                    className="text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Remove control measure"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Inline add form */}
          {newMeasure?.shId === a.id && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/50 border-t">
              <Select
                value={newMeasure.type}
                onValueChange={(v) =>
                  setNewMeasure((prev) =>
                    prev ? { ...prev, type: v || prev.type } : prev,
                  )
                }
              >
                <SelectTrigger className="h-8 text-xs w-32 shrink-0">
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
                placeholder="Describe the control measure..."
                value={newMeasure.description}
                onChange={(e) =>
                  setNewMeasure((prev) =>
                    prev ? { ...prev, description: e.target.value } : prev,
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addMeasure(newMeasure.shId, newMeasure.description, newMeasure.type);
                  }
                  if (e.key === "Escape") {
                    setNewMeasure(null);
                  }
                }}
                className="text-sm flex-1"
                autoFocus
                disabled={saving}
              />
              <Button
                size="sm"
                onClick={() =>
                  addMeasure(newMeasure.shId, newMeasure.description, newMeasure.type)
                }
                disabled={saving || !newMeasure.description.trim()}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setNewMeasure(null)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
