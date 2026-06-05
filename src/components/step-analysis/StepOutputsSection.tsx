"use client";

import { useState } from "react";
import Link from "next/link";
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
import type { StepOutput, OutputType } from "@/lib/types";

const OUTPUT_TYPE_OPTIONS: { value: OutputType; label: string }[] = [
  { value: "primary_product", label: "Primary Product" },
  { value: "waste", label: "Waste" },
  { value: "rejected_product", label: "Rejected Product" },
  { value: "water_discharge", label: "Water Discharge" },
  { value: "other", label: "Other" },
];

const OUTPUT_TYPE_COLORS: Record<OutputType, string> = {
  primary_product: "bg-green-100 text-green-700",
  waste: "bg-neutral-100 text-neutral-600",
  rejected_product: "bg-red-100 text-red-700",
  water_discharge: "bg-blue-100 text-blue-700",
  other: "bg-purple-100 text-purple-700",
};

interface Props {
  planId: string;
  stepId: string;
  outputs: StepOutput[];
}

export function StepOutputsSection({ planId, stepId, outputs: initialOutputs }: Props) {
  const [outputs, setOutputs] = useState(initialOutputs);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<OutputType>("primary_product");
  const [newDescription, setNewDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editTarget, setEditTarget] = useState<StepOutput | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<OutputType>("primary_product");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function openEdit(output: StepOutput) {
    setEditTarget(output);
    setEditName(output.name);
    setEditType((output.outputType as OutputType) || "primary_product");
    setEditDescription(output.description ?? "");
  }

  async function saveEdit() {
    if (!editTarget || !editName.trim()) return;
    setEditSaving(true);

    const res = await fetch(`/api/plans/${planId}/step-outputs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editTarget.id,
        name: editName.trim(),
        outputType: editType,
        description: editDescription.trim() || null,
      }),
    });

    if (res.ok) {
      const updated: StepOutput = await res.json();
      setOutputs((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setEditTarget(null);
    }

    setEditSaving(false);
  }

  async function addOutput() {
    if (!newName.trim()) return;
    setSaving(true);

    const res = await fetch(`/api/plans/${planId}/step-outputs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stepId,
        name: newName.trim(),
        outputType: newType,
        description: newDescription.trim() || null,
      }),
    });

    if (res.ok) {
      const data: StepOutput = await res.json();
      setOutputs((prev) => [...prev, data]);
      setAddOpen(false);
      setNewName("");
      setNewType("primary_product");
      setNewDescription("");
    }

    setSaving(false);
  }

  async function deleteOutput(id: string, name: string) {
    if (!confirm(`Delete output "${name}"? This will also remove all its hazard analysis data.`)) return;

    const res = await fetch(`/api/plans/${planId}/step-outputs?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setOutputs((prev) => prev.filter((o) => o.id !== id));
    }
  }

  return (
    <div>
      {outputs.length === 0 ? (
        <p className="text-sm text-neutral-400 italic mb-4">
          No outputs defined for this step. Add outputs to model what leaves this step and analyze associated hazards independently.
        </p>
      ) : (
        <div className="space-y-2 mb-4">
          {outputs.map((output) => (
            <div key={output.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-neutral-50 group">
              <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${OUTPUT_TYPE_COLORS[output.outputType as OutputType] || "bg-neutral-100 text-neutral-600"}`}>
                {OUTPUT_TYPE_OPTIONS.find((o) => o.value === output.outputType)?.label || output.outputType}
              </span>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/plans/${planId}/steps/${stepId}/outputs/${output.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {output.name}
                </Link>
                {output.description && (
                  <p className="text-xs text-neutral-500 truncate">{output.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {output.isCcp && (
                  <Badge variant="destructive" className="text-xs">
                    {output.ccpNumber || "CCP"}
                  </Badge>
                )}
                <Link
                  href={`/plans/${planId}/steps/${stepId}/outputs/${output.id}`}
                  className="text-xs text-neutral-400 hover:text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Analyze →
                </Link>
                <button
                  onClick={() => openEdit(output)}
                  className="text-neutral-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit output"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => deleteOutput(output.id, output.name)}
                  className="text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete output"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Output Dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Output</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Output Name *</label>
              <Input
                placeholder="e.g., Pasteurized Milk, Packaging Waste"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Output Type *</label>
              <Select value={editType} onValueChange={(v) => setEditType(v as OutputType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTPUT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Description</label>
              <Textarea
                placeholder="Optional description of this output..."
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button onClick={saveEdit} disabled={editSaving || !editName.trim()}>
                {editSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          + Add Output
        </Button>

        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Step Output</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Output Name *</label>
              <Input
                placeholder="e.g., Pasteurized Milk, Packaging Waste"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addOutput(); }}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Output Type *</label>
              <Select value={newType} onValueChange={(v) => setNewType(v as OutputType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTPUT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Description</label>
              <Textarea
                placeholder="Optional description of this output..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={addOutput} disabled={saving || !newName.trim()}>
                {saving ? "Adding..." : "Add Output"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
