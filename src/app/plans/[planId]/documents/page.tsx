"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ProductDescription {
  name: string;
  characteristics: string;
  intendedUse: string;
  targetConsumer: string;
  shelfLife: string;
  packaging: string;
  storageDistribution: string;
  labellingInstructions: string;
  regulatoryClassification: string;
}

interface TeamMember {
  name: string;
  title: string;
  role: string;
  qualifications: string;
}

interface Plan {
  id: string;
  name: string;
  facilityName: string;
  facilityAddress: string | null;
  productDescription: string | null;
  teamMembers: string | null;
  scope: string | null;
}

export default function DocumentsPage() {
  const params = useParams();
  const planId = params.planId as string;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [product, setProduct] = useState<ProductDescription>({
    name: "", characteristics: "", intendedUse: "", targetConsumer: "",
    shelfLife: "", packaging: "", storageDistribution: "",
    labellingInstructions: "", regulatoryClassification: "",
  });
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [scope, setScope] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/plans/${planId}`).then(r => r.json()).then((data: Plan) => {
      setPlan(data);
      if (data.productDescription) {
        try { setProduct(JSON.parse(data.productDescription)); } catch {}
      }
      if (data.teamMembers) {
        try { setTeam(JSON.parse(data.teamMembers)); } catch {}
      }
      setScope(data.scope || "");
    });
  }, [planId]);

  async function save() {
    setSaving(true);
    setSaveError(null);
    const res = await fetch(`/api/plans/${planId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productDescription: JSON.stringify(product),
        teamMembers: JSON.stringify(team),
        scope,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setSaveError("Failed to save. Please try again.");
    }
  }

  function addTeamMember() {
    setTeam([...team, { name: "", title: "", role: "", qualifications: "" }]);
  }

  function updateTeamMember(index: number, field: keyof TeamMember, value: string) {
    setTeam(team.map((m, i) => i === index ? { ...m, [field]: value } : m));
  }

  function removeTeamMember(index: number) {
    setTeam(team.filter((_, i) => i !== index));
  }

  if (!plan) return <div className="p-8 text-neutral-500">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Plan Documents (Forms 1-4)</h2>
          <p className="text-sm text-neutral-500">
            Product description, team roster, and plan scope.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">Saved</span>}
          {saveError && <span className="text-sm text-red-600">{saveError}</span>}
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Form 1: Product Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Form 1: Product Description</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Product Name</Label>
              <Input value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Shelf Life</Label>
              <Input value={product.shelfLife} onChange={(e) => setProduct({ ...product, shelfLife: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Product Characteristics</Label>
            <Textarea value={product.characteristics} onChange={(e) => setProduct({ ...product, characteristics: e.target.value })} rows={2} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Intended Use</Label>
              <Input value={product.intendedUse} onChange={(e) => setProduct({ ...product, intendedUse: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Target Consumer</Label>
              <Input value={product.targetConsumer} onChange={(e) => setProduct({ ...product, targetConsumer: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Packaging</Label>
              <Input value={product.packaging} onChange={(e) => setProduct({ ...product, packaging: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Storage & Distribution</Label>
              <Input value={product.storageDistribution} onChange={(e) => setProduct({ ...product, storageDistribution: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Labelling Instructions</Label>
            <Input value={product.labellingInstructions} onChange={(e) => setProduct({ ...product, labellingInstructions: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Regulatory Classification</Label>
            <Input value={product.regulatoryClassification} onChange={(e) => setProduct({ ...product, regulatoryClassification: e.target.value })} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Scope */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Plan Scope</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            rows={3}
            placeholder="Describe the operations covered by this HACCP plan..."
          />
        </CardContent>
      </Card>

      {/* HACCP Team */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">HACCP Team</CardTitle>
          <Button variant="outline" size="sm" onClick={addTeamMember}>+ Add Member</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {team.length === 0 && (
            <p className="text-sm text-neutral-500 italic">No team members added.</p>
          )}
          {team.map((member, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="grid grid-cols-4 gap-2 flex-1">
                <Input placeholder="Name" value={member.name} onChange={(e) => updateTeamMember(i, "name", e.target.value)} className="text-sm" />
                <Input placeholder="Title" value={member.title} onChange={(e) => updateTeamMember(i, "title", e.target.value)} className="text-sm" />
                <Input placeholder="Role on team" value={member.role} onChange={(e) => updateTeamMember(i, "role", e.target.value)} className="text-sm" />
                <Input placeholder="Qualifications" value={member.qualifications} onChange={(e) => updateTeamMember(i, "qualifications", e.target.value)} className="text-sm" />
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeTeamMember(i)} className="text-neutral-400 hover:text-red-600 shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
