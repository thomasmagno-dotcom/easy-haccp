import { AppShell } from "@/components/layout/AppShell";
import { db } from "@/lib/db";
import { hazards } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { SEVERITY_LEVELS, LIKELIHOOD_LEVELS, computeRiskScore, RISK_COLORS } from "@/lib/risk-matrix";

export const dynamic = "force-dynamic";

const TYPE_CONFIG: Record<string, { label: string; color: string; badgeColor: string }> = {
  biological:   { label: "Biological",    color: "bg-red-100 text-red-700 border-red-200",           badgeColor: "bg-red-100 text-red-700" },
  chemical:     { label: "Chemical",      color: "bg-orange-100 text-orange-700 border-orange-200",  badgeColor: "bg-orange-100 text-orange-700" },
  physical:     { label: "Physical",      color: "bg-blue-100 text-blue-700 border-blue-200",         badgeColor: "bg-blue-100 text-blue-700" },
  allergen:     { label: "Allergen",      color: "bg-purple-100 text-purple-700 border-purple-200",  badgeColor: "bg-purple-100 text-purple-700" },
  radiological: { label: "Radiological",  color: "bg-yellow-100 text-yellow-700 border-yellow-200", badgeColor: "bg-yellow-100 text-yellow-700" },
  fraud:        { label: "Food Fraud / EMA", color: "bg-neutral-100 text-neutral-700 border-neutral-200", badgeColor: "bg-neutral-100 text-neutral-700" },
};

// Canonical display order
const TYPE_ORDER = ["biological", "chemical", "physical", "allergen", "radiological", "fraud"];

export default function HazardsPage() {
  const allHazards = db
    .select()
    .from(hazards)
    .orderBy(asc(hazards.type), asc(hazards.name))
    .all();

  // Group by type — include any type present in DB
  const grouped: Record<string, typeof allHazards> = {};
  for (const h of allHazards) {
    if (!grouped[h.type]) grouped[h.type] = [];
    grouped[h.type].push(h);
  }

  // Ordered list of types that actually have data
  const orderedTypes = [
    ...TYPE_ORDER.filter((t) => grouped[t]?.length > 0),
    ...Object.keys(grouped).filter((t) => !TYPE_ORDER.includes(t)),
  ];

  const categoriesWithData = orderedTypes.length;

  return (
    <AppShell>
      <div className="p-6 max-w-full">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hazard Reference Database</h1>
            <p className="text-sm text-neutral-500 mt-1">
              {allHazards.length} hazards across {categoriesWithData} categories — applicable to all food sectors.
            </p>
          </div>
          {/* Category legend */}
          <div className="flex flex-wrap gap-2 justify-end max-w-lg">
            {orderedTypes.map((type) => {
              const cfg = TYPE_CONFIG[type] ?? { label: type, badgeColor: "bg-neutral-100 text-neutral-700" };
              return (
                <span key={type} className={`text-xs px-2 py-0.5 rounded border font-medium ${cfg.color}`}>
                  {cfg.label} ({grouped[type].length})
                </span>
              );
            })}
          </div>
        </div>

        {/* One section per hazard type */}
        {orderedTypes.map((type) => {
          const items = grouped[type];
          const cfg = TYPE_CONFIG[type] ?? { label: type, color: "bg-neutral-100 text-neutral-700 border-neutral-200", badgeColor: "bg-neutral-100 text-neutral-700" };

          return (
            <div key={type} className="mb-10">
              {/* Section heading */}
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${cfg.color}`}>
                  {cfg.label.charAt(0).toUpperCase()}
                </span>
                <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
                  {cfg.label} Hazards
                </h2>
                <span className="text-xs text-neutral-400">({items.length})</span>
              </div>

              {/* Table */}
              <div className="w-full overflow-x-auto rounded-lg border border-neutral-200">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200">
                      <th className="text-left text-xs font-semibold text-neutral-600 px-4 py-2.5 w-56 shrink-0">Name</th>
                      <th className="text-left text-xs font-semibold text-neutral-600 px-4 py-2.5">Description</th>
                      <th className="text-left text-xs font-semibold text-neutral-600 px-4 py-2.5 w-32 shrink-0">Severity</th>
                      <th className="text-left text-xs font-semibold text-neutral-600 px-4 py-2.5 w-36 shrink-0">Likelihood</th>
                      <th className="text-center text-xs font-semibold text-neutral-600 px-4 py-2.5 w-20 shrink-0">Risk</th>
                      <th className="text-left text-xs font-semibold text-neutral-600 px-4 py-2.5 w-28 shrink-0">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((h, idx) => {
                      const risk = computeRiskScore(h.severity, h.likelihood);
                      const sevLevel = SEVERITY_LEVELS.find((l) => l.value === h.severity);
                      const likLevel = LIKELIHOOD_LEVELS.find((l) => l.value === h.likelihood);

                      return (
                        <tr
                          key={h.id}
                          className={`border-b border-neutral-100 align-top ${idx % 2 === 0 ? "bg-white" : "bg-neutral-50/40"}`}
                        >
                          {/* Name */}
                          <td className="px-4 py-3 font-medium text-sm text-neutral-900 w-56">
                            {h.name}
                          </td>

                          {/* Description — wraps, no truncation */}
                          <td className="px-4 py-3 text-xs text-neutral-600 leading-relaxed">
                            {h.description}
                          </td>

                          {/* Severity */}
                          <td className="px-4 py-3 w-32">
                            {sevLevel ? (
                              <div>
                                <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded ${sevLevel.color}`}>
                                  {sevLevel.value} — {sevLevel.label}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-neutral-400">{h.severity ?? "—"}</span>
                            )}
                          </td>

                          {/* Likelihood */}
                          <td className="px-4 py-3 w-36">
                            {likLevel ? (
                              <div>
                                <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded ${likLevel.color}`}>
                                  {likLevel.value} — {likLevel.label}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-neutral-400">{h.likelihood ?? "—"}</span>
                            )}
                          </td>

                          {/* Risk score */}
                          <td className="px-4 py-3 text-center w-20">
                            {risk.score > 0 ? (
                              <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded border ${RISK_COLORS[risk.category]}`}>
                                {risk.score}
                              </span>
                            ) : (
                              <span className="text-xs text-neutral-300">—</span>
                            )}
                          </td>

                          {/* Source */}
                          <td className="px-4 py-3 text-xs text-neutral-500 capitalize w-28">
                            {h.sourceCategory ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
