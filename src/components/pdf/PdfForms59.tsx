import { View, Text } from "@react-pdf/renderer";
import type { HazardSummaryRow } from "@/lib/logic/forms59";

const HAZARD_TYPE_PDF: Record<string, { letter: string; bg: string; text: string }> = {
  biological:   { letter: "B", bg: "#fee2e2", text: "#b91c1c" },
  chemical:     { letter: "C", bg: "#ffedd5", text: "#c2410c" },
  physical:     { letter: "P", bg: "#dbeafe", text: "#1d4ed8" },
  allergen:     { letter: "A", bg: "#f5f3ff", text: "#7c3aed" },
  radiological: { letter: "R", bg: "#fef9c3", text: "#a16207" },
  fraud:        { letter: "F", bg: "#f3f4f6", text: "#374151" },
};

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  High:   { bg: "#fee2e2", text: "#b91c1c" },
  Medium: { bg: "#fef9c3", text: "#a16207" },
  Low:    { bg: "#dcfce7", text: "#15803d" },
};

const OBJECT_COLORS: Record<string, { bg: string; text: string }> = {
  Input:  { bg: "#ecfeff", text: "#0e7490" },
  Step:   { bg: "#f3f4f6", text: "#374151" },
  Output: { bg: "#f0fdf4", text: "#15803d" },
};

function cap(s: string | null): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const BASE = { fontSize: 6.5, padding: 3 };

// Columns — risk is split into two sub-groups: without controls and with controls
const COLS = [
  { label: "1\nFlow Chart",           width: 55 },
  { label: "2\nProcess Step",         width: 50 },
  { label: "3\nInput/Step/Output",    width: 55 },
  { label: "4\nHazard\nType",         width: 22 },
  { label: "5\nHazard Description",   width: 85 },
  // Without controls group
  { label: "6\nSeverity\n(No Ctrl)",  width: 34 },
  { label: "7\nLikelih.\n(No Ctrl)",  width: 34 },
  { label: "8\nRisk\n(No Ctrl)",      width: 28 },
  // With controls group
  { label: "9\nSeverity\n(W/ Ctrl)",  width: 34 },
  { label: "10\nLikelih.\n(W/ Ctrl)", width: 34 },
  { label: "11\nRisk\n(W/ Ctrl)",     width: 28 },
  // Significance / CCP
  { label: "12\nSignif.",             width: 30 },
  { label: "13\nCCP Det.",            width: 30 },
  { label: "14\nCCP #",              width: 24 },
  { label: "15\nPRP Reference(s)",    width: 90 },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Cell({ width, children, style }: { width: number; children: React.ReactNode; style?: any }) {
  return (
    <View style={{ width, borderRightWidth: 1, borderRightColor: "#e5e7eb", paddingHorizontal: 3, paddingVertical: 3, ...style }}>
      {children}
    </View>
  );
}

function RiskBadge({ level }: { level: string | null }) {
  if (!level) return <Text style={{ ...BASE, color: "#9ca3af" }}>—</Text>;
  const cfg = RISK_COLORS[level] ?? null;
  if (!cfg) return <Text style={{ ...BASE }}>{level}</Text>;
  return (
    <View style={{ backgroundColor: cfg.bg, borderRadius: 2, paddingHorizontal: 3, paddingVertical: 1 }}>
      <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: cfg.text }}>{level}</Text>
    </View>
  );
}

