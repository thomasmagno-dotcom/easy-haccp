import { buildForms59Rows, HazardSummaryRow } from "@/lib/logic/forms59";
import { db } from "@/lib/db";
import { haccpPlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

const HAZARD_TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  biological:   { bg: "bg-red-100",    text: "text-red-700",    label: "B" },
  chemical:     { bg: "bg-orange-100", text: "text-orange-700", label: "C" },
  physical:     { bg: "bg-blue-100",   text: "text-blue-700",   label: "P" },
  allergen:     { bg: "bg-purple-100", text: "text-purple-700", label: "A" },
  radiological: { bg: "bg-yellow-100", text: "text-yellow-700", label: "R" },
  fraud:        { bg: "bg-neutral-100", text: "text-neutral-600", label: "F" },
};

const RISK_COLORS: Record<string, string> = {
  High:   "bg-red-100 text-red-700 font-semibold",
  Medium: "bg-yellow-100 text-yellow-700 font-semibold",
  Low:    "bg-green-100 text-green-700 font-semibold",
};

const OBJECT_TYPE_COLORS: Record<string, string> = {
  Input:  "bg-cyan-50 text-cyan-700",
  Step:   "bg-neutral-100 text-neutral-700",
  Output: "bg-teal-50 text-teal-700",
};

