import { AppShell } from "@/components/layout/AppShell";
import { db } from "@/lib/db";
import { hazards } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SEVERITY_LEVELS, LIKELIHOOD_LEVELS, computeRiskScore, RISK_COLORS } from "@/lib/risk-matrix";

export const dynamic = "force-dynamic";

const TYPE_COLORS: Record<string, string> = {
  biological: "bg-red-100 text-red-700",
  chemical: "bg-orange-100 text-orange-700",
  physical: "bg-blue-100 text-blue-700",
  allergen: "bg-purple-100 text-purple-700",
};

export default function HazardsPage() {
  const allHazards = db
    .select()
    .from(hazards)
    .orderBy(asc(hazards.type), asc(hazards.name))
    .all();

  const grouped = {
    biological: allHazards.filter((h) => h.type === "biological"),
    chemical: allHazards.filter((h) => h.type === "chemical"),
    physical: allHazards.filter((h) => h.type === "physical"),
    allergen: allHazards.filter((h) => h.type === "allergen"),
  };

  return (
    <AppShell>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            Hazard Reference Database
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Pre-populated hazards for fresh-cut produce processing.{" "}
            {allHazards.length} hazards across{" "}
            {Object.values(grouped).filter((g) => g.length > 0).length} categories.
          </p>
        </div>

        {(["biological", "chemical", "physical", "allergen"] as const).map(
          (type) => {
            const items = grouped[type];
            if (items.length === 0) return null;
            return (
              <div key={type} className="mb-8">
                <h2 className="text-sm font-semibold uppercase text-neutral-500 mb-3 flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${TYPE_COLORS[type]}`}
                  >
                    {type.charAt(0).toUpperCase()}
                  </span>
                  {type.charAt(0).toUpperCase() + type.slice(1)} Hazards ({items.length})
                </h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24">Severity</TableHead>
                      <TableHead className="w-24">Likelihood</TableHead>
                      <TableHead className="w-20 text-center">Risk</TableHead>
                      <TableHead className="w-24">Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium text-sm">
                          {h.name}
                        </TableCell>
                        <TableCell className="text-xs text-neutral-600 max-w-md">
                          {h.description}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const level = SEVERITY_LEVELS.find(l => l.value === h.severity);
                            return level ? (
                              <span className="text-xs">{level.value} — {level.label}</span>
                            ) : (
                              <span className="text-xs text-neutral-400">{h.severity}</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const level = LIKELIHOOD_LEVELS.find(l => l.value === h.likelihood);
                            return level ? (
                              <span className="text-xs">{level.value} — {level.label}</span>
                            ) : (
                              <span className="text-xs text-neutral-400">{h.likelihood}</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            const risk = computeRiskScore(h.severity, h.likelihood);
                            return risk.score > 0 ? (
                              <span className={`text-xs px-2 py-0.5 rounded font-bold border ${RISK_COLORS[risk.category]}`}>
                                {risk.score}
                              </span>
                            ) : null;
                          })()}
                        </TableCell>
                        <TableCell className="text-xs text-neutral-500 capitalize">
                          {h.sourceCategory}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          },
        )}
      </div>
    </AppShell>
  );
}
