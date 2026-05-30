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
import { FSEP_CATEGORIES } from "./PrpRegistryClient";
import type { PrpMaster, DocumentSource } from "@/lib/types";

// ── FSEP element options per category ────────────────────────────────────────
// Used to populate the element code dropdown based on selected category

const FSEP_ELEMENTS: Record<string, { code: string; name: string }[]> = {
  A: [
    { code: "A.1",   name: "A.1 — Outside Property" },
    { code: "A.2",   name: "A.2 — Establishment (Design, Construction and Maintenance)" },
    { code: "A.2.2", name: "A.2.2 — Movement of Persons and Things" },
    { code: "A.2.3", name: "A.2.3 — Lighting" },
    { code: "A.2.4", name: "A.2.4 — Ventilation" },
    { code: "A.2.5", name: "A.2.5 — Waste and Inedible / Food Disposal" },
    { code: "A.3.1", name: "A.3.1 — Employee Facilities" },
    { code: "A.3.2", name: "A.3.2 — Hand-Washing Stations and Sanitizing Installations" },
    { code: "A.4",   name: "A.4 — Water, Ice and Steam Supply" },
  ],
  B: [
    { code: "B.1",   name: "B.1 — Food Conveyances" },
    { code: "B.2.1", name: "B.2.1 — Purchasing and Receiving" },
    { code: "B.2.2", name: "B.2.2 — Storage" },
  ],
  C: [
    { code: "C.1.1", name: "C.1.1 — Equipment Design and Installation" },
    { code: "C.1.2", name: "C.1.2 — Equipment Maintenance and Calibration" },
  ],
  D: [
    { code: "D.1.1", name: "D.1.1 — General Food Hygiene Training" },
    { code: "D.1.2", name: "D.1.2 — Technical Training" },
    { code: "D.2",   name: "D.2 — General Food Hygiene Program" },
  ],
  E: [
    { code: "E.1", name: "E.1 — Sanitation Program" },
    { code: "E.2", name: "E.2 — Pest Control Program" },
  ],
  F: [
    { code: "F.1",   name: "F.1 — Recall Plan" },
    { code: "F.2.1", name: "F.2.1 — Traceability System (Documents)" },
    { code: "F.2.2", name: "F.2.2 — Labelling for Traceability" },
  ],
  G: [
    { code: "G.1", name: "G.1 — Allergen, Gluten and Added Sulphites Control" },
    { code: "G.2", name: "G.2 — Food Additives, Processing Aids and Added Nutrients" },
    { code: "G.3", name: "G.3 — Foreign Material Control Program" },
  ],
};

const DOCUMENT_SOURCE_OPTIONS: { value: DocumentSource; label: string }[] = [
  { value: "internal_upload", label: "Internal Upload" },
  { value: "google_drive",    label: "Google Drive" },
  { value: "sharepoint",      label: "SharePoint" },
  { value: "other",           label: "Other" },
];

