"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/utils";
import type { StepWithData, IngredientWithHazards } from "@/lib/queries/build-snapshot";

interface VersionDetail {
  id: string;
  versionNumber: number;
  publishedAt: string;
  publishedBy: string | null;
  changeDescription: string | null;
  status: string;
  effectiveDate: string | null;
  clonedFromVersionId: string | null;
  isRestorable: boolean;
  snapshot: {
    plan: {
      name: string;
      facilityName: string;
      facilityAddress?: string;
      scope?: string;
      productDescription?: string;
      teamMembers?: string;
    };
    processSteps: StepWithData[];
    ingredients: IngredientWithHazards[];
  };
}

function HazardBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    biological: "bg-red-100 text-red-700",
    chemical: "bg-orange-100 text-orange-700",
    physical: "bg-blue-100 text-blue-700",
    allergen: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors[type] ?? "bg-neutral-100 text-neutral-600"}`}>
      {type}
    </span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-amber-200 rounded-lg bg-white overflow-hidden">
      <div className="bg-amber-50 px-4 py-2 border-b border-amber-200">
        <h3 className="font-semibold text-amber-900 text-sm">{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="mb-2">
      <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{label}</span>
      <p className="text-sm text-neutral-800 mt-0.5 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export default function VersionViewPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.planId as string;
  const versionId = params.versionId as string;

  const [version, setVersion] = useState<VersionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);
  const [cloneSuccess, setCloneSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/plans/${planId}/versions/${versionId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Version not found");
        return r.json();
      })
      .then(setVersion)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [planId, versionId]);

  async function cloneVersion() {
    setCloning(true);
    try {
      const res = await fetch(`/api/plans/${planId}/versions/${versionId}/clone`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Clone failed");
      setCloneSuccess(true);
    } catch {
      setError("Clone failed. Please try again.");
    } finally {
      setCloning(false);
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-neutral-500">Loading version…</div>;
  }

  if (error) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-red-600 font-medium">{error}</p>
        <button onClick={() => router.back()} className="text-sm text-neutral-600 underline">Go back</button>
      </div>
    );
  }

  if (!version) return null;

  const isSuperseded = version.status === "superseded";
  const isDraft = version.status === "draft";

  // Watermark SVG as a repeating background — covers entire content area
  const wmText = encodeURIComponent(
    isSuperseded ? `SUPERSEDED · v${version.versionNumber}` :
    isDraft ? `DRAFT · v${version.versionNumber}` : ""
  );
  const wmSvg = wmText
    ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='420' height='300'%3E%3Ctext transform='rotate(-35%2C210%2C150)' x='20' y='175' font-family='sans-serif' font-size='40' font-weight='700' fill='rgba(180%2C0%2C0%2C0.09)' letter-spacing='3'%3E${wmText}%3C%2Ftext%3E%3C%2Fsvg%3E")`
    : "none";

  const bannerBg =
    isSuperseded ? "bg-red-700" :
    isDraft ? "bg-amber-600" :
    "bg-neutral-700";

  const snap = version.snapshot;

  let teamMembers: Array<{ name: string; title?: string; role?: string }> = [];
  try { teamMembers = snap.plan.teamMembers ? JSON.parse(snap.plan.teamMembers) : []; } catch { /* */ }

  let productDesc: Record<string, string> = {};
  try { productDesc = snap.plan.productDescription ? JSON.parse(snap.plan.productDescription) : {}; } catch { /* */ }

  return (
    /* Outer wrapper provides the watermark and relative context */
    <div
      className="relative -m-8 min-h-screen bg-amber-50/40"
      style={{ backgroundImage: wmSvg, backgroundRepeat: "repeat" }}
    >
      {/* ── Sticky superseded/draft banner ──────────────────────────────── */}
      <div className={`sticky top-0 z-40 ${bannerBg} text-white px-6 py-2.5 flex items-center justify-between shadow-md`}>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-bold text-sm tracking-wide uppercase">
            {isSuperseded
              ? `SUPERSEDED — Version ${version.versionNumber}`
              : isDraft
              ? `DRAFT — Version ${version.versionNumber}`
              : `Version ${version.versionNumber} (Active)`}
          </span>
          {version.effectiveDate && (
            <span className="text-sm opacity-80">
              Effective: {formatDateTime(version.effectiveDate)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs opacity-70 hidden sm:block">Read-only · No editing</span>
          {version.isRestorable && !cloneSuccess && (
            <button
              onClick={cloneVersion}
              disabled={cloning}
              className="bg-white text-neutral-900 text-xs font-semibold px-3 py-1.5 rounded hover:bg-neutral-100 disabled:opacity-50 transition"
            >
              {cloning ? "Cloning…" : "Clone to New Draft"}
            </button>
          )}
          {cloneSuccess && (
            <span className="text-xs bg-white/20 px-3 py-1.5 rounded font-semibold">
              Draft created ✓
            </span>
          )}
          <button
            onClick={() => router.push(`/plans/${planId}/versions`)}
            className="text-xs opacity-80 hover:opacity-100 underline"
          >
            ← Version History
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-6 space-y-5">

        {/* Version header card */}
        <div className="bg-white border-2 border-amber-400 rounded-xl px-6 py-4 flex items-start justify-between gap-4 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-amber-900">
              {snap.plan.name}
              <span className="ml-3 text-sm font-normal text-amber-600">
                Version {version.versionNumber}
              </span>
            </h1>
            <p className="text-sm text-neutral-600 mt-0.5">{snap.plan.facilityName}</p>
            {snap.plan.facilityAddress && (
              <p className="text-xs text-neutral-500">{snap.plan.facilityAddress}</p>
            )}
          </div>
          <div className="text-right text-xs text-neutral-500 space-y-1 shrink-0">
            <p>Published: {formatDateTime(version.publishedAt)}</p>
            {version.publishedBy && <p>By: {version.publishedBy}</p>}
            {version.clonedFromVersionId && (
              <p className="italic text-amber-600">Cloned from v{version.versionNumber - 1}</p>
            )}
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide
              ${isSuperseded ? "bg-red-100 text-red-700" : isDraft ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
              {version.status}
            </span>
          </div>
        </div>

        {/* Change notes */}
        {version.changeDescription && (
          <SectionCard title="Change Notes">
            <p className="text-sm text-neutral-700">{version.changeDescription}</p>
          </SectionCard>
        )}

        {/* Scope */}
        {snap.plan.scope && (
          <SectionCard title="Scope">
            <p className="text-sm text-neutral-700 whitespace-pre-wrap">{snap.plan.scope}</p>
          </SectionCard>
        )}

        {/* Product description */}
        {Object.keys(productDesc).length > 0 && (
          <SectionCard title="Product Description">
            <div className="grid grid-cols-2 gap-x-6">
              <Field label="Name" value={productDesc.name} />
              <Field label="Intended Use" value={productDesc.intendedUse} />
              <Field label="Target Consumer" value={productDesc.targetConsumer} />
              <Field label="Shelf Life" value={productDesc.shelfLife} />
              <Field label="Packaging" value={productDesc.packaging} />
              <Field label="Characteristics" value={productDesc.characteristics} />
              <Field label="Storage & Distribution" value={productDesc.storageDistribution} />
              <Field label="Labelling Instructions" value={productDesc.labellingInstructions} />
              <Field label="Regulatory Classification" value={productDesc.regulatoryClassification} />
            </div>
          </SectionCard>
        )}

        {/* HACCP Team */}
        {teamMembers.length > 0 && (
          <SectionCard title="HACCP Team">
            <div className="grid grid-cols-2 gap-3">
              {teamMembers.map((m, i) => (
                <div key={i} className="border border-neutral-100 rounded p-2">
                  <p className="text-sm font-medium text-neutral-800">{m.name}</p>
                  {m.title && <p className="text-xs text-neutral-500">{m.title}</p>}
                  {m.role && <p className="text-xs text-neutral-400">{m.role}</p>}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Ingredients */}
        {snap.ingredients.length > 0 && (
          <SectionCard title={`Ingredients & Raw Materials (${snap.ingredients.length})`}>
            <div className="space-y-2">
              {snap.ingredients.map((ing) => (
                <div key={ing.id} className="border border-neutral-100 rounded p-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-neutral-800">{ing.name}</span>
                    {ing.category && (
                      <span className="text-xs text-neutral-400 bg-neutral-50 px-1.5 py-0.5 rounded">{ing.category}</span>
                    )}
                    {ing.supplier && (
                      <span className="text-xs text-neutral-400">· {ing.supplier}</span>
                    )}
                  </div>
                  {ing.hazards.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ing.hazards.map((h) => (
                        <HazardBadge key={h.id} type={h.hazard.type} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Process Steps */}
        {snap.processSteps.length > 0 && (
          <SectionCard title={`Process Steps (${snap.processSteps.length})`}>
            <div className="space-y-3">
              {snap.processSteps.map((step, idx) => (
                <div key={step.id} className="border border-neutral-100 rounded p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-400 w-6">{idx + 1}.</span>
                      <span className="text-sm font-semibold text-neutral-800">{step.name}</span>
                      {step.isCcp && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">
                          {step.ccpNumber ?? "CCP"}
                        </span>
                      )}
                    </div>
                    {step.stepType && (
                      <span className="text-xs text-neutral-400">{step.stepType}</span>
                    )}
                  </div>
                  {step.description && (
                    <p className="text-xs text-neutral-500 mt-1 ml-8">{step.description}</p>
                  )}
                  {step.hazards.filter((h) => h.isSignificant).length > 0 && (
                    <div className="mt-2 ml-8 space-y-1">
                      {step.hazards.filter((h) => h.isSignificant).map((sh) => (
                        <div key={sh.id} className="flex items-center gap-2 text-xs flex-wrap">
                          <HazardBadge type={sh.hazard.type} />
                          <span className="text-neutral-600">{sh.hazard.name}</span>
                          {sh.controlMeasures.length > 0 && (
                            <span className="text-neutral-400">
                              — {sh.controlMeasures.map((cm) => cm.description).join("; ")}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {step.ccp && (
                    <div className="mt-2 ml-8 bg-red-50 border border-red-100 rounded p-2 text-xs text-red-800">
                      <span className="font-semibold">CCP Controls:</span>{" "}
                      {step.ccp.hazardDescription} — {step.ccp.controlMeasureDescription}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Footer disclaimer */}
        <div className="text-center py-4 text-xs text-amber-700 font-medium opacity-80 border-t border-amber-200">
          {isSuperseded
            ? `SUPERSEDED VERSION (v${version.versionNumber}) — For reference only. Must not be used as the current active HACCP Plan.`
            : isDraft
            ? `DRAFT VERSION (v${version.versionNumber}) — Not yet activated.`
            : `Active Version ${version.versionNumber}`}
        </div>
      </div>
    </div>
  );
}
