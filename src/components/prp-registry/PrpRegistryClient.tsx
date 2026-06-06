"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PrpFormDialog } from "./PrpFormDialog";
import type { PrpMaster, PrpType } from "@/lib/types";

// ── FSEP category display config ──────────────────────────────────────────────
// Source: CFIA Food Safety Enhancement Program (FSEP) Technical Document

export const FSEP_CATEGORIES: { type: PrpType; code: string; label: string; shortLabel: string }[] = [
  { type: "A", code: "A", label: "Premises",                                              shortLabel: "Premises"           },
  { type: "B", code: "B", label: "Food Conveyances, Purchasing, Receiving and Storage",   shortLabel: "Conveyances/Storage" },
  { type: "C", code: "C", label: "Conveyances and Equipment in the Establishment",        shortLabel: "Equipment"          },
  { type: "D", code: "D", label: "Personnel",                                             shortLabel: "Personnel"          },
  { type: "E", code: "E", label: "Sanitation and Pest Control",                           shortLabel: "Sanitation/Pest"    },
  { type: "F", code: "F", label: "Recall System",                                         shortLabel: "Recall System"      },
  { type: "G", code: "G", label: "Operational Prerequisite Programs",                     shortLabel: "Operational PRPs"   },
];

export const PRP_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  FSEP_CATEGORIES.map((c) => [c.type, `${c.code} — ${c.shortLabel}`]),
);

