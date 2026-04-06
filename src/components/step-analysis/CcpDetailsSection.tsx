"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CcpData } from "@/lib/types";

interface Props {
  planId: string;
  stepId: string;
  ccpData: CcpData | null;
}

interface FormState {
  hazardDescription: string;
  controlMeasureDescription: string;
  limits: Array<{
    parameter: string;
    minimum: string;
    maximum: string;
    target: string;
    unit: string;
    scientificBasis: string;
  }>;
  monitoring: Array<{
    what: string;
    how: string;
    frequency: string;
    who: string;
    recordForm: string;
  }>;
  corrective: Array<{
    deviation: string;
    immediateAction: string;
    productDisposition: string;
    rootCauseAnalysis: string;
    preventiveAction: string;
    responsiblePerson: string;
    recordForm: string;
  }>;
  verification: Array<{
    activity: string;
    frequency: string;
    responsiblePerson: string;
    method: string;
    recordReference: string;
  }>;
}

function initForm(ccpData: CcpData | null): FormState {
  if (!ccpData) {
    return {
      hazardDescription: "",
      controlMeasureDescription: "",
      limits: [{ parameter: "", minimum: "", maximum: "", target: "", unit: "", scientificBasis: "" }],
      monitoring: [{ what: "", how: "", frequency: "", who: "", recordForm: "" }],
      corrective: [{ deviation: "", immediateAction: "", productDisposition: "", rootCauseAnalysis: "", preventiveAction: "", responsiblePerson: "", recordForm: "" }],
      verification: [{ activity: "", frequency: "", responsiblePerson: "", method: "", recordReference: "" }],
    };
  }
  return {
    hazardDescription: ccpData.hazardDescription,
    controlMeasureDescription: ccpData.controlMeasureDescription,
    limits: ccpData.criticalLimits.length > 0
      ? ccpData.criticalLimits.map((l) => ({
          parameter: l.parameter,
          minimum: l.minimum || "",
          maximum: l.maximum || "",
          target: l.target || "",
          unit: l.unit || "",
          scientificBasis: l.scientificBasis || "",
        }))
      : [{ parameter: "", minimum: "", maximum: "", target: "", unit: "", scientificBasis: "" }],
    monitoring: ccpData.monitoringProcedures.length > 0
      ? ccpData.monitoringProcedures.map((m) => ({
          what: m.what,
          how: m.how,
          frequency: m.frequency,
          who: m.who,
          recordForm: m.recordForm || "",
        }))
      : [{ what: "", how: "", frequency: "", who: "", recordForm: "" }],
    corrective: ccpData.correctiveActions.length > 0
      ? ccpData.correctiveActions.map((c) => ({
          deviation: c.deviation,
          immediateAction: c.immediateAction,
          productDisposition: c.productDisposition,
          rootCauseAnalysis: c.rootCauseAnalysis || "",
          preventiveAction: c.preventiveAction || "",
          responsiblePerson: c.responsiblePerson,
          recordForm: c.recordForm || "",
        }))
      : [{ deviation: "", immediateAction: "", productDisposition: "", rootCauseAnalysis: "", preventiveAction: "", responsiblePerson: "", recordForm: "" }],
    verification: ccpData.verificationProcedures.length > 0
      ? ccpData.verificationProcedures.map((v) => ({
          activity: v.activity,
          frequency: v.frequency,
          responsiblePerson: v.responsiblePerson,
          method: v.method || "",
          recordReference: v.recordReference || "",
        }))
      : [{ activity: "", frequency: "", responsiblePerson: "", method: "", recordReference: "" }],
  };
}

