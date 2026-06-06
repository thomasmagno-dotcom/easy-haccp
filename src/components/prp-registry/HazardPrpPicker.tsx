"use client";

import { useState, useEffect, useRef } from "react";
import { PRP_TYPE_COLORS } from "./PrpRegistryClient";
import type { PrpMaster, HazardPrp } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  A: "Premises",
  B: "Conveyances & Storage",
  C: "Equipment",
  D: "Personnel",
  E: "Sanitation & Pest Control",
  F: "Recall System",
  G: "Operational PRPs",
};

function PrpRow({ prp, adding, onLink }: { prp: PrpMaster; adding: string | null; onLink: (p: PrpMaster) => void }) {
  return (
    <button
      onClick={() => onLink(prp)}
      disabled={adding === prp.id}
      className="w-full text-left px-3 py-2 hover:bg-neutral-50 disabled:opacity-50 flex items-center gap-2.5 border-b border-neutral-50 last:border-0 transition-colors"
    >
      <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded shrink-0 min-w-[36px] text-center ${PRP_TYPE_COLORS[prp.prpType]}`}>
        {prp.fsepCode ?? prp.prpType}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-tight">{prp.programName}</p>
        {prp.documentReference && (
          <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{prp.documentReference}</p>
        )}
      </div>
      {adding === prp.id && (
        <span className="text-[10px] text-neutral-400 shrink-0">Adding…</span>
      )}
    </button>
  );
}

interface Props {
  hazardId: string;           // base hazards.id
  hazardName: string;
  allPrps: PrpMaster[];       // full PRP registry for the picker
  initialLinks: HazardPrp[];  // already-linked PRPs for this hazard
}

export function HazardPrpPicker({ hazardId, hazardName, allPrps, initialLinks }: Props) {
  const [links, setLinks] = useState<HazardPrp[]>(initialLinks);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

  // Calculate fixed position from trigger button on open
  function openDropdown() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: r.bottom + 6,
        right: window.innerWidth - r.right,
      });
    }
    setOpen(true);
    setSearch("");
  }

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const linkedIds = new Set(links.map((l) => l.prpMasterId));
  const unlinked = allPrps.filter(
    (p) =>
      !linkedIds.has(p.id) &&
      (search.trim()
        ? p.programName.toLowerCase().includes(search.toLowerCase()) ||
          (p.documentReference ?? "").toLowerCase().includes(search.toLowerCase())
        : true),
  );

  async function linkPrp(prp: PrpMaster) {
    setAdding(prp.id);
    const res = await fetch("/api/hazard-prp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hazardId, prpMasterId: prp.id }),
    });
    if (res.ok) {
      const data: HazardPrp = await res.json();
      setLinks((prev) => [...prev, { ...data, prp }]);
    }
    setAdding(null);
    setSearch("");
  }

  async function unlinkPrp(linkId: string) {
    const res = await fetch(`/api/hazard-prp?id=${linkId}`, { method: "DELETE" });
    if (res.ok) setLinks((prev) => prev.filter((l) => l.id !== linkId));
  }

  return (
    <div className="space-y-1.5">
      {/* Linked PRP chips */}
      <div className="flex flex-wrap gap-1.5">
        {links.map((link) => {
          const prp = link.prp;
          if (!prp) return null;
          return (
            <span
              key={link.id}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-white"
            >
              {prp.fsepCode && (
                <span className={`text-[9px] font-bold font-mono px-1 rounded shrink-0 ${PRP_TYPE_COLORS[prp.prpType]}`}>
                  {prp.fsepCode}
                </span>
              )}
              <span className="truncate max-w-[140px]" title={prp.programName}>
                {prp.documentReference ? `${prp.documentReference} — ` : ""}{prp.programName}
              </span>
              <button
                onClick={() => unlinkPrp(link.id)}
                className="text-neutral-300 hover:text-red-500 ml-0.5 shrink-0"
                title="Remove link"
              >
                ×
              </button>
            </span>
          );
        })}

        {/* Add button */}
        <div className="relative">
          <button
            ref={triggerRef}
            onClick={() => open ? setOpen(false) : openDropdown()}
            className="inline-flex items-center gap-0.5 text-[11px] text-neutral-400 hover:text-neutral-700 border border-dashed border-neutral-300 hover:border-neutral-400 rounded-full px-2 py-0.5 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
            </svg>
            Link PRP
          </button>

          {open && dropdownPos && (
            <div
              ref={dropdownRef}
              style={{ position: "fixed", top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999, width: 384 }}
              className="bg-white border border-neutral-200 rounded-lg shadow-xl overflow-hidden"
            >
              {/* Search */}
              <div className="p-2 border-b bg-neutral-50">
                <input
                  type="text"
                  placeholder="Search by name, FSEP code, or reference…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
                  autoFocus
                />
              </div>

              {/* List */}
              <div className="max-h-96 overflow-y-auto">
                {unlinked.length === 0 ? (
                  <div className="px-3 py-6 text-xs text-center text-neutral-400">
                    {allPrps.length === 0
                      ? "No PRPs in registry yet."
                      : linkedIds.size === allPrps.length
                      ? "All PRPs already linked."
                      : "No matching PRPs."}
                  </div>
                ) : (() => {
                  // Group by prpType when not searching, flat list when searching
                  if (search.trim()) {
                    return unlinked.map((prp) => (
                      <PrpRow key={prp.id} prp={prp} adding={adding} onLink={linkPrp} />
                    ));
                  }
                  // Grouped
                  const groups = new Map<string, PrpMaster[]>();
                  for (const prp of unlinked) {
                    if (!groups.has(prp.prpType)) groups.set(prp.prpType, []);
                    groups.get(prp.prpType)!.push(prp);
                  }
                  return [...groups.entries()].map(([type, items]) => (
                    <div key={type}>
                      <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wide sticky top-0 ${PRP_TYPE_COLORS[type]} border-b border-neutral-200/60`}>
                        {type} — {items[0]?.prpType && CATEGORY_LABELS[type]}
                        <span className="ml-1.5 font-normal normal-case opacity-70">{items.length} program{items.length !== 1 ? "s" : ""}</span>
                      </div>
                      {items.map((prp) => (
                        <PrpRow key={prp.id} prp={prp} adding={adding} onLink={linkPrp} />
                      ))}
                    </div>
                  ));
                })()}
              </div>

              {/* Footer */}
              <div className="px-3 py-2 border-t bg-neutral-50 flex items-center justify-between">
                <span className="text-[10px] text-neutral-400">{unlinked.length} available</span>
                <a
                  href="/prp-registry"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-600 hover:text-blue-800"
                >
                  Manage PRP Registry →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