export const PRP_TYPE_COLORS: Record<string, string> = {
  A: "bg-blue-100 text-blue-800",
  B: "bg-cyan-100 text-cyan-800",
  C: "bg-amber-100 text-amber-800",
  D: "bg-green-100 text-green-800",
  E: "bg-orange-100 text-orange-800",
  F: "bg-red-100 text-red-800",
  G: "bg-purple-100 text-purple-800",
};

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
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const filtered = records.filter((r) => {
    if (filterType !== "all" && r.prpType !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.programName.toLowerCase().includes(q) ||
        (r.fsepCode ?? "").toLowerCase().includes(q) ||
        (r.documentReference ?? "").toLowerCase().includes(q) ||
        (r.owner ?? "").toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const presentTypes = new Set(records.map((r) => r.prpType));
  const orderedCategories = FSEP_CATEGORIES.filter((c) => presentTypes.has(c.type));
  const filteredGroups = (filterType === "all" ? orderedCategories : FSEP_CATEGORIES.filter((c) => c.type === filterType))
    .map((cat) => ({ cat, items: filtered.filter((r) => r.prpType === cat.type).sort((a, b) => (a.fsepCode ?? "").localeCompare(b.fsepCode ?? "")) }))
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
    if (!confirm(`Delete "${name}"? This will also remove all linked hazard associations.`)) return;
    const res = await fetch(`/api/prp-registry?id=${id}`, { method: "DELETE" });
    if (res.ok) setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  async function loadFsepTemplate() {
    setSeeding(true);
    setSeedMsg(null);
    const res = await fetch("/api/prp-registry/seed-fsep", { method: "POST" });
    const data = await res.json();
    setSeedMsg(data.message);
    if (data.inserted > 0) {
      // Refresh the records list
      const refreshed = await fetch("/api/prp-registry");
      if (refreshed.ok) setRecords(await refreshed.json());
    }
    setSeeding(false);
  }

  return (
    <div>
      {/* FSEP banner */}
      <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
        <span className="text-red-600 text-xl shrink-0 mt-0.5">🍁</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-sm font-semibold text-red-900">
              CFIA Food Safety Enhancement Program (FSEP)
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={loadFsepTemplate}
              disabled={seeding}
              className="shrink-0 border-red-300 text-red-700 hover:bg-red-100"
            >
              {seeding ? "Loading…" : "Load FSEP Template"}
            </Button>
          </div>
          <p className="text-xs text-red-700 mt-1">
            This registry follows the FSEP prerequisite program structure: categories A–G as defined
            in the CFIA FSEP Technical Document. Programs are organized by FSEP element code (e.g., A.1, E.2, G.3).
          </p>
        </div>
      </div>

      {seedMsg && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
          ✓ {seedMsg}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name, FSEP code, reference, owner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-40 max-w-sm text-sm border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="text-sm border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400"
        >
          <option value="all">All categories</option>
          {FSEP_CATEGORIES.map((c) => (
            <option key={c.type} value={c.type}>
              {c.code} — {c.label}
            </option>
          ))}
        </select>
        <Button onClick={() => setAddOpen(true)} className="ml-auto">+ Add PRP</Button>
      </div>

      {/* Category filter chips */}
      {records.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {FSEP_CATEGORIES.filter((c) => presentTypes.has(c.type)).map((cat) => {
            const count = records.filter((r) => r.prpType === cat.type).length;
            return (
              <button
                key={cat.type}
                onClick={() => setFilterType(filterType === cat.type ? "all" : cat.type)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  filterType === cat.type
                    ? PRP_TYPE_COLORS[cat.type] + " border-current"
                    : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400"
                }`}
              >
                <span className="font-bold">{cat.code}</span> · {cat.shortLabel} · {count}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {records.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-neutral-200 rounded-xl">
          <p className="text-neutral-500 font-medium">No PRPs registered yet</p>
          <p className="text-sm text-neutral-400 mt-1">
            Click <strong>Load FSEP Template</strong> to populate all standard CFIA FSEP programs,
            or add your own.
          </p>
          <div className="flex justify-center gap-3 mt-4">
            <Button variant="outline" onClick={loadFsepTemplate} disabled={seeding}>
              {seeding ? "Loading…" : "🍁 Load FSEP Template"}
            </Button>
            <Button onClick={() => setAddOpen(true)}>+ Add PRP</Button>
          </div>
        </div>
      )}

      {/* Grouped records */}
      {filteredGroups.map(({ cat, items }) => (
        <div key={cat.type} className="mb-8">
          {/* Category header */}
          <div className="flex items-center gap-3 mb-3 pb-2 border-b border-neutral-100">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${PRP_TYPE_COLORS[cat.type]}`}>
              {cat.code}
            </span>
            <div>
              <span className="text-sm font-semibold text-neutral-800">{cat.label}</span>
              <span className="text-xs text-neutral-400 ml-2">
                {items.length} program{items.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 overflow-hidden">
            {items.map((prp, idx) => (
              <div
                key={prp.id}
                className={`relative flex items-start gap-4 px-5 py-4 group hover:bg-neutral-50 transition-colors ${
                  idx > 0 ? "border-t border-neutral-100" : ""
                }`}
              >
                {/* FSEP code badge */}
                <div className="shrink-0 pt-0.5">
                  {prp.fsepCode ? (
                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${PRP_TYPE_COLORS[prp.prpType]}`}>
                      {prp.fsepCode}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-300 font-mono">—</span>
                  )}
                </div>

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
                    {prp.lastReviewDate && (
                      <span className="text-xs text-neutral-500">
                        <span className="text-neutral-400">Last:</span> {prp.lastReviewDate}
                      </span>
                    )}
                    {prp.nextReviewDate && (
                      <span className={`text-xs font-medium ${
                        new Date(prp.nextReviewDate) < new Date() ? "text-red-600" : "text-neutral-500"
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View document
                      </a>
                    )}
                  </div>
                </div>

                {/* Actions — absolutely positioned so they don't affect flex widths */}
                <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded shadow-sm">
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setEditTarget(prp)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost" size="sm"
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

      {addOpen && (
        <PrpFormDialog open={addOpen} onClose={() => setAddOpen(false)} onSaved={handleSaved} />
      )}
      {editTarget && (
        <PrpFormDialog open={!!editTarget} prp={editTarget} onClose={() => setEditTarget(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