interface FormState {
  programName: string;
  prpType: string;      // FSEP category letter A–G
  fsepCode: string;     // FSEP element code e.g. "A.1"
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
    prpType:           prp?.prpType           ?? "A",
    fsepCode:          prp?.fsepCode          ?? "",
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
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // When category changes, reset fsepCode unless the existing code matches
      if (field === "prpType" && value !== prev.prpType) {
        next.fsepCode = "";
      }
      return next;
    });
    setError(null);
  }

  // When user picks an element, also auto-fill the program name if blank
  function setElement(code: string) {
    const elements = FSEP_ELEMENTS[form.prpType] ?? [];
    const el = elements.find((e) => e.code === code);
    setForm((prev) => ({
      ...prev,
      fsepCode: code,
      // Auto-fill name from FSEP element if name is still blank
      programName: prev.programName.trim() === "" && el
        ? el.name.replace(/^[A-Z]\.\d[\d.]*\s*—\s*/, "") // strip "A.1 — " prefix
        : prev.programName,
    }));
    setError(null);
  }

  async function save() {
    if (!form.programName.trim()) {
      setError("Program name is required.");
      return;
    }
    setSaving(true);

    const payload = {
      programName:       form.programName.trim(),
      prpType:           form.prpType,
      fsepCode:          form.fsepCode.trim()       || null,
      description:       form.description.trim()    || null,
      documentReference: form.documentReference.trim() || null,
      documentUrl:       form.documentUrl.trim()    || null,
      documentSource:    form.documentSource        || null,
      owner:             form.owner.trim()          || null,
      reviewFrequency:   form.reviewFrequency.trim() || null,
      lastReviewDate:    form.lastReviewDate        || null,
      nextReviewDate:    form.nextReviewDate        || null,
    };

    const res = await fetch("/api/prp-registry", {
      method: prp ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prp ? { id: prp.id, ...payload } : payload),
    });

    setSaving(false);

    if (res.ok) {
      onSaved(await res.json() as PrpMaster);
    } else {
      const err = await res.json().catch(() => ({}));
      setError((err as { error?: string }).error ?? "Failed to save. Please try again.");
    }
  }

  const elementOptions = FSEP_ELEMENTS[form.prpType] ?? [];
  const selectedCategory = FSEP_CATEGORIES.find((c) => c.type === form.prpType);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{prp ? "Edit PRP" : "Add Prerequisite Program"}</DialogTitle>
          <p className="text-xs text-neutral-500 mt-1">
            Follows the CFIA FSEP prerequisite program structure (categories A–G).
          </p>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* FSEP Category + Element */}
          <div className="rounded-lg border border-neutral-200 p-4 space-y-4 bg-neutral-50">
            <p className="text-xs font-semibold text-neutral-700">FSEP Classification</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">FSEP Category *</Label>
                <Select value={form.prpType} onValueChange={(v) => v && set("prpType", v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FSEP_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.type} value={cat.type}>
                        <span className="font-bold">{cat.code}</span>
                        <span className="text-neutral-500 ml-1">— {cat.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCategory && (
                  <p className="text-[11px] text-neutral-500 mt-1">{selectedCategory.label}</p>
                )}
              </div>
              <div>
                <Label className="text-xs">FSEP Element</Label>
                <Select value={form.fsepCode || ""} onValueChange={(v) => v && setElement(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select element…" />
                  </SelectTrigger>
                  <SelectContent>
                    {elementOptions.map((el) => (
                      <SelectItem key={el.code} value={el.code}>
                        <span className="font-mono font-bold text-xs">{el.code}</span>
                        <span className="text-neutral-500 ml-1 text-xs">
                          — {el.name.replace(/^[A-Z]\.\d[\d.]*\s*—\s*/, "")}
                        </span>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom / Other</SelectItem>
                  </SelectContent>
                </Select>
                {form.fsepCode === "custom" && (
                  <Input
                    className="mt-2 text-xs"
                    placeholder="Enter custom code, e.g. A.2.1"
                    onChange={(e) => set("fsepCode", e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Core info */}
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Program Name *</Label>
              <Input
                value={form.programName}
                onChange={(e) => set("programName", e.target.value)}
                placeholder="e.g. Sanitation SOP — Equipment Cleaning"
                className="mt-1"
                autoFocus
              />
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
          </div>

          {/* Document info */}
          <div className="rounded-lg border border-neutral-200 p-4 space-y-4">
            <p className="text-xs font-semibold text-neutral-700">Document Reference</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Document Reference Number</Label>
                <Input
                  value={form.documentReference}
                  onChange={(e) => set("documentReference", e.target.value)}
                  placeholder="e.g. SOP-012, SSOP-E1-001"
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
            </div>
          </div>

          {/* Ownership & review */}
          <div className="rounded-lg border border-neutral-200 p-4 space-y-4">
            <p className="text-xs font-semibold text-neutral-700">Ownership & Review Schedule</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Responsible Owner</Label>
                <Input
                  value={form.owner}
                  onChange={(e) => set("owner", e.target.value)}
                  placeholder="e.g. QA Manager, Sanitation Supervisor"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Review Frequency</Label>
                <Input
                  value={form.reviewFrequency}
                  onChange={(e) => set("reviewFrequency", e.target.value)}
                  placeholder="e.g. Annually, Semi-annually"
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
