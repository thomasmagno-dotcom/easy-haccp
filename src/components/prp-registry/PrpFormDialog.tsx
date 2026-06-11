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

const FSEP_ELEMENTS: Record<string, { code: string; name: string; sfcrSection: string }[]> = {
  A: [
    { code: "A.1",   name: "A.1 — Outside Property",                       sfcrSection: "s.56, s.59"  },
    { code: "A.2",   name: "A.2 — Inside Property",                        sfcrSection: "s.57–62"     },
    { code: "A.2.1", name: "A.2.1 — Structural Design & Maintenance",       sfcrSection: "s.57–62"     },
    { code: "A.2.2", name: "A.2.2 — Lighting",                             sfcrSection: "s.66"        },
    { code: "A.2.3", name: "A.2.3 — Ventilation",                          sfcrSection: "s.67"        },
    { code: "A.2.4", name: "A.2.4 — Waste Disposal & Drainage",            sfcrSection: "s.69–71"     },
    { code: "A.3",   name: "A.3 — Sanitary Facilities",                    sfcrSection: "s.63–65"     },
    { code: "A.3.1", name: "A.3.1 — Employee Amenities",                   sfcrSection: "s.63–65"     },
    { code: "A.3.2", name: "A.3.2 — Handwash & Sanitizing Stations",       sfcrSection: "s.63–65"     },
    { code: "A.4",   name: "A.4 — Water, Ice and Steam Quality",           sfcrSection: "s.68"        },
  ],
  B: [
    { code: "B.1",   name: "B.1 — Food Conveyances",                       sfcrSection: "s.49–52"     },
    { code: "B.2",   name: "B.2 — Purchasing, Receiving and Storage",      sfcrSection: "s.72–74"     },
    { code: "B.2.1", name: "B.2.1 — Purchasing, Receiving & Shipping",     sfcrSection: "s.72–74"     },
    { code: "B.2.2", name: "B.2.2 — Storage",                              sfcrSection: "s.74"        },
    { code: "B.2.3", name: "B.2.3 — Control of Non-Food Chemicals",        sfcrSection: "s.72–73"     },
  ],
  C: [
    { code: "C.1",   name: "C.1 — Equipment Design and Installation",      sfcrSection: "s.53–55"     },
    { code: "C.1.1", name: "C.1.1 — Equipment Cleanability & Design",      sfcrSection: "s.53–55"     },
    { code: "C.2",   name: "C.2 — Equipment Maintenance & Calibration",    sfcrSection: "s.53"        },
    { code: "C.2.1", name: "C.2.1 — Preventive Maintenance & Calibration", sfcrSection: "s.53"        },
  ],
  D: [
    { code: "D.1",   name: "D.1 — Training",                               sfcrSection: "s.80"        },
    { code: "D.1.1", name: "D.1.1 — Hygiene & Technical Training",         sfcrSection: "s.80"        },
    { code: "D.2",   name: "D.2 — Hygiene and Health Requirements",        sfcrSection: "s.76–79"     },
    { code: "D.2.1", name: "D.2.1 — Personal Cleanliness",                 sfcrSection: "s.76–79"     },
    { code: "D.2.2", name: "D.2.2 — Communicable Diseases & Illness",      sfcrSection: "s.76–79"     },
    { code: "D.2.3", name: "D.2.3 — Visitor & Contractor Controls",        sfcrSection: "s.76–79"     },
  ],
  E: [
    { code: "E.1",   name: "E.1 — Sanitation Program",                     sfcrSection: "s.49–50, s.75" },
    { code: "E.1.1", name: "E.1.1 — Cleaning & Sanitizing SOPs",           sfcrSection: "s.49–50, s.75" },
    { code: "E.1.2", name: "E.1.2 — Pre-Operational Inspections",          sfcrSection: "s.75"          },
    { code: "E.2",   name: "E.2 — Pest Control Program",                   sfcrSection: "s.59, s.75"    },
    { code: "E.2.1", name: "E.2.1 — Exclusion & Elimination SOPs",         sfcrSection: "s.59, s.75"    },
  ],
  F: [
    { code: "F.1",   name: "F.1 — Recall Plan",                            sfcrSection: "s.82–89"     },
    { code: "F.1.1", name: "F.1.1 — Traceback & Product Codes",            sfcrSection: "s.82–85"     },
    { code: "F.1.2", name: "F.1.2 — Recall Response Protocols",            sfcrSection: "s.86–89"     },
    { code: "F.1.3", name: "F.1.3 — Mock Recalls",                         sfcrSection: "s.86–89"     },
  ],
  G: [
    { code: "G.1",   name: "G.1 — Allergen Management Control",            sfcrSection: "s.47"        },
    { code: "G.1.1", name: "G.1.1 — Cross-Contact Prevention",             sfcrSection: "s.47"        },
    { code: "G.2",   name: "G.2 — Foreign Matter Control",                 sfcrSection: "s.47"        },
    { code: "G.2.1", name: "G.2.1 — Physical Hazard Controls",             sfcrSection: "s.47"        },
    { code: "G.3",   name: "G.3 — Other Product-Specific Controls",        sfcrSection: "s.47–48"     },
    { code: "G.3.1", name: "G.3.1 — Processing Environment Controls",      sfcrSection: "s.47–48"     },
    { code: "G.3.2", name: "G.3.2 — Rework Formulation Control",           sfcrSection: "s.47–48"     },
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
  prpType: string;
  fsepCode: string;
  sfcrSection: string;
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
    sfcrSection:       prp?.sfcrSection        ?? "",
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

  // Track whether the user is entering a custom code that doesn't match any
  // FSEP element, so the free-text input stays visible while they type.
  const elementOptions = FSEP_ELEMENTS[form.prpType] ?? [];
  const matchesKnownCode = elementOptions.some((e) => e.code === form.fsepCode);
  const [customMode, setCustomMode] = useState<boolean>(
    () => !!prp?.fsepCode && !Object.values(FSEP_ELEMENTS).flat().some((e) => e.code === prp.fsepCode),
  );

  function set(field: keyof FormState, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "prpType" && value !== prev.prpType) {
        next.fsepCode = "";
        next.sfcrSection = "";
      }
      return next;
    });
    setError(null);
  }

  function setElement(code: string) {
    if (code === "_custom") {
      setCustomMode(true);
      setForm((prev) => ({ ...prev, fsepCode: "", sfcrSection: "" }));
      return;
    }
    setCustomMode(false);
    const el = elementOptions.find((e) => e.code === code);
    setForm((prev) => ({
      ...prev,
      fsepCode: code,
      sfcrSection: el?.sfcrSection ?? prev.sfcrSection,
      programName: prev.programName.trim() === "" && el
        ? el.name.replace(/^[A-Z]\.\d[\d.]*\s*—\s*/, "")
        : prev.programName,
    }));
    setError(null);
  }

  // Dropdown value: show "_custom" when in custom mode (unmatched code), else the code
  const dropdownValue = customMode || (!matchesKnownCode && form.fsepCode)
    ? "_custom"
    : form.fsepCode || "";

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
      sfcrSection:       form.sfcrSection.trim()    || null,
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
                <Select value={form.prpType} onValueChange={(v) => { if (v) { set("prpType", v); setCustomMode(false); } }}>
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
                <Select value={dropdownValue} onValueChange={(v) => v && setElement(v)}>
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
                    <SelectItem value="_custom">Custom / Other</SelectItem>
                  </SelectContent>
                </Select>
                {/* Custom code input — shown when in custom mode */}
                {(customMode || (!matchesKnownCode && form.fsepCode)) && (
                  <Input
                    className="mt-2 text-xs"
                    placeholder="Enter custom code, e.g. A.2.6"
                    value={form.fsepCode}
                    onChange={(e) => set("fsepCode", e.target.value)}
                  />
                )}
              </div>
            </div>

            {/* SFCR section — auto-filled for FSEP, editable for custom */}
            <div>
              <Label className="text-xs">
                SFCR Legal Reference
                {!customMode && matchesKnownCode && (
                  <span className="ml-1 text-neutral-400 font-normal">(auto-filled from FSEP)</span>
                )}
              </Label>
              <Input
                className="mt-1 text-xs font-mono"
                placeholder="e.g. s.56, s.59"
                value={form.sfcrSection}
                onChange={(e) => set("sfcrSection", e.target.value)}
                readOnly={!customMode && matchesKnownCode}
              />
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