export function PdfForms59({ rows }: { rows: HazardSummaryRow[] }) {
  if (rows.length === 0) {
    return (
      <View>
        <Text style={{ fontSize: 8, color: "#6b7280", fontStyle: "italic" }}>
          No hazard data found. Add hazard analysis to process steps, inputs, and outputs.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ borderWidth: 1, borderColor: "#d1d5db" }}>
      {/* Group headers */}
      <View style={{ flexDirection: "row", backgroundColor: "#e9ecef", borderBottomWidth: 1, borderBottomColor: "#9ca3af" }}>
        {/* Empty spacer for cols 1-5 */}
        <View style={{ width: COLS[0].width + COLS[1].width + COLS[2].width + COLS[3].width + COLS[4].width, borderRightWidth: 1, borderRightColor: "#9ca3af" }} />
        {/* Without controls */}
        <View style={{ width: COLS[5].width + COLS[6].width + COLS[7].width, borderRightWidth: 1, borderRightColor: "#9ca3af", paddingVertical: 2, paddingHorizontal: 3 }}>
          <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", color: "#dc2626" }}>Risk Without Controls</Text>
        </View>
        {/* With controls */}
        <View style={{ width: COLS[8].width + COLS[9].width + COLS[10].width, borderRightWidth: 1, borderRightColor: "#9ca3af", paddingVertical: 2, paddingHorizontal: 3 }}>
          <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", color: "#15803d" }}>Risk With Controls</Text>
        </View>
        {/* Empty spacer for remaining cols */}
        <View style={{ flex: 1 }} />
      </View>

      {/* Column headers */}
      <View style={{ flexDirection: "row", backgroundColor: "#f3f4f6", borderBottomWidth: 1, borderBottomColor: "#9ca3af" }}>
        {COLS.map((col) => (
          <Cell key={col.label} width={col.width}>
            <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: "#374151" }}>
              {col.label}
            </Text>
          </Cell>
        ))}
      </View>

      {/* Data rows */}
      {rows.map((row, i) => {
        const htCfg = HAZARD_TYPE_PDF[row.hazardType] ?? { letter: "?", bg: "#f3f4f6", text: "#374151" };
        const objCfg = OBJECT_COLORS[row.objectType] ?? OBJECT_COLORS.Step;

        return (
          <View
            key={i}
            style={{
              flexDirection: "row",
              borderBottomWidth: 1,
              borderBottomColor: "#e5e7eb",
              backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa",
            }}
            wrap={false}
          >
            {/* Col 1: Flow Chart */}
            <Cell width={COLS[0].width}>
              <Text style={{ ...BASE, color: "#1f2937", fontFamily: "Helvetica-Bold" }}>{row.flowChartName}</Text>
            </Cell>
            {/* Col 2: Process Step */}
            <Cell width={COLS[1].width}>
              <Text style={{ ...BASE, color: "#374151" }}>{row.stepName}</Text>
            </Cell>
            {/* Col 3: Object */}
            <Cell width={COLS[2].width}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" }}>
                <View style={{ backgroundColor: objCfg.bg, borderRadius: 2, paddingHorizontal: 3, paddingVertical: 1, marginRight: 3, marginBottom: 1 }}>
                  <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", color: objCfg.text }}>{row.objectType}</Text>
                </View>
                <Text style={{ ...BASE, color: "#374151", flex: 1 }}>{row.objectName}</Text>
              </View>
            </Cell>
            {/* Col 4: Hazard Type */}
            <Cell width={COLS[3].width} style={{ alignItems: "center", justifyContent: "center" }}>
              <View style={{ backgroundColor: htCfg.bg, borderRadius: 3, width: 14, height: 14, justifyContent: "center", alignItems: "center" }}>
                <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: htCfg.text }}>{htCfg.letter}</Text>
              </View>
            </Cell>
            {/* Col 5: Hazard Description */}
            <Cell width={COLS[4].width}>
              <Text style={{ ...BASE, color: "#374151" }}>{row.hazardDescription ?? "—"}</Text>
            </Cell>

            {/* ── Risk WITHOUT controls ── */}
            <Cell width={COLS[5].width} style={{ backgroundColor: i % 2 === 0 ? "#fff8f8" : "#fff0f0" }}>
              <Text style={{ ...BASE, color: "#374151" }}>{cap(row.severity)}</Text>
            </Cell>
            <Cell width={COLS[6].width} style={{ backgroundColor: i % 2 === 0 ? "#fff8f8" : "#fff0f0" }}>
              <Text style={{ ...BASE, color: "#374151" }}>{cap(row.likelihood)}</Text>
            </Cell>
            <Cell width={COLS[7].width} style={{ alignItems: "center", backgroundColor: i % 2 === 0 ? "#fff8f8" : "#fff0f0" }}>
              <RiskBadge level={row.riskLevel} />
            </Cell>

            {/* ── Risk WITH controls ── */}
            <Cell width={COLS[8].width} style={{ backgroundColor: i % 2 === 0 ? "#f8fff8" : "#f0fff0" }}>
              <Text style={{ ...BASE, color: "#374151" }}>{cap(row.severityWithControls)}</Text>
            </Cell>
            <Cell width={COLS[9].width} style={{ backgroundColor: i % 2 === 0 ? "#f8fff8" : "#f0fff0" }}>
              <Text style={{ ...BASE, color: "#374151" }}>{cap(row.likelihoodWithControls)}</Text>
            </Cell>
            <Cell width={COLS[10].width} style={{ alignItems: "center", backgroundColor: i % 2 === 0 ? "#f8fff8" : "#f0fff0" }}>
              <RiskBadge level={row.riskLevelWithControls} />
            </Cell>

            {/* Col 12: Significant */}
            <Cell width={COLS[11].width} style={{ alignItems: "center" }}>
              {row.isSignificant ? (
                <View style={{ backgroundColor: "#fee2e2", borderRadius: 2, paddingHorizontal: 3, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: "#b91c1c" }}>Yes</Text>
                </View>
              ) : (
                <Text style={{ ...BASE, color: "#9ca3af" }}>No</Text>
              )}
            </Cell>
            {/* Col 13: CCP Determination */}
            <Cell width={COLS[12].width} style={{ alignItems: "center" }}>
              {row.ccpDetermination === "CCP" ? (
                <View style={{ backgroundColor: "#fee2e2", borderRadius: 2, paddingHorizontal: 3, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: "#b91c1c" }}>CCP</Text>
                </View>
              ) : row.ccpDetermination === "Non-CCP" ? (
                <View style={{ backgroundColor: "#f3f4f6", borderRadius: 2, paddingHorizontal: 3, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 6.5, color: "#374151" }}>Non-CCP</Text>
                </View>
              ) : (
                <Text style={{ ...BASE, color: "#9ca3af" }}>—</Text>
              )}
            </Cell>
            {/* Col 14: CCP # */}
            <Cell width={COLS[13].width}>
              <Text style={{ ...BASE, color: "#374151", fontFamily: row.ccpNumber ? "Helvetica-Bold" : "Helvetica" }}>
                {row.ccpNumber ?? "—"}
              </Text>
            </Cell>
            {/* Col 15: PRP References */}
            <Cell width={COLS[14].width} style={{ borderRightWidth: 0 }}>
              {row.prpReferences.length > 0 ? (
                row.prpReferences.map((ref, j) => (
                  <Text key={j} style={{ ...BASE, color: "#374151" }}>{ref}</Text>
                ))
              ) : (
                <Text style={{ ...BASE, color: "#9ca3af" }}>—</Text>
              )}
            </Cell>
          </View>
        );
      })}
    </View>
  );
}