export function CcpDetailsSection({ planId, stepId, ccpData }: Props) {
  const [form, setForm] = useState<FormState>(() => initForm(ccpData));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function updateField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
    setSaveError(null);
  }

  function updateArrayItem<K extends "limits" | "monitoring" | "corrective" | "verification">(
    arrayKey: K,
    index: number,
    field: string,
    value: string,
  ) {
    setForm((prev) => ({
      ...prev,
      [arrayKey]: prev[arrayKey].map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }));
    setSaved(false);
  }

  function addArrayItem<K extends "limits" | "monitoring" | "corrective" | "verification">(arrayKey: K) {
    const emptyItems: Record<string, unknown[]> = {
      limits: [{ parameter: "", minimum: "", maximum: "", target: "", unit: "", scientificBasis: "" }],
      monitoring: [{ what: "", how: "", frequency: "", who: "", recordForm: "" }],
      corrective: [{ deviation: "", immediateAction: "", productDisposition: "", rootCauseAnalysis: "", preventiveAction: "", responsiblePerson: "", recordForm: "" }],
      verification: [{ activity: "", frequency: "", responsiblePerson: "", method: "", recordReference: "" }],
    };
    setForm((prev) => ({
      ...prev,
      [arrayKey]: [...prev[arrayKey], ...emptyItems[arrayKey]],
    }));
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/plans/${planId}/ccps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stepId,
        hazardDescription: form.hazardDescription,
        controlMeasureDescription: form.controlMeasureDescription,
        limits: form.limits.filter((l) => l.parameter),
        monitoring: form.monitoring.filter((m) => m.what),
        corrective: form.corrective.filter((c) => c.deviation),
        verification: form.verification.filter((v) => v.activity),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
    } else {
      setSaveError("Failed to save. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Hazard & Control Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Hazard(s) Controlled</Label>
          <Textarea
            value={form.hazardDescription}
            onChange={(e) => updateField("hazardDescription", e.target.value)}
            rows={2}
            placeholder="e.g., Biological: Salmonella, E. coli, Listeria. Chemical: Excess chlorine."
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Control Measure</Label>
          <Textarea
            value={form.controlMeasureDescription}
            onChange={(e) => updateField("controlMeasureDescription", e.target.value)}
            rows={2}
            placeholder="e.g., Chlorinated water rinse at controlled concentration, temperature, pH"
            className="mt-1"
          />
        </div>
      </div>

      {/* Critical Limits */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Critical Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.limits.map((lim, i) => (
            <div key={i} className="grid grid-cols-6 gap-2">
              <Input placeholder="Parameter" value={lim.parameter} onChange={(e) => updateArrayItem("limits", i, "parameter", e.target.value)} className="text-sm" />
              <Input placeholder="Min" value={lim.minimum} onChange={(e) => updateArrayItem("limits", i, "minimum", e.target.value)} className="text-sm" />
              <Input placeholder="Max" value={lim.maximum} onChange={(e) => updateArrayItem("limits", i, "maximum", e.target.value)} className="text-sm" />
              <Input placeholder="Target" value={lim.target} onChange={(e) => updateArrayItem("limits", i, "target", e.target.value)} className="text-sm" />
              <Input placeholder="Unit" value={lim.unit} onChange={(e) => updateArrayItem("limits", i, "unit", e.target.value)} className="text-sm" />
              <Input placeholder="Scientific basis" value={lim.scientificBasis} onChange={(e) => updateArrayItem("limits", i, "scientificBasis", e.target.value)} className="text-sm" />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addArrayItem("limits")}>+ Add Limit</Button>
        </CardContent>
      </Card>

      {/* Monitoring Procedures */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Monitoring Procedures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.monitoring.map((mon, i) => (
            <div key={i} className="grid grid-cols-5 gap-2">
              <Input placeholder="What" value={mon.what} onChange={(e) => updateArrayItem("monitoring", i, "what", e.target.value)} className="text-sm" />
              <Input placeholder="How" value={mon.how} onChange={(e) => updateArrayItem("monitoring", i, "how", e.target.value)} className="text-sm" />
              <Input placeholder="Frequency" value={mon.frequency} onChange={(e) => updateArrayItem("monitoring", i, "frequency", e.target.value)} className="text-sm" />
              <Input placeholder="Who" value={mon.who} onChange={(e) => updateArrayItem("monitoring", i, "who", e.target.value)} className="text-sm" />
              <Input placeholder="Record Form" value={mon.recordForm} onChange={(e) => updateArrayItem("monitoring", i, "recordForm", e.target.value)} className="text-sm" />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addArrayItem("monitoring")}>+ Add Procedure</Button>
        </CardContent>
      </Card>

      {/* Corrective Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Corrective Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.corrective.map((ca, i) => (
            <div key={i} className="space-y-2 p-3 bg-neutral-50 rounded-lg">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Deviation" value={ca.deviation} onChange={(e) => updateArrayItem("corrective", i, "deviation", e.target.value)} className="text-sm" />
                <Input placeholder="Responsible Person" value={ca.responsiblePerson} onChange={(e) => updateArrayItem("corrective", i, "responsiblePerson", e.target.value)} className="text-sm" />
              </div>
              <Textarea placeholder="Immediate Action" value={ca.immediateAction} onChange={(e) => updateArrayItem("corrective", i, "immediateAction", e.target.value)} rows={2} className="text-sm" />
              <Textarea placeholder="Product Disposition" value={ca.productDisposition} onChange={(e) => updateArrayItem("corrective", i, "productDisposition", e.target.value)} rows={2} className="text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Root Cause Analysis" value={ca.rootCauseAnalysis} onChange={(e) => updateArrayItem("corrective", i, "rootCauseAnalysis", e.target.value)} className="text-sm" />
                <Input placeholder="Preventive Action" value={ca.preventiveAction} onChange={(e) => updateArrayItem("corrective", i, "preventiveAction", e.target.value)} className="text-sm" />
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addArrayItem("corrective")}>+ Add Corrective Action</Button>
        </CardContent>
      </Card>

      {/* Verification Procedures */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Verification Procedures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.verification.map((vp, i) => (
            <div key={i} className="grid grid-cols-5 gap-2">
              <Input placeholder="Activity" value={vp.activity} onChange={(e) => updateArrayItem("verification", i, "activity", e.target.value)} className="text-sm" />
              <Input placeholder="Frequency" value={vp.frequency} onChange={(e) => updateArrayItem("verification", i, "frequency", e.target.value)} className="text-sm" />
              <Input placeholder="Responsible Person" value={vp.responsiblePerson} onChange={(e) => updateArrayItem("verification", i, "responsiblePerson", e.target.value)} className="text-sm" />
              <Input placeholder="Method" value={vp.method} onChange={(e) => updateArrayItem("verification", i, "method", e.target.value)} className="text-sm" />
              <Input placeholder="Record Reference" value={vp.recordReference} onChange={(e) => updateArrayItem("verification", i, "recordReference", e.target.value)} className="text-sm" />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addArrayItem("verification")}>+ Add Verification</Button>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save CCP Details"}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved successfully</span>}
        {saveError && <span className="text-sm text-red-600">{saveError}</span>}
      </div>
    </div>
  );
}
