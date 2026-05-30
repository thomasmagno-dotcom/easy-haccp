"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PrpFormDialog } from "./PrpFormDialog";
import type { PrpMaster, PrpType } from "@/lib/types";

// ── Display config ────────────────────────────────────────────────────────────

export const PRP_TYPE_LABELS: Record<string, string> = {
  SSOP:                      "SSOP",
  GMP:                       "GMP",
  SOP:                       "SOP",
  pest_control:              "Pest Control",
  allergen_control:          "Allergen Control",
  environmental_monitoring:  "Environmental Monitoring",
  other:                     "Other",
};

export const PRP_TYPE_COLORS: Record<string, string> = {
  SSOP:                     "bg-blue-100 text-blue-700",
  GMP:                      "bg-green-100 text-green-700",
  SOP:                      "bg-amber-100 text-amber-700",
  pest_control:             "bg-orange-100 text-orange-700",
  allergen_control:         "bg-purple-100 text-purple-700",
  environmental_monitoring: "bg-teal-100 text-teal-700",
  other:                    "bg-neutral-100 text-neutral-600",
};

const PRP_TYPE_ORDER: PrpType[] = [
  "SSOP", "GMP", "SOP", "pest_control",
  "allergen_control", "environmental_monitoring", "other",
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  initialRecords: PrpMaster[];
  linkCounts: Record<string, number>;
}

export function PrpRegistryClient({ initialRecords, linkCounts }: Props) {
  const [records, setRecords] = useState<PrpMaster[]>(initialRecords);
  const [editTarget, setEditTarget] = useState<PrpMaster | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const filtered = records.filter((r) => {
    if (filterType !== "all" && r.prpType !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.programName.toLowerCase().includes(q) ||
        (r.documentReference ?? "").toLowerCase().includes(q) ||
        (r.owner ?? "").toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group by type in canonical order
  const grouped = PRP_TYPE_ORDER
    .map((type) => ({ type, items: filtered.filter((r) => r.prpType === type) }))
    .filter((g) => g.items.length > 0);

  function handleSaved(saved: PrpMaster) {
    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      return idx >= 0
        ? prev.map((r) => (r.id === saved.id ? saved : r))
        : [...prev, saved];
    });
    setAddOpen(false);
    setEditTarget(null);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete PRP "${name}"? This will also remove all hazard links.`)) return;
    const res = await fetch(`/api/prp-registry?id=${id}`, { method: "DELETE" });
    if (res.ok) setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  const presentTypes = Array.from(new Set(records.map((r) => r.prpType)));

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name, reference, owner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-sm text-sm border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="text-sm border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400"
        >
          <option value="all">All types</option>
          {PRP_TYPE_ORDER.filter((t) => presentTypes.includes(t)).map((t) => (
            <option key={t} value={t}>{PRP_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <div className="flex-1" />
        <Button onClick={() => setAddOpen(true)}>+ Add PRP</Button>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 mb-6 flex-wrap">
        {PRP_TYPE_ORDER.filter((t) => presentTypes.includes(t)).map((t) => {
          const count = records.filter((r) => r.prpType === t).length;
          return (
            <button
              key={t}
              onClick={() => setFilterType(filterType === t ? "all" : t)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterType === t
                  ? PRP_TYPE_COLORS[t] + " border-current"
                  : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400"
              }`}
            >
              {PRP_TYPE_LABELS[t]} · {count}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {records.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-neutral-200 rounded-xl">
          <p className="text-neutral-500 font-medium">No PRPs registered yet</p>
          <p className="text-sm text-neutral-400 mt-1">
            Add your first Prerequisite Program to get started.
          </p>
          <Button className="mt-4" onClick={() => setAddOpen(true)}>+ Add PRP</Button>
        </div>
      )}

      {/* Grouped records */}
      {grouped.map(({ type, items }) => (
        <div key={type} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${PRP_TYPE_COLORS[type]}`}>
              {PRP_TYPE_LABELS[type]}
            </span>
            <span className="text-xs text-neutral-400">{items.length} program{items.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="rounded-xl border border-neutral-200 overflow-hidden">
            {items.map((prp, idx) => (
              <div
                key={prp.id}
                className={`flex items-start gap-4 px-5 py-4 group hover:bg-neutral-50 transition-colors ${
                  idx > 0 ? "border-t border-neutral-100" : ""
                }`}
              >
                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-neutral-900">{prp.programName}</span>
                    {prp.documentReference && (
                      <span className="text-xs text-neutral-500 font-mono bg-neutral-100 px-1.5 py-0.5 rounded">
                        {prp.documentReference}
                      </span>
                    )}
                    {(linkCounts[prp.id] ?? 0) > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {linkCounts[prp.id]} hazard{linkCounts[prp.id] !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  {prp.description && (
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{prp.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    {prp.owner && (
                      <span className="text-xs text-neutral-500">
                        <span className="text-neutral-400">Owner:</span> {prp.owner}
                      </span>
                    )}
                    {prp.reviewFrequency && (
                      <span className="text-xs text-neutral-500">
                        <span className="text-neutral-400">Review:</span> {prp.reviewFrequency}
                      </span>
                    )}
                    {prp.nextReviewDate && (
                      <span className={`text-xs font-medium ${
                        new Date(prp.nextReviewDate) < new Date()
                          ? "text-red-600"
                          : "text-neutral-500"
                      }`}>
                        <span className="text-neutral-400 font-normal">Due:</span> {prp.nextReviewDate}
                      </span>
                    )}
                    {prp.documentUrl && (
                      <a
                        href={prp.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View document
                      </a>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setEditTarget(prp)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-neutral-400 hover:text-red-600"
                    onClick={() => handleDelete(prp.id, prp.programName)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add dialog */}
      {addOpen && (
        <PrpFormDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Edit dialog */}
      {editTarget && (
        <PrpFormDialog
          open={!!editTarget}
          prp={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
