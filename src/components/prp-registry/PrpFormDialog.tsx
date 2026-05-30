"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PrpMaster, PrpType, DocumentSource } from "@/lib/types";

const PRP_TYPE_OPTIONS: { value: PrpType; label: string }[] = [
  { value: "SSOP",                     label: "SSOP — Sanitation Standard Operating Procedure" },
  { value: "GMP",                      label: "GMP — Good Manufacturing Practice" },
  { value: "SOP",                      label: "SOP — Standard Operating Procedure" },
  { value: "pest_control",             label: "Pest Control" },
  { value: "allergen_control",         label: "Allergen Control" },
  { value: "environmental_monitoring", label: "Environmental Monitoring" },
  { value: "other",                    label: "Other" },
];

const DOCUMENT_SOURCE_OPTIONS: { value: DocumentSource; label: string }[] = [
  { value: "internal_upload", label: "Internal Upload" },
  { value: "google_drive",    label: "Google Drive" },
  { value: "sharepoint",      label: "SharePoint" },
  { value: "other",           label: "Other" },
];

interface FormState {
  programName: string;
  prpType: string;
  description: string;
  documentReference: string;
  documentUrl: string;
  documentSource: string;
  owner: string;
  reviewFrequency: string;
  lastReviewDate: string;
  nextReviewDate: string;
}

function initForm(prp?: PrpMaster): FormState {
  return {
    programName:       prp?.programName       ?? "",
    prpType:           prp?.prpType           ?? "SSOP",
    description:       prp?.description       ?? "",
    documentReference: prp?.documentReference ?? "",
    documentUrl:       prp?.documentUrl       ?? "",
    documentSource:    prp?.documentSource    ?? "",
    owner:             prp?.owner             ?? "",
    reviewFrequency:   prp?.reviewFrequency   ?? "",
    lastReviewDate:    prp?.lastReviewDate     ?? "",
    nextReviewDate:    prp?.nextReviewDate     ?? "",
  };
}

interface Props {
  open: boolean;
  prp?: PrpMaster;
  onClose: () => void;
  onSaved: (saved: PrpMaster) => void;
}

export function PrpFormDialog({ open, prp, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => initForm(prp));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  async function save() {
    if (!form.programName.trim()) {
      setError("Program name is required.");
      return;
    }
    setSaving(true);

    const payload = {
      ...form,
      programName:       form.programName.trim(),
      description:       form.description.trim()       || null,
      documentReference: form.documentReference.trim() || null,
      documentUrl:       form.documentUrl.trim()       || null,
      documentSource:    form.documentSource            || null,
      owner:             form.owner.trim()              || null,
      reviewFrequency:   form.reviewFrequency.trim()   || null,
      lastReviewDate:    form.lastReviewDate            || null,
      nextReviewDate:    form.nextReviewDate            || null,
    };

    const res = await fetch("/api/prp-registry", {
      method: prp ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prp ? { id: prp.id, ...payload } : payload),
    });

    setSaving(false);

    if (res.ok) {
      const saved: PrpMaster = await res.json();
      onSaved(saved);
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "Failed to save. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{prp ? "Edit PRP" : "Add Prerequisite Program"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Core info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-xs">Program Name *</Label>
              <Input
                value={form.programName}
                onChange={(e) => set("programName", e.target.value)}
                placeholder="e.g. Sanitation SOP-012"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs">PRP Type *</Label>
              <Select value={form.prpType} onValueChange={(v) => v && set("prpType", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRP_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Document Reference</Label>
              <Input
                value={form.documentReference}
                onChange={(e) => set("documentReference", e.target.value)}
                placeholder="e.g. SOP-012"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What does this program control and how?"
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Document info */}
          <div className="rounded-lg border border-neutral-200 p-4 space-y-4">
            <p className="text-xs font-semibold text-neutral-700">Document Link</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-xs">Document URL</Label>
                <Input
                  type="url"
                  value={form.documentUrl}
                  onChange={(e) => set("documentUrl", e.target.value)}
                  placeholder="https://drive.google.com/… or SharePoint link"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Document Source</Label>
                <Select
                  value={form.documentSource || ""}
                  onValueChange={(v) => v && set("documentSource", v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select source…" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Ownership & review */}
          <div className="rounded-lg border border-neutral-200 p-4 space-y-4">
            <p className="text-xs font-semibold text-neutral-700">Ownership & Review</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Responsible Owner</Label>
                <Input
                  value={form.owner}
                  onChange={(e) => set("owner", e.target.value)}
                  placeholder="e.g. QA Manager"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Review Frequency</Label>
                <Input
                  value={form.reviewFrequency}
                  onChange={(e) => set("reviewFrequency", e.target.value)}
                  placeholder="e.g. Annually, Quarterly"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Last Review Date</Label>
                <Input
                  type="date"
                  value={form.lastReviewDate}
                  onChange={(e) => set("lastReviewDate", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Next Review Date</Label>
                <Input
                  type="date"
                  value={form.nextReviewDate}
                  onChange={(e) => set("nextReviewDate", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : prp ? "Save Changes" : "Add PRP"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