function cap(s: string | null): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function HazardTypeBadge({ type }: { type: string }) {
  const cfg = HAZARD_TYPE_COLORS[type] ?? { bg: "bg-neutral-100", text: "text-neutral-600", label: type.charAt(0).toUpperCase() };
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

export default async function HazardSummaryPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;

  const plan = await db.select().from(haccpPlans).where(eq(haccpPlans.id, planId)).get();
  if (!plan) notFound();

  const rows = await buildForms59Rows(planId);

  // Group rows by flow chart for visual separation
  const byChart = new Map<string, HazardSummaryRow[]>();
  for (const row of rows) {
    if (!byChart.has(row.flowChartName)) byChart.set(row.flowChartName, []);
    byChart.get(row.flowChartName)!.push(row);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold">Forms 5–9: Hazard Analysis Summary</h2>
          <p className="text-sm text-neutral-500 mt-1">
            All flow charts · {rows.length} hazard {rows.length === 1 ? "row" : "rows"}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 p-12 text-center text-neutral-400 text-sm">
          No hazard data found. Add hazard analysis to your process steps, inputs, and outputs.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 shadow-sm">
          <table className="min-w-full text-xs divide-y divide-neutral-200">
            <thead className="bg-neutral-50 sticky top-0 z-10">
              {/* Group header row */}
              <tr className="border-b border-neutral-200">
                <th colSpan={5} className="px-3 py-1.5 border-r border-neutral-200" />
                <th colSpan={3} className="px-3 py-1.5 text-center text-[10px] font-bold text-red-700 bg-red-50 border-r border-neutral-200">
                  Risk Without Controls
                </th>
                <th colSpan={3} className="px-3 py-1.5 text-center text-[10px] font-bold text-green-700 bg-green-50 border-r border-neutral-200">
                  Risk With Controls
                </th>
                <th colSpan={5} className="px-3 py-1.5 border-neutral-200" />
              </tr>
              {/* Column header row */}
              <tr>
                {[
                  ["1", "Flow Chart"],
                  ["2", "Process Step"],
                  ["3", "Input / Step / Output"],
                  ["4", "Hazard Type"],
                  ["5", "Hazard Description"],
                  ["6", "Severity"],
                  ["7", "Likelihood"],
                  ["8", "Risk Level"],
                  ["9", "Severity"],
                  ["10", "Likelihood"],
                  ["11", "Risk Level"],
                  ["12", "Significant"],
                  ["13", "CCP Det."],
                  ["14", "CCP #"],
                  ["15", "Control Measures"],
                  ["16", "PRP Reference(s)"],
                ].map(([num, label], idx) => (
                  <th
                    key={num}
                    className={`px-3 py-2.5 text-left font-semibold text-neutral-600 whitespace-nowrap border-r border-neutral-200 last:border-r-0 ${
                      idx >= 5 && idx <= 7 ? "bg-red-50/60" : idx >= 8 && idx <= 10 ? "bg-green-50/60" : ""
                    }`}
                  >
                    <span className="text-[10px] text-neutral-400 mr-1">{num}</span>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-100">
              {Array.from(byChart.entries()).map(([chartName, chartRows]) => (
                chartRows.map((row, i) => (
                  <tr
                    key={`${chartName}-${i}`}
                    className="hover:bg-neutral-50 transition-colors"
                  >
                    {/* Col 1: Flow Chart */}
                    <td className="px-3 py-2 border-r border-neutral-100 font-medium text-neutral-700 whitespace-nowrap">
                      {row.flowChartName}
                    </td>
                    {/* Col 2: Process Step */}
                    <td className="px-3 py-2 border-r border-neutral-100 text-neutral-700 whitespace-nowrap">
                      {row.stepName}
                    </td>
                    {/* Col 3: Object */}
                    <td className="px-3 py-2 border-r border-neutral-100">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium mr-1.5 ${OBJECT_TYPE_COLORS[row.objectType]}`}>
                        {row.objectType}
                      </span>
                      <span className="text-neutral-600">{row.objectName}</span>
                    </td>
                    {/* Col 4: Hazard Type */}
                    <td className="px-3 py-2 border-r border-neutral-100 text-center">
                      <HazardTypeBadge type={row.hazardType} />
                    </td>
                    {/* Col 5: Hazard Description */}
                    <td className="px-3 py-2 border-r border-neutral-100 max-w-xs text-neutral-700">
                      {row.hazardDescription ?? "—"}
                    </td>
                    {/* Col 6: Severity (without controls) */}
                    <td className="px-3 py-2 border-r border-neutral-100 whitespace-nowrap text-neutral-600 bg-red-50/20">
                      {cap(row.severity)}
                    </td>
                    {/* Col 7: Likelihood (without controls) */}
                    <td className="px-3 py-2 border-r border-neutral-100 whitespace-nowrap text-neutral-600 bg-red-50/20">
                      {cap(row.likelihood)}
                    </td>
                    {/* Col 8: Risk Level (without controls) */}
                    <td className="px-3 py-2 border-r border-neutral-100 whitespace-nowrap bg-red-50/20">
                      {row.riskLevel ? (
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] ${RISK_COLORS[row.riskLevel] ?? ""}`}>
                          {row.riskLevel}
                        </span>
                      ) : "—"}
                    </td>
                    {/* Col 9-11: Risk With Controls */}
                    <td className="px-3 py-2 border-r border-neutral-100 whitespace-nowrap text-neutral-600 bg-green-50/20">
                      {cap(row.severityWithControls)}
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-100 whitespace-nowrap text-neutral-600 bg-green-50/20">
                      {cap(row.likelihoodWithControls)}
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-100 whitespace-nowrap bg-green-50/20">
                      {row.riskLevelWithControls ? (
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] ${RISK_COLORS[row.riskLevelWithControls] ?? ""}`}>
                          {row.riskLevelWithControls}
                        </span>
                      ) : "—"}
                    </td>
                    {/* Col 12: Significant Hazard */}
                    <td className="px-3 py-2 border-r border-neutral-100 text-center">
                      {row.isSignificant ? (
                        <span className="inline-block rounded px-1.5 py-0.5 text-[10px] bg-red-100 text-red-700 font-semibold">Yes</span>
                      ) : (
                        <span className="text-neutral-400">No</span>
                      )}
                    </td>
                    {/* Col 13: CCP Determination */}
                    <td className="px-3 py-2 border-r border-neutral-100 whitespace-nowrap">
                      {row.ccpDetermination === "CCP" ? (
                        <span className="inline-block rounded px-1.5 py-0.5 text-[10px] bg-red-100 text-red-700 font-semibold">CCP</span>
                      ) : row.ccpDetermination === "Non-CCP" ? (
                        <span className="inline-block rounded px-1.5 py-0.5 text-[10px] bg-neutral-100 text-neutral-600">Non-CCP</span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    {/* Col 14: CCP # */}
                    <td className="px-3 py-2 border-r border-neutral-100 whitespace-nowrap font-medium text-neutral-700">
                      {row.ccpNumber ?? "—"}
                    </td>
                    {/* Col 15: Control Measures */}
                    <td className="px-3 py-2 border-r border-neutral-100 max-w-xs">
                      {row.controlMeasures.length > 0 ? (
                        <ul className="space-y-0.5">
                          {row.controlMeasures.map((cm, j) => (
                            <li key={j} className="text-neutral-600">{cm}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    {/* Col 16: PRP References */}
                    <td className="px-3 py-2 max-w-xs">
                      {row.prpReferences.length > 0 ? (
                        <ul className="space-y-0.5">
                          {row.prpReferences.map((ref, j) => (
                            <li key={j} className="text-neutral-600">{ref}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
