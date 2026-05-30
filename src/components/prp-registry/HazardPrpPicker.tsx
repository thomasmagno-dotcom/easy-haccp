"use client";

import { useState, useEffect, useRef } from "react";
import { PRP_TYPE_COLORS } from "./PrpRegistryClient";
import type { PrpMaster, HazardPrp } from "@/lib/types";

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

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => { setOpen((o) => !o); setSearch(""); }}
            className="inline-flex items-center gap-0.5 text-[11px] text-neutral-400 hover:text-neutral-700 border border-dashed border-neutral-300 hover:border-neutral-400 rounded-full px-2 py-0.5 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
            </svg>
            Link PRP
          </button>

          {open && (
            <div className="absolute left-0 top-6 z-50 w-72 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
              <div className="p-2 border-b">
                <input
                  type="text"
                  placeholder="Search PRPs…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
                  autoFocus
                />
              </div>
              <div className="max-h-52 overflow-y-auto">
                {unlinked.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-center text-neutral-400">
                    {allPrps.length === 0
                      ? "No PRPs in registry yet."
                      : linkedIds.size === allPrps.length
                      ? "All PRPs already linked."
                      : "No matching PRPs."}
                  </div>
                ) : (
                  unlinked.map((prp) => (
                    <button
                      key={prp.id}
                      onClick={() => linkPrp(prp)}
                      disabled={adding === prp.id}
                      className="w-full text-left px-3 py-2 hover:bg-neutral-50 disabled:opacity-50 flex items-start gap-2 border-b border-neutral-50 last:border-0"
                    >
                      <span className={`mt-0.5 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded shrink-0 ${PRP_TYPE_COLORS[prp.prpType]}`}>
                        {prp.fsepCode ?? prp.prpType}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{prp.programName}</p>
                        {prp.documentReference && (
                          <p className="text-[10px] text-neutral-400 font-mono">{prp.documentReference}</p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="p-2 border-t bg-neutral-50">
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
