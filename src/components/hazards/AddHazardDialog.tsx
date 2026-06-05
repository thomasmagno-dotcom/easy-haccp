"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HAZARD_TYPES = [
  { value: "biological",   label: "Biological" },
  { value: "chemical",     label: "Chemical" },
  { value: "physical",     label: "Physical" },
  { value: "allergen",     label: "Allergen" },
  { value: "radiological", label: "Radiological" },
  { value: "fraud",        label: "Food Fraud / EMA" },
];

const SEVERITY_OPTIONS = [
  { value: "1", label: "1 — Negligible" },
  { value: "2", label: "2 — Minor" },
  { value: "3", label: "3 — Major" },
  { value: "4", label: "4 — Critical" },
];

const LIKELIHOOD_OPTIONS = [
  { value: "1", label: "1 — Rare" },
  { value: "2", label: "2 — Unlikely" },
  { value: "3", label: "3 — Likely" },
  { value: "4", label: "4 — Almost Certain" },
];

const EMPTY = { name: "", type: "", description: "", severity: "", likelihood: "" };

export function AddHazardDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof typeof EMPTY, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.type) {
      setError("Name and type are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/hazards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          description: form.description.trim() || null,
          severity: form.severity || null,
          likelihood: form.likelihood || null,
          sourceCategory: "custom",
        }),
      });
      if (!res.ok) throw new Error("Failed to save hazard.");
      setOpen(false);
      setForm(EMPTY);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        + Add Custom Hazard
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Hazard</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="hz-name">Name <span className="text-red-500">*</span></Label>
              <Input
                id="hz-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Ochratoxin A"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hz-type">Type <span className="text-red-500">*</span></Label>
              <Select value={form.type} onValueChange={(v) => set("type", v ?? "")}>
                <SelectTrigger id="hz-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {HAZARD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hz-desc">Description</Label>
              <Textarea
                id="hz-desc"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Brief description of the hazard and its food-safety significance"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="hz-sev">Severity</Label>
                <Select value={form.severity} onValueChange={(v) => set("severity", v ?? "")}>
                  <SelectTrigger id="hz-sev">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hz-lik">Likelihood</Label>
                <Select value={form.likelihood} onValueChange={(v) => set("likelihood", v ?? "")}>
                  <SelectTrigger id="hz-lik">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {LIKELIHOOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Add Hazard"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
