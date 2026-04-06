"use client";

import { cn } from "@/lib/utils";
import {
  SEVERITY_LEVELS,
  LIKELIHOOD_LEVELS,
  getCellCategory,
  RISK_CELL_COLORS,
  computeRiskScore,
  migrateOldLevel,
} from "@/lib/risk-matrix";
import type { StepHazardAssignment } from "@/lib/types";

const TYPE_SHORT: Record<string, string> = {
  biological: "B",
  chemical: "C",
  physical: "P",
  allergen: "A",
};

interface Props {
  assignments: StepHazardAssignment[];
}

export function RiskMatrix({ assignments }: Props) {
  // Build lookup: which hazards fall in each cell
  const cellHazards: Record<string, StepHazardAssignment[]> = {};
  for (const a of assignments) {
    const sev = migrateOldLevel(a.severityOverride || a.hazard.severity);
    const lik = migrateOldLevel(a.likelihoodOverride || a.hazard.likelihood);
    if (sev && lik) {
      const key = `${sev}-${lik}`;
      if (!cellHazards[key]) cellHazards[key] = [];
      cellHazards[key].push(a);
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[500px]">
        {/* Header row: Likelihood labels */}
        <div className="flex">
          {/* Corner cell */}
          <div className="w-28 shrink-0" />
          {/* Likelihood column headers */}
          {LIKELIHOOD_LEVELS.map((lik) => (
            <div
              key={lik.value}
              className="flex-1 text-center px-1 pb-1"
            >
              <div className="text-xs font-semibold text-neutral-700">{lik.label}</div>
              <div className="text-[10px] text-neutral-400">L{lik.value}</div>
            </div>
          ))}
        </div>

        {/* Matrix rows: Severity (top = highest) */}
        {[...SEVERITY_LEVELS].reverse().map((sev) => (
          <div key={sev.value} className="flex">
            {/* Row label */}
            <div className="w-28 shrink-0 flex items-center pr-2">
              <div className="text-right w-full">
                <div className="text-xs font-semibold text-neutral-700">{sev.label}</div>
                <div className="text-[10px] text-neutral-400">S{sev.value}</div>
              </div>
            </div>

            {/* Cells */}
            {LIKELIHOOD_LEVELS.map((lik) => {
              const sevNum = parseInt(sev.value);
              const likNum = parseInt(lik.value);
              const category = getCellCategory(sevNum, likNum);
              const score = sevNum * likNum;
              const key = `${sev.value}-${lik.value}`;
              const hazards = cellHazards[key] || [];

              return (
                <div
                  key={lik.value}
                  className={cn(
                    "flex-1 min-h-[56px] border border-white/80 rounded-sm p-1 flex flex-col items-center justify-center gap-0.5",
                    RISK_CELL_COLORS[category],
                  )}
                >
                  <span className="text-[10px] font-bold text-neutral-500">{score}</span>
                  {hazards.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 justify-center">
                      {hazards.map((h) => (
                        <span
                          key={h.id}
                          className="w-5 h-5 rounded-full bg-white/80 border border-neutral-300 flex items-center justify-center text-[9px] font-bold text-neutral-700"
                          title={h.hazard.name}
                        >
                          {TYPE_SHORT[h.hazard.type] || "?"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Axis labels */}
        <div className="flex mt-2">
          <div className="w-28 shrink-0" />
          <div className="flex-1 text-center text-xs text-neutral-500 font-medium">
            Likelihood →
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-4 justify-center text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" />
            Low (1-3)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300" />
            Medium (4-6)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-orange-200 border border-orange-300" />
            High (8-9) — Significant
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-red-200 border border-red-300" />
            Critical (12-16) — Significant
          </span>
        </div>
      </div>
    </div>
  );
}
